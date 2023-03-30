'use strict'

const BaseScriptType = require('./base'),
      util = require('util'),
      crypto = require('crypto'),
      hasher = require('object-hash'),
      modules = require('../../../modules'),
      { expressions: { parseExpression, parsePipeline } } = modules,
      Fault = require('cortex-service/lib/fault'),
      acl = require('../../../acl'),
      { emptyId } = require('../../../consts'),
      { singularize } = require('inflection'),
      { pick, findIndex, groupBy } = require('underscore'),
      { rString, promised, isPlainObject, rInt, rBool, path: pathTo, array: toArray, isSet, rNum, matchesEnvironment, isCustomName } = require('../../../utils')

let Undefined

function LibraryScriptType() {
  BaseScriptType.call(this)
}

util.inherits(LibraryScriptType, BaseScriptType)

LibraryScriptType.calculateHash = LibraryScriptType.prototype.calculateHash = function(orgId, exportName) {
  var shasum = crypto.createHash('sha1')
  shasum.update([orgId, 'Library', exportName].join('_'))
  return shasum.digest('hex')
}

function makeOptions(args, name) {
  const initial = []
  let options = {}
  for (let i = 0; i < args.length; i += 1) {
    if (typeof args[i] === 'string') {
      initial.push(args[i])
    } else {
      options = args[i]
      break
    }
  }
  return { [name]: initial, options }
}

function isValidCustomEvent(eventName) {

  if (typeof eventName === 'string') {
    const parts = eventName.split('.').map(v => v.trim()).filter(v => v)
    if (eventName.length <= 128 && parts.length >= 1 && isCustomName(parts[0])) {
      return true
    }
  }
  return false

}

