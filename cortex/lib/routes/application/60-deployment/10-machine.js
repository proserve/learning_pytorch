'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      async = require('async'),
      acl = require('../../../acl'),
      consts = require('../../../consts'),
      ap = require('../../../access-principal')

module.exports = function(express, router) {

  // machine routes, called between servers, validate with a signed request.

  /**
     * Add Target Response
     * @description called by target to accept/reject a source connection.
     */
  router.post('/deployments/source/add-source-response',
    middleware.body_parser.strict,
    modules.deployment.keyPairCheck,
    modules.deployment.readZippedPayload,
    function(req, res, next) {

      req.principal = ap.synthesizeAnonymous(req.org)

      const payload = {
        token: utils.path(req.body, 'token'),
        state: utils.path(req.body, 'state')
      }

      modules.db.models.org.aclReadPath(req.principal, req.org.id, 'deployment.targets', { req: req, skipAcl: true, grant: acl.AccessLevels.System }, function(err, result) {
        if (err) {
          return next(err)
        }
        const targets = utils.array(result)
        let len = targets.length, target
        while (len--) {
          target = targets[len]
          if (payload.token === target.token) {
            modules.db.models.org.aclUpdatePath(req.principal, req.org._id, 'deployment.targets', { _id: target._id, state: payload.state }, { method: 'put', req: req, skipAcl: true, grant: acl.AccessLevels.System }, function(err) {
              modules.deployment.outputZippedResponse(res, err, true)
            })
            return
          }
        }
        next(Fault.create('cortex.notFound.deploymentTarget'))
      })
    }
  )

  /**
     * Add Target Deployment Result
     *
     */
  router.post('/deployments/source/deployment-result',
    middleware.body_parser.strict,
    modules.deployment.keyPairCheck,
    modules.deployment.readZippedPayload,
    function(req, res, next) {

      req.principal = ap.synthesizeAnonymous(req.org)

      async.waterfall([

        // validate the source for the remote target
        callback => {

          const token = utils.path(req.body, 'token')

          modules.db.models.org.aclReadPath(req.principal, req.org.id, 'deployment.targets', { req: req, skipAcl: true, grant: acl.AccessLevels.System }, function(err, result) {
            if (!err) {
              const target = utils.array(result).filter(target => token === target.token)[0]
              if (!target) {
                err = Fault.create('cortex.notFound.deploymentTarget')
              } else if (target.state !== 'Active') {
                err = Fault.create('cortex.invalidArgument.inactiveDeploymentTarget')
              }
            }
            callback(err)
          })
        },

        // find and update the deployment
        callback => {

          const deploymentId = utils.getIdOrNull(utils.path(req.body, 'deploymentId')),
                lastRunId = utils.getIdOrNull(utils.path(req.body, 'runId')),
                result = utils.path(req.body, 'result')

          if (!deploymentId || !lastRunId) {
            return callback(Fault.create('cortex.invalidArgument.invalidDeploymentId'))
          }

          modules.db.models.deployment.aclReadOne(req.principal, deploymentId, { req: req, skipAcl: true, grant: acl.AccessLevels.System, paths: ['lastRunId', 'lastDeployed', 'lastDeployer', 'session', 'scripts.result', 'isSupportLogin'] }, function(err, doc) {
            if (err) {
              return callback(err)
            }
            if (!utils.equalIds(doc.lastRunId, lastRunId)) {
              return callback(Fault.create('cortex.error.deploymentRunMismatch'))
            }
            doc.lastRunResult = result

            modules.db.models.deployment.aclUpdate(req.principal, deploymentId, { lastRunResult: result, isSupportLogin: false, session: null }, { method: 'put', req: req, skipAcl: true, grant: acl.AccessLevels.System }, function(err) {
              callback(err, doc)
            })
          })
        },

        // run the after script as the last deployer
        (doc, callback) => {

          const scriptSource = utils.rString(utils.path(doc, 'scripts.result'), '').trim()
          if (!scriptSource) {
            return callback()
          }
          delete doc.scripts

          ap.create(req.org, doc.lastDeployer, (err, principal) => {
            if (err) {
              return callback(err)
            }

            const scriptAc = new acl.AccessContext(principal, null, { req: req })

            scriptAc.option('deployment.isSupportLogin', Boolean(doc.isSupportLogin))
            delete doc.isSupportLogin

            modules.sandbox.sandboxed(
              scriptAc,
              scriptSource,
              {
                compilerOptions: {
                  type: 'deployment',
                  specification: 'es6',
                  label: `Deployment Result ${doc._id}.${doc.lastRunId}`
                },
                scriptOptions: {
                  context: doc
                }
              }
            )(callback)
          })
        }

      ], (err) => {

        modules.deployment.outputZippedResponse(res, err, true)

      })

    }
  )

  const adminOnlyMiddleware = middleware.role_restricted({ require: acl.OrgAdminRole })

  /**
     * Authenticate with target
     */
  router.post('/deployments/target/authenticate',
    middleware.body_parser.strict,
    modules.deployment.keyPairCheck,
    modules.deployment.targetCheckMiddleware,
    modules.deployment.targetSourceCheckMiddleware,
    modules.deployment.readZippedPayload,
    function(req, res) {

      async.waterfall([
        function(callback) {
          modules.deployment.doAuth(req, res, callback)
        },
        function(principal, account, callback) {
          req.principal = principal
          adminOnlyMiddleware(req, res, function(err) {
            callback(err, account)
          })
        },
        function(account, callback) {
          let encrypted, err
          try {
            encrypted = modules.deployment.createSession(req.principal, !!req.principal.scope, null, account.password)
          } catch (e) {
            err = e
          }
          callback(err, encrypted, account)
        }

      ], function(err, session, account) {
        modules.deployment.outputZippedResponse(res, err, { principal: utils.path(account, '_id'), session: session })
      })

    }
  )

  /**
     * Request Source
     * @description called by the source to request addition as a valid target
     */
  router.post('/deployments/target/add-source',
    middleware.body_parser.strict,
    modules.deployment.keyPairCheck,
    modules.deployment.targetCheckMiddleware,
    modules.deployment.readZippedPayload,
    function(req, res) {

      req.principal = ap.synthesizeAnonymous(req.org)
      const payload = {
        server: utils.path(req.body, 'server'),
        code: utils.path(req.body, 'code'),
        token: utils.path(req.body, 'token')
      }
      modules.db.models.org.aclUpdatePath(req.principal, req.org._id, 'deployment.sources', payload, { method: 'post', req: req, skipAcl: true, grant: acl.AccessLevels.System }, function(err) {
        modules.deployment.outputZippedResponse(res, err, true)
      })

    }
  )

  /**
     * Get Target Mappings
     */
  router.post('/deployments/target/mappings',
    middleware.body_parser.strict,
    modules.deployment.keyPairCheck,
    modules.deployment.targetCheckMiddleware,
    modules.deployment.targetSourceCheckMiddleware,
    modules.deployment.readZippedPayload,
    modules.deployment.tokenAuthenticator,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'deployment.execute', true)) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'deployment.execute' }))
      }
      req.principal.scope = null

      const dep = new modules.db.models.Deployment()
      dep.configuration = req.body.configuration
      dep.mappings = []
      async.eachSeries(
        req.body.mappings || [],
        (mapping, callback) => {
          dep.mappings.push(mapping)
          setImmediate(callback)
        },
        err => {
          if (err) {
            return modules.deployment.outputZippedResponse(res, err)
          }
          dep.updateTargetMappings(new acl.AccessContext(req.principal), function(err) {
            modules.deployment.outputZippedResponse(res, err, err ? null : dep.mappings.toObject())
          })
        })
    }
  )

  /**
     * Get Deployment Logs
     */
  router.get('/deployments/target/log/:id',
    modules.deployment.keyPairCheck,
    modules.deployment.targetCheckMiddleware,
    modules.deployment.targetSourceCheckMiddleware,
    modules.deployment.tokenAuthenticator,
    function(req, res, next) {

      const deploymentId = utils.getIdOrNull(req.params.id),
            find = {
              org: req.orgId,
              src: consts.logs.sources.deployment,
              dpl: utils.getIdOrNull(req.params.id)
            },
            options = {
              req: req,
              limit: utils.queryLimit(req.query.limit),
              skip: req.query.skip,
              total: true,
              sort: { _id: -1 }
            }

      if (!deploymentId) {
        return next(Fault.create('cortex.invalidArgument.invalidDeploymentId'))
      } else if (!modules.authentication.authInScope(req.principal.scope, `deployment.execute.${deploymentId}`)) {
        return next(Fault.create('cortex.accessDenied.scope', { path: `deployment.execute.${deploymentId}` }))
      }

      req.principal.scope = null

      if (utils.couldBeId(req.query.runId)) {
        find.src_id = utils.getIdOrNull(req.query.runId)
      }

      modules.db.models.Log.nodeList(req.principal, find, options, (err, logs) =>
        modules.deployment.outputZippedResponse(res, err, err ? null : logs)
      )
    }
  )

  /**
     * Initiate Deployment
     */
  router.post('/deployments/target/deploy/:id',
    require('body-parser').json({ limit: '8192kb', strict: true }),
    modules.deployment.keyPairCheck,
    modules.deployment.targetCheckMiddleware,
    modules.deployment.targetSourceCheckMiddleware,
    modules.deployment.tokenAuthenticator,
    function(req, res, next) {

      const deploymentId = utils.getIdOrNull(req.params.id)
      if (!deploymentId) {
        return next(Fault.create('cortex.invalidArgument.invalidDeploymentId'))
      }
      if (!modules.authentication.authInScope(req.principal.scope, `deployment.execute.${deploymentId}`)) {
        return next(Fault.create('cortex.accessDenied.scope', { path: `deployment.execute.${deploymentId}` }))
      }
      req.principal.scope = null

      // store blob for 30 minutes.
      modules.db.models.Blob.create(
        {
          org: req.orgId,
          label: 'Deployment',
          expires: new Date(Date.now() + (1000 * 60 * 30)),
          data: utils.path(req.body, 'payload')
        },
        (err, blob) => {

          if (err) {
            return next(err)
          }

          const lastRunId = utils.createId(),
                ac = new acl.AccessContext(req.principal, new modules.db.models.deployment({ _id: req.params.id }), { req: req }),
                token = req.header('Medable-Deployment-Token'),
                source = utils.array(req.org.deployment.sources).filter(src => src.token === token && src.state === 'Active')[0]

          modules.deployment.log(ac, lastRunId, 'Deployment Requested')

          modules.workers.send('work', 'deployer', {
            blob: blob._id,
            deployment: req.params._id,
            org: req.orgId,
            principal: req.principalId,
            sourceId: lastRunId,
            deploymentSourceId: source._id
          }, {
            reqId: req._id,
            orgId: req.orgId
          })

          modules.deployment.outputZippedResponse(res, null, lastRunId)
        }
      )

    }
  )

}
