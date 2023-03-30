'use strict'

const {
        array: toArray, contains_ip: containsIp, equalIds, asyncHandler, getClientIp, rBool, promised, findIdInArray,
        matchesEnvironment, isCustomName, OutputCursor
      } = require('../utils'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      OrgPolicyDefinition = require('../modules/db/definitions/org-policy-definition'),
      modules = require('../modules'),
      { db: { models }, cache, templates } = modules,
      ScriptTransform = require('../modules/sandbox/script-transform'),
      acl = require('../acl'),
      consts = require('../consts'),
      ap = require('../access-principal'),
      crypto = require('crypto'),
      { isRegExp, isString } = require('underscore'),
      matchers = [{
        name: 'methods',
        enabled: (req, principal, policy) => toArray(policy.methods).length > 0,
        trigger: (req, principal, policy) => policy.methods.includes(req.method.toLowerCase())
      }, {
        name: 'paths',
        enabled: (req, principal, policy) => toArray(policy.paths).length > 0,
        trigger: (req, principal, policy) => {
          let regexp = policy.regexp,
              ok = isRegExp(regexp)
          if (!ok && isString(regexp)) {
            try {
              const match = regexp.match(/^\/(.*)\/(.*)/)
              if (match) {
                regexp = new RegExp(match[1], match[2])
                ok = true
              }
            } catch (err) {
              void err
            }
          }
          return ok && regexp.test(req.path)
        }
      }, {
        name: 'ipWhitelist',
        enabled: (req, principal, policy) => toArray(policy.ipWhitelist).length > 0,
        trigger: (req, principal, policy) => !containsIp(policy.ipWhitelist, getClientIp(req))
      }, {
        name: 'ipBlacklist',
        enabled: (req, principal, policy) => toArray(policy.ipBlacklist).length > 0,
        trigger: (req, principal, policy) => containsIp(policy.ipBlacklist, getClientIp(req))
      }, {
        name: 'appWhitelist',
        enabled: (req, principal, policy) => toArray(policy.appWhitelist).length > 0,
        trigger: (req, principal, policy) => !policy.appWhitelist.some(v => req.orgApp && equalIds(v, req.orgApp._id))
      }, {
        name: 'appBlacklist',
        enabled: (req, principal, policy) => toArray(policy.appBlacklist).length > 0,
        trigger: (req, principal, policy) => policy.appBlacklist.some(v => req.orgApp && equalIds(v, req.orgApp._id))
      }, {
        name: 'aclWhitelist',
        enabled: (req, principal, policy) => toArray(policy.aclWhitelist).length > 0,
        trigger: (req, principal, policy) => !(new acl.AccessContext(principal, null, { req: req }).resolveAccess({ acl: policy.aclWhitelist }).hasAccess(acl.AccessLevels.Public))
      }, {
        name: 'aclBlacklist',
        enabled: (req, principal, policy) => toArray(policy.aclBlacklist).length > 0,
        trigger: (req, principal, policy) => (new acl.AccessContext(principal, null, { req: req }).resolveAccess({ acl: policy.aclBlacklist }).hasAccess(acl.AccessLevels.Public))
      }],
      SysConfig = models.SysConfig

let Undefined

/**
 * policy-based authentication for api routes.
 */
module.exports = asyncHandler(async(req, res, next) => {

  // policies don't run under support login. this can help un-brick an environment
  if (req.principal && req.principal.isSupportLogin) {
    return next()
  }

  const principal = req.principal || ap.synthesizeAnonymous(req.org),
        system = [],
        policies = [],
        runtime = await req.org.getRuntime()

  // add global policies. continue normal operation if the fail to load. also, never apply in base org.
  if (req.org.code !== 'medable') {
    try {
      const sysConfig = await SysConfig.loadConfig()
      system.push(
        ...toArray(sysConfig && sysConfig.policies).filter(p => p.active).sort((a, b) => b.priority - a.priority)
      )
    } catch (err) {
      void err
    }
  }

  // local system policies, assigned by the base org.
  system.push(
    ...toArray(req.org.configuration.systemPolicies)
      .filter(policy => policy.active && matchesEnvironment(policy.environment))
      .sort((a, b) => b.priority - a.priority)
  )

  // add system policies
  policies.push(...system)

  // add local policies from the runtime.
  policies.push(...runtime.policies)

  if (policies.length === 0) {
    return next()
  }

  for (let policy of policies) {

    const isSystemPolicy = system.some(p => equalIds(p._id, policy._id)),
          triggered = triggeredConditions(req, principal, policy),
          canRunScripts = (isSystemPolicy || rBool(req.org.configuration.scripting.enableApiPolicies, config('sandbox.limits.enableApiPolicies')))

    if (triggered.length) {

      if (!(await modules.sandbox.fulfillsConditions(new acl.AccessContext(principal, null, { req }), policy, { runtime }))) {
        continue
      }

      // trace to log
      if (policy.trace) {
        const now = new Date(),
              log = new models.log({
                req: req._id,
                org: req.org._id,
                beg: now,
                end: now,
                src: consts.logs.sources.policy,
                src_id: policy._id,
                pid: principal._id,
                oid: principal._id,
                exp: new Date(Date.now() + (86400 * 1000 * 30)),
                lvl: consts.logs.levels.trace,
                dat: {
                  policy: policy.label,
                  path: req.path,
                  action: policy.action,
                  triggered
                }
              }).toObject()
        models.log.collection.insertOne(log, err => void err)
      }

      // apply rate limiting
      await rateLimit(req, res, principal, policy, { isSystemPolicy })

      // late-parse global and system policies. scripts are included in these for now.
      if (!policy.metadata) {

        policy = {
          ...OrgPolicyDefinition.parseResources(req.org, policy.toObject()).filter(doc => doc.type === 'policy')[0],
          ...(policy.script || {})
        }

      }

      switch (policy.action) {

        case 'Redirect':

          res.redirect(
            policy.redirectStatusCode || 307,
            policy.redirectUrl[0] === '/'
              ? templates.apiUrl(req.org.code, policy.redirectUrl)
              : policy.redirectUrl
          )
          return

        case 'Deny':

          throw Fault.create(policy.faultCode, { statusCode: policy.faultStatusCode, reason: policy.faultReason })

        case 'Pipeline': {

          const ac = new acl.AccessContext(principal, null, { req }),
                pipeline = await modules.expressions.getRuntime(req.org, policy.pipeline, { runtime, type: 'pipeline' })

          res.addTransform({
            async run(err, input) {

              let output

              if (!err) {

                const ec = modules.expressions.createPipeline(ac, pipeline),
                      isCursor = input instanceof OutputCursor,
                      isArray = Array.isArray(input),
                      wrap = !isCursor && !isArray

                try {

                  if (wrap) {
                    input = [input]
                  }
                  output = await ec.evaluate({ input })
                  output.on('error', err => {
                    void err
                  })
                  if (wrap) {
                    const hasNext = await promised(output, 'hasNext')
                    output = hasNext ? await promised(output, 'next') : Undefined
                  }

                } catch (e) {
                  err = e
                  if (isCursor) {
                    try {
                      input.close()
                    } catch (e) {
                    }
                  }
                  try {
                    output.close()
                  } catch (e) {
                  }

                }

              }

              if (err) {
                throw err
              }
              return output

            }
          })

          break
        }

        case 'Transform':

          if (canRunScripts) {

            let script,
                transform

            const ac = new acl.AccessContext(principal, null, { req })

            // system policies will already have the scripts loaded into memory. these were parsed earlier.
            // non runtime environment policies need the scripts added from the local org configuration.
            // instead of polluting the stored runtime, add to the document override.
            if (!policy.metadata.runtime) {

              // always treat non-runtime policy transforms as adhoc.
              if (isSystemPolicy) {
                script = policy
              } else {
                const orgPolicy = findIdInArray(req.org.policies, '_id', policy.metadata.policyId)
                if (orgPolicy) {

                  if (isCustomName(orgPolicy.script && orgPolicy.script.script, 'c_', true, /^[a-zA-Z0-9-_]{0,}$/)) {
                    const transform = runtime.transforms.find(transform => transform.name === orgPolicy.script.script)
                    if (!transform) {
                      modules.db.models.Log.createLogEntry(
                        ac,
                        'policy',
                        Fault.create('cortex.notFound.script', { reason: `Transform missing for policy`, resource: policy.metadata.resource }),
                        {
                          policy: policy.metadata.resource,
                          transform: orgPolicy.script.script
                        }
                      )
                    } else {
                      script = await modules.sandbox.getRuntimeModel(req.org, runtime, transform, { type: 'route' })
                    }
                  } else {
                    script = {
                      ...policy,
                      ...(orgPolicy.script || {})
                    }
                  }
                }
              }

            } else {

              // a runtime policy transform is referenced by name
              const transform = runtime.transforms.find(transform => transform.name === policy.script)
              if (!transform) {
                modules.db.models.Log.createLogEntry(
                  ac,
                  'policy',
                  Fault.create('cortex.notFound.script', { reason: `Transform missing for policy`, resource: policy.metadata.resource }),
                  {
                    policy: policy.metadata.resource,
                    transform: policy.script
                  }
                )
              } else {
                script = await modules.sandbox.getRuntimeModel(req.org, runtime, transform, { type: 'route' })
              }
            }

            if (script) {
              // using legacy policy transform script.
              transform = await (new ScriptTransform(ac).init(script))
              res.addTransform(transform, {
                runtimeArguments: {
                  policy: {
                    _id: policy._id,
                    name: policy.name
                  },
                  policyOptions: {
                    triggered
                  }
                }
              })
            }
          }

          break

        case 'Script':

          if (canRunScripts) {

            const ac = new acl.AccessContext(principal, null, { req })

            let document,
                script,
                handled = false,
                result,
                halted = false

            // system policies will already have the scripts loaded into memory. these were parsed earlier.
            // non runtime environment policies need the scripts added from the local org configuration.
            // instead of polluting the stored runtime, add to the document override.
            if (!policy.metadata.runtime) {
              if (isSystemPolicy) {
                document = policy
              } else {
                const orgPolicy = findIdInArray(req.org.policies, '_id', policy.metadata.policyId)
                if (orgPolicy) {
                  document = {
                    ...policy,
                    ...(orgPolicy.script || {})
                  }
                }
              }
            }

            script = await modules.sandbox.getRuntimeModel(req.org, runtime, policy, { type: 'route', document })

            // use old-style callback to inspect script even if there's an error.
            // if anything was written from a policy or returned, consider the request complete.
            // this is legacy behaviour which is fine since policy scripts will be deprecated in favour
            // of @routes
            result = await new Promise((resolve, reject) => {
              modules.sandbox.executeModel(
                ac,
                null,
                script,
                {
                  runtime,
                  api: {
                    policy: {
                      halt: function(script, message, err, callback) {
                        script.closeAllResourcesOnExit = true
                        halted = true
                        return callback()
                      }
                    }
                  }
                },
                (err, { results, script } = {}) => {
                  if (script) {
                    if (res.headersSent || results !== null) {
                      handled = true
                    }
                    err ? reject(err) : resolve(results)
                  }
                })
            })

            if (handled) {
              return result
            } else if (halted) {
              return next()
            }

          }

          break

        case 'Allow':
        default:

          if (policy.halt) {
            return next()
          }
          break

      }

    }

  }

  next()

})

function triggeredConditions(req, principal, policy) {
  const matchAll = policy.condition === 'and'
  if (policy.active) {
    const enabled = matchers.filter(matcher => matcher.enabled(req, principal, policy))
    for (let matcher of enabled) {
      if (matcher.trigger(req, principal, policy)) {
        if (!matchAll) {
          return [matcher.name]
        }
      } else if (matchAll) {
        return []
      }
    }
    if (matchAll) {
      return enabled.map(matcher => matcher.name)
    }
  }
  return []
}

async function rateLimit(req, res, principal, policy, options) {

  if (!policy.rateLimit) {
    return
  }

  let data

  // tolerate internal errors
  try {

    const elements = policy.rateLimitElements.sort().map(element => {
      switch (element) {
        case 'method':
          return req.method
        case 'path':
          return req.path
        case 'ip':
          return getClientIp(req)
        case 'app':
          return (req.orgClient && req.orgClient._id.toString()) || ''
        case 'principal':
          return principal._id.toString()
      }
    })

    let key = options.isSystemPolicy
      ? `api.policies.rate-limit.${principal.org.code}.`
      : 'api.policies.rate-limit.' +
      `${policy._id}.${elements.length === 0 ? '*' : crypto.createHash('md5').update(elements.join('.')).digest('hex')}`

    data = await promised(cache, 'counter', options.isSystemPolicy ? null : principal.org, key, policy.rateLimitWindow)

    res.header('X-Rate-Limit-Limit', policy.rateLimitCount)
    res.header('X-Rate-Limit-Remaining', Math.max(0, policy.rateLimitCount - data.val))
    res.header('X-Rate-Limit-Reset', Math.ceil(data.ttl / 1000))

  } catch (err) {

    const logged = Fault.from(err, null, true)
    logged.trace = logged.trace || 'Error\n\tnative policy:0'
    models.Log.logApiErr(
      'policy',
      logged,
      new acl.AccessContext(principal.org, null, { req: req })
    )

  }

  if (data.val > policy.rateLimitCount) {
    res.header('Retry-After', Math.ceil(data.ttl / 1000))
    throw Fault.create('cortex.throttled.policy', { reason: policy.rateLimitReason })
  }

}