LibraryScriptType.prototype.parseResources = async function(ac, doc, { writeAndValidate = true, includeSelf = true } = {}) {

  const resources = await BaseScriptType.prototype.parseResources.call(this, ac, doc),
        scriptExport = doc.configuration.export

  if (includeSelf) {
    resources.push({
      metadata: {
        runtime: false,
        scriptId: doc._id,
        scriptHash: doc.compiledHash,
        resource: ac.getResource(),
        requires: doc.requires,
        roles: [],
        serviceAccounts: doc.serviceAccounts
      },
      ...pick(doc, 'active', 'type', 'label', 'name', 'principal', 'environment', 'weight', 'if'),
      configuration: pick(doc.configuration, 'export')
    })
  }

  for (const cls of toArray(doc.classes)) {

    let objectName = null

    try {

      for (const decorator of cls.decorators) {

        ac.pushResource(`@${decorator.name} ${rInt(pathTo(decorator.loc, 'line'), '?')}:${rInt(pathTo(decorator.loc, 'column'), '?')}`)

        switch (decorator.name) {

          case 'object': {

            const name = singularize(rString(decorator.params[0], cls.name)).toLowerCase().trim(),
                  options = decorator.params[1] || {}

            if (!name) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'object decorator requires a name  class name to associate with an object.' })
            }
            objectName = name

            if (writeAndValidate) {
              await ac.org.createObject(objectName)
            }

            resources.push({
              metadata: {
                runtime: true,
                scriptId: doc._id,
                scriptHash: doc.compiledHash,
                scriptExport,
                objectName: name,
                className: cls.name,
                loc: decorator.loc,
                resource: ac.getResource()
              },
              name,
              type: 'object',
              environment: rString(options.environment, '*'),
              active: rBool(options.active, true),
              weight: rNum(options.weight, 0)
            })

          }
            break

          case 'transform': {

            // if the name is missing from the transform, the backwards compatible runtime will use the script export
            // to locate the first anonymous transform.
            let options = {},
                def,
                name

            if (typeof decorator.params[0] === 'string') {
              const name = decorator.params[0]
              options = Object.assign(options, decorator.params[1], { name })
            } else {
              options = decorator.params[0] || {}
            }

            name = rString(options.name, scriptExport)

            // validate as a library script.
            def = {
              active: true,
              label: cls.name,
              name,
              ...pick(options, 'active', 'label', 'principal', 'environment', 'weight', 'if'),
              configuration: {}
            }

            if (writeAndValidate) {

              const ScriptType = modules.db.models.getModelForType('script', 'library'),
                    script = new ScriptType({
                      _id: emptyId,
                      org: ac.orgId,
                      object: 'script',
                      type: 'library',
                      script: 'void 0',
                      compiled: 'void 0'
                    }),
                    opAc = new acl.AccessContext(ac.principal, script, { method: 'put' })

              def.configuration.export = name

              opAc.option('skip.validator:script.name', true)
              opAc.option('skip.validator:script#library.configuration.export', true)
              await promised(script, 'aclWrite', opAc, def)
              await promised(script, 'validateWithAc', opAc, {})

              def = {
                ...pick(script, 'active', 'type', 'label', 'name', 'principal', 'environment', 'weight', 'if'),
                configuration: {}
              }

            }

            resources.push({
              metadata: {
                runtime: true,
                scriptId: doc._id,
                scriptHash: doc.compiledHash,
                scriptExport,
                className: cls.name,
                loc: decorator.loc,
                resource: ac.getResource()
              },
              ...def,
              type: 'transform'
            })

          }

            break

        }

        ac.popResource()

      }

      // env (property) -----------------------------
      for (const object of cls.properties.filter(v => v.kind === 'property' && v.decorators.find(v => v.name === 'env'))) {

        const decorators = object.decorators.filter(v => v.name === 'env'),
              { name: propertyName, value } = object

        for (const decorator of decorators) {

          let options = {},
              def

          ac.pushResource(`@env ${rInt(pathTo(object.loc, 'line'), '?')}:${rInt(pathTo(object.loc, 'column'), '?')}`)

          if (typeof decorator.params[0] === 'string') {
            const name = decorator.params[0]
            options = Object.assign(options, decorator.params[1], { name })
          } else {
            options = decorator.params[0] || {}
          }

          def = {
            active: true,
            label: `${cls.name}.${propertyName}`,
            name: propertyName,
            ...pick(options, 'name', 'active', 'environment', 'weight'),
            value
          }

          resources.push({
            metadata: {
              runtime: true,
              scriptId: doc._id,
              scriptHash: doc.compiledHash,
              scriptExport,
              className: cls.name,
              propertyName,
              static: object.static,
              resource: ac.getResource(),
              loc: object.loc
            },
            ...def,
            type: 'env'
          })

          ac.popResource()
        }

      }

      // pipelines (property) -----------------------------
      for (const object of cls.properties.filter(v => v.kind === 'property' && v.decorators.find(v => v.name === 'pipeline'))) {

        const decorators = object.decorators.filter(v => v.name === 'pipeline'),
              { name: propertyName, value } = object

        for (const decorator of decorators) {

          let options = {},
              def

          ac.pushResource(`@pipeline ${rInt(pathTo(object.loc, 'line'), '?')}:${rInt(pathTo(object.loc, 'column'), '?')}`)

          if (typeof decorator.params[0] === 'string') {
            const name = decorator.params[0]
            options = Object.assign(options, decorator.params[1], { name })
          } else {
            options = decorator.params[0] || {}
          }

          def = {
            active: true,
            label: `${cls.name}.${propertyName}`,
            name: propertyName,
            ...pick(options, 'name', 'active', 'environment', 'weight'),
            value,
            objectHash: hasher(value, { algorithm: 'sha256', encoding: 'hex' })
          }

          if (writeAndValidate) {
            parsePipeline(value)
          }

          resources.push({
            metadata: {
              runtime: true,
              scriptId: doc._id,
              scriptHash: doc.compiledHash,
              scriptExport,
              className: cls.name,
              propertyName,
              static: object.static,
              resource: ac.getResource(),
              loc: object.loc
            },
            ...def,
            type: 'pipeline'
          })

          ac.popResource()
        }

      }

      // expressions (property) -----------------------------
      for (const object of cls.properties.filter(v => v.kind === 'property' && v.decorators.find(v => v.name === 'expression'))) {

        const decorators = object.decorators.filter(v => v.name === 'expression'),
              { name: propertyName, value } = object

        for (const decorator of decorators) {

          let options = {},
              def

          ac.pushResource(`@expression ${rInt(pathTo(object.loc, 'line'), '?')}:${rInt(pathTo(object.loc, 'column'), '?')}`)

          if (typeof decorator.params[0] === 'string') {
            const name = decorator.params[0]
            options = Object.assign(options, decorator.params[1], { name })
          } else {
            options = decorator.params[0] || {}
          }

          def = {
            active: true,
            label: `${cls.name}.${propertyName}`,
            name: propertyName,
            ...pick(options, 'name', 'active', 'environment', 'weight'),
            value,
            objectHash: hasher(value, { algorithm: 'sha256', encoding: 'hex' })
          }

          if (writeAndValidate) {
            parseExpression(value)
          }

          resources.push({
            metadata: {
              runtime: true,
              scriptId: doc._id,
              scriptHash: doc.compiledHash,
              scriptExport,
              className: cls.name,
              propertyName,
              static: object.static,
              resource: ac.getResource(),
              loc: object.loc
            },
            ...def,
            type: 'expression'
          })

          ac.popResource()
        }

      }

      // policies (property or method) -----------------------------
      for (const object of [...cls.properties, ...cls.methods].filter(v => ['property', 'method'].includes(v.kind) && v.decorators.find(v => v.name === 'policy'))) {

        const { kind } = object,
              isProperty = kind === 'property',
              isMethod = !isProperty,
              { Org } = modules.db.models,
              policies = isProperty
                ? [object.value]
                : object.decorators.filter(v => v.name === 'policy' && isPlainObject(v.params[0])).map(v => v.params[0])

        for (const policy of policies) {

          ac.pushResource(`@policy ${rInt(pathTo(object.loc, 'line'), '?')}:${rInt(pathTo(object.loc, 'column'), '?')}`)

          const org = new Org({ _id: emptyId, object: 'org' }),
                opAc = new acl.AccessContext(ac.principal, org, { method: 'post' })

          let def = {
                action: isProperty ? Undefined : 'Script', // default action for method is always Script
                ...policy,
                label: 'Policy',
                script: isProperty ? Undefined : 'void 0',
                transform: Undefined,
                pipeline: Undefined
              },
              isScriptAction = def.action === 'Script',
              isTransformAction = def.action === 'Transform',
              isPipelineAction = def.action === 'Pipeline'

          delete def.transform
          delete def.pipeline

          if (isScriptAction !== isMethod) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Only policies declared as methods can use the Script action. All others must use a property declaration.' })
          }

          if (isTransformAction) {
            if (policy.transform) {
              def.script = policy.transform // accept transform script alias
            }
            if (!isCustomName(def.script)) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Transform policies must specify a named transform.' })
            }
          } else if (isPipelineAction) {
            def.pipeline = isSet(policy.pipeline) ? policy.pipeline : []
          }

          if (writeAndValidate) {

            await promised(org, 'aclWrite', opAc, {
              policies: [def]
            })
            await promised(org.policies[0], 'validateWithAc', opAc, {})
            def = await promised(Org, 'aclReadPath', ac.principal, null, 'policies.0', {
              allowNullSubject: true,
              document: org
            })
          }

          if (!isTransformAction) {
            delete def.script
          }

          resources.push({
            metadata: {
              runtime: true,
              scriptId: doc._id,
              scriptHash: doc.compiledHash,
              scriptExport,
              className: cls.name,
              [isProperty ? 'propertyName' : 'methodName']: object.name,
              static: object.static,
              resource: ac.getResource(),
              loc: object.loc
            },
            ...def,
            type: 'policy'
          })

          ac.popResource()
        }

      }

      // routes, jobs, triggers ----------------------------------------

      for (const method of cls.methods) {

        if (method.kind === 'method') {

          for (const decorator of method.decorators) {

            ac.pushResource(`@${decorator.name} ${rInt(pathTo(decorator.loc, 'line'), '?')}:${rInt(pathTo(decorator.loc, 'column'), '?')}`)

            switch (decorator.name) {

              // ...events { object, paths, events, principal, environment, weight }
              case 'trigger': {

                const { events, options } = makeOptions(decorator.params, 'events')

                for (const event of events) {

                  let def = {
                    active: true,
                    label: `${cls.name}.${method.name}`,
                    ...pick(options, 'active', 'label', 'name', 'principal', 'environment', 'weight', 'if'),
                    configuration: {
                      object: objectName,
                      event,
                      ...pick(options, 'inline', 'paths', 'object', 'rootDocument')
                    }
                  }

                  if (writeAndValidate) {

                    const ScriptType = modules.db.models.getModelForType('script', 'trigger'),
                          script = new ScriptType({
                            _id: emptyId,
                            org: ac.orgId,
                            object: 'script',
                            type: 'trigger',
                            script: 'void 0',
                            compiled: 'void 0'
                          }),
                          opAc = new acl.AccessContext(ac.principal, script, { method: 'put' })

                    opAc.option('skip.validator:script.name', true)
                    await promised(script, 'aclWrite', opAc, def)
                    await promised(script, 'validateWithAc', opAc, {})

                    def = {
                      ...pick(script, 'active', 'type', 'label', 'name', 'principal', 'environment', 'weight', 'if'),
                      configuration: pick(script.configuration, 'object', 'event', 'inline', 'paths', 'rootDocument')
                    }

                  }

                  resources.push({
                    metadata: {
                      runtime: true,
                      scriptId: doc._id,
                      scriptHash: doc.compiledHash,
                      scriptExport,
                      className: cls.name,
                      methodName: method.name,
                      static: method.static,
                      loc: decorator.loc,
                      resource: ac.getResource()
                    },
                    ...def,
                    type: 'trigger'
                  })

                }

                break
              }

              case 'on': {

                let options = {},
                    def,
                    event

                if (typeof decorator.params[0] === 'string') {
                  const event = decorator.params[0]
                  options = Object.assign(options, decorator.params[1], { event })
                } else {
                  options = decorator.params[0] || {}
                }

                event = rString(options.event, '')

                if (!isValidCustomEvent(event)) {
                  throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid custom event name. Listeners must be namespaced.' })
                }

                // validate as a library script.
                def = {
                  active: true,
                  label: `${cls.name}.${method.name}`,
                  ...pick(options, 'active', 'label', 'name', 'principal', 'environment', 'weight', 'if'),
                  configuration: {}
                }

                if (writeAndValidate) {

                  const ScriptType = modules.db.models.getModelForType('script', 'library'),
                        script = new ScriptType({
                          _id: emptyId,
                          org: ac.orgId,
                          object: 'script',
                          type: 'library',
                          script: 'void 0',
                          compiled: 'void 0'
                        }),
                        opAc = new acl.AccessContext(ac.principal, script, { method: 'put' })

                  def.configuration.export = scriptExport

                  opAc.option('skip.validator:script.name', true)
                  opAc.option('skip.validator:script#library.configuration.export', true)
                  await promised(script, 'aclWrite', opAc, def)
                  await promised(script, 'validateWithAc', opAc, {})

                  def = {
                    ...pick(script, 'active', 'type', 'label', 'name', 'principal', 'environment', 'weight', 'if'),
                    configuration: {
                      event
                    }
                  }

                }

                resources.push({
                  metadata: {
                    runtime: true,
                    scriptId: doc._id,
                    scriptHash: doc.compiledHash,
                    scriptExport,
                    className: cls.name,
                    methodName: method.name,
                    static: method.static,
                    loc: decorator.loc,
                    resource: ac.getResource()
                  },
                  ...def,
                  type: 'event'
                })

                break

              }

              // cron, principal, { cron, principal, environment, weight }
              case 'job': {

                let options = {},
                    def

                if (typeof decorator.params[0] === 'string') {
                  if (typeof decorator.params[1] === 'string') {
                    options = Object.assign(options, decorator.params[2], { cron: decorator.params[0], principal: decorator.params[1] })
                  } else {
                    options = Object.assign(options, decorator.params[1], { cron: decorator.params[0] })
                  }

                } else {
                  options = decorator.params[0] || {}
                }

                def = {
                  active: true,
                  label: `${cls.name}.${method.name}`,
                  ...pick(options, 'active', 'label', 'name', 'principal', 'environment', 'weight', 'if'),
                  configuration: {
                    cron: options.cron
                  }
                }

                if (writeAndValidate) {

                  const ScriptType = modules.db.models.getModelForType('script', 'job'),
                        script = new ScriptType({
                          _id: emptyId,
                          org: ac.orgId,
                          object: 'script',
                          type: 'job',
                          script: 'void 0',
                          compiled: 'void 0'
                        }),
                        opAc = new acl.AccessContext(ac.principal, script, { method: 'put' })

                  opAc.option('skip.validator:script.name', true)
                  await promised(script, 'aclWrite', opAc, def)
                  await promised(script, 'validateWithAc', opAc, {})

                  def = {
                    ...pick(script, 'active', 'type', 'label', 'name', 'principal', 'environment', 'weight', 'if'),
                    configuration: pick(script.configuration, 'cron')
                  }
                }

                resources.push({
                  metadata: {
                    runtime: true,
                    scriptId: doc._id,
                    scriptHash: doc.compiledHash,
                    scriptExport,
                    className: cls.name,
                    methodName: method.name,
                    static: method.static,
                    loc: decorator.loc,
                    resource: `${ac.org.code}.${ac.getResource()}`
                  },
                  ...def,
                  type: 'job'
                })

                break
              }

              case 'route': {

                // route -> config: authValidation, urlEncoded, plainText, apiKey, path, method, weight, acl
                let options = {},
                    def

                if (typeof decorator.params[0] === 'string') {
                  const [method, path] = decorator.params[0].split(' ')
                  options = Object.assign(options, decorator.params[1], { method, path })
                } else {
                  options = decorator.params[0] || {}
                }

                if (!isSet(options.acl)) {
                  options.acl = 'account.public'
                }

                const ScriptType = modules.db.models.getModelForType('script', 'route')

                def = {
                  active: true,
                  label: `${cls.name}.${method.name}`,
                  ...pick(options, 'active', 'label', 'name', 'principal', 'environment', 'weight', 'if'),
                  configuration: {
                    ...pick(options, 'authValidation', 'urlEncoded', 'plainText', 'apiKey', 'path', 'method', 'priority', 'acl', 'system')
                  }
                }

                if (writeAndValidate) {

                  const script = new ScriptType({
                          _id: emptyId,
                          org: ac.orgId,
                          object: 'script',
                          active: true,
                          type: 'route',
                          label: `${cls.name}.${method.name}`,
                          script: 'void 0',
                          compiled: 'void 0'
                        }),
                        opAc = new acl.AccessContext(ac.principal, script, { method: 'put' })

                  opAc.option('skip.validator:script.name', true)
                  opAc.option('skip.validator:script#route.configuration.method', true)
                  opAc.option('skip.validator:script#route.configuration.path', true)
                  await promised(script, 'aclWrite', opAc, def)
                  await promised(script, 'validateWithAc', opAc, {})

                  def = {
                    ...pick(script, 'active', 'type', 'label', 'name', 'principal', 'environment', 'weight', 'if'),
                    configuration: pick(script.configuration, 'authValidation', 'urlEncoded', 'plainText', 'apiKey', 'path', 'method', 'priority', 'acl', 'system')
                  }

                }

                resources.push({
                  metadata: {
                    runtime: true,
                    scriptId: doc._id,
                    scriptHash: doc.compiledHash,
                    scriptExport,
                    className: cls.name,
                    methodName: method.name,
                    static: method.static,
                    loc: decorator.loc,
                    resource: ac.getResource()
                  },
                  ...def,
                  type: 'route'
                })

                break
              }

            }

            ac.popResource()
          }

        }

      }

    } catch (err) {

      let fault = Fault.from(err, false, true)
      if (fault.errCode === 'cortex.invalidArgument.validation' && toArray(fault.faults).length) {
        fault = fault.faults[0]
      }
      fault.resource = ac.getResource()

      throw fault
    }

  }

  return resources

}

LibraryScriptType.prototype.buildRuntime = async function(ac, runtime, scripts) {

  // look for objects and libraries.
  for (const script of scripts) {

    const {
      library: libraries = [],
      object: objects = [],
      transform: transforms = [],
      env: envs = [],
      event: events = [],
      expression: expressions = [],
      pipeline: pipelines = []
    } = groupBy(toArray(script.resources), resource => resource.type)

    for (const insert of envs) {

      if (insert.active && matchesEnvironment(insert.environment)) {

        const pos = findIndex(runtime.envs, v => v.name === insert.name),
              existing = runtime.envs[pos]

        if (!existing) {
          runtime.envs.push(insert)
        } else if (rNum(insert.weight, 0) > rNum(existing.weight, 0)) {
          runtime.envs.splice(pos, 1, insert)
        }

      }
    }

    for (const insert of expressions) {

      if (insert.active && matchesEnvironment(insert.environment)) {

        const pos = findIndex(runtime.expressions, v => v.name === insert.name),
              existing = runtime.expressions[pos]

        if (!existing) {
          runtime.expressions.push(insert)
        } else if (rNum(insert.weight, 0) > rNum(existing.weight, 0)) {
          runtime.expressions.splice(pos, 1, insert)
        }

      }
    }

    for (const insert of pipelines) {

      if (insert.active && matchesEnvironment(insert.environment)) {

        const pos = findIndex(runtime.pipelines, v => v.name === insert.name),
              existing = runtime.pipelines[pos]

        if (!existing) {
          runtime.pipelines.push(insert)
        } else if (rNum(insert.weight, 0) > rNum(existing.weight, 0)) {
          runtime.pipelines.splice(pos, 1, insert)
        }

      }
    }

    for (const insert of events) {

      if (insert.active && matchesEnvironment(insert.environment)) {

        const pos = findIndex(runtime.events, v => v.name && v.name === insert.name),
              existing = runtime.events[pos]

        if (!existing) {
          runtime.events.push(insert)
        } else if (rNum(insert.weight, 0) > rNum(existing.weight, 0)) {
          runtime.events.splice(pos, 1, insert)
        }

      }
    }

    for (const insert of libraries) {

      if (insert.active && matchesEnvironment(insert.environment)) {

        const pos = findIndex(runtime.libraries, v => v.configuration.export === insert.configuration.export),
              existing = runtime.libraries[pos]

        if (!existing) {
          runtime.libraries.push(insert)
        } else if (rNum(insert.weight, 0) > rNum(existing.weight, 0)) {
          runtime.libraries.splice(pos, 1, insert)
        }

      }
    }

    for (const insert of objects) {

      if (insert.active && matchesEnvironment(insert.environment)) {

        const pos = findIndex(runtime.objects, v => v.name === insert.name),
              existing = runtime.objects[pos]

        if (!existing) {
          runtime.objects.push(insert)
        } else if (rNum(insert.weight, 0) > rNum(existing.weight, 0)) {
          runtime.objects.splice(pos, 1, insert)
        }

      }

    }

    for (const insert of transforms) {

      if (insert.active && matchesEnvironment(insert.environment)) {

        const pos = findIndex(runtime.transforms, v => v.name === insert.name),
              existing = runtime.transforms[pos]

        if (!existing) {
          runtime.transforms.push(insert)
        } else if (rNum(insert.weight, 0) > rNum(existing.weight, 0)) {
          runtime.transforms.splice(pos, 1, insert)
        }

      }

    }

  }

}

LibraryScriptType.prototype.getTypeProperties = function() {

  return [{
    label: 'Export Name',
    name: 'export',
    type: 'String',
    // description: 'A unique export name, that will become part of the global namespace of the including scripts. ie c_utils',
    dependencies: ['org'],
    nativeIndex: true,
    writable: true,
    writer: function(ac, node, value) {
      value = modules.validation.formatCustomName(ac.org.code, String(value), true, true)
      this.scriptHash = LibraryScriptType.calculateHash(ac.orgId, value)
      return value
    },
    validators: [{
      name: 'required'
    }, {
      name: 'customName',
      definition: {
        min: 1,
        max: 40
      }
    }, {
      name: 'adhoc',
      definition: {
        code: 'cortex.conflict.exists',
        message: 'A unique export name.',
        validator: function(ac, node, v, callback) {

          var find = { org: ac.orgId, object: 'script', type: 'library', reap: false, 'configuration.export': v },
              root = modules.db.getRootDocument(this)

          if (!root.isNew) {
            find._id = { $ne: root._id }
          }

          ac.object.findOne(find).lean().select('_id').exec(function(err, doc) {
            callback(err, !(err || doc))
          })
        },
        skip: function(ac, node) {
          return ac.option(`skip.validator:${node.fqpp}`)
        }
      }
    }]
  }]

}

module.exports = LibraryScriptType
