'use strict'

const Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      logger = require('cortex-service/lib/logger'),
      utils = require('../../../../utils'),
      acl = require('../../../../acl'),
      async = require('async'),
      _ = require('underscore'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      transpiler = modules.services.transpiler,
      util = require('util'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      local = {
        _definitions: null
      },

      types = consts.deployment.mapping.types,

      // this is brittle. dependencies force this order.
      orderedTypekeys = [
        types.config,
        types.account,
        types.sms,
        types.role,
        types.serviceAccount, // depends on role
        types.template,
        types.app, // depends on account
        types.notification, // depends on template
        types.object, // depends on account, role
        types.script, // depends on account, role, object, app
        types.view, // depends on account, role, object
        types.policy // depends on account, role, script, app
      ]

Object.defineProperty(local, 'definitions', { get: function() { return (this._definitions || (this._definitions = require('../index'))) } })

function deploymentOption(label, name, validator, otherProperties, type = 'ObjectId') {

  return {
    label: label,
    name: name,
    type: 'Document',
    writable: true,
    dependencies: ['configuration'],
    properties: [{
      label: 'Select',
      name: 'select',
      type: 'Number',
      writable: true,
      default: consts.deployment.selections.all,
      validators: [{
        name: 'required'
      }, {
        name: 'numberEnum',
        definition: {
          values: _.values(consts.deployment.selections)
        }
      }]
    }, {
      label: 'Ids',
      name: 'ids',
      type,
      writable: true,
      array: true,
      uniqueValues: true,
      canPush: false,
      canPull: false,
      validators: [{
        name: 'adhoc',
        definition: {
          asArray: true,
          validator: validator
        }
      }]
    }].concat(otherProperties ? utils.array(otherProperties, true) : [])
  }

}

// ---------------------------------------------------------------------------------------------------------------------

function DeploymentDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(DeploymentDefinition, BuiltinContextModelDefinition)

DeploymentDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = DeploymentDefinition.statics
  options.methods = DeploymentDefinition.methods
  options.indexes = DeploymentDefinition.indexes
  options.options = { collection: DeploymentDefinition.collection }
  options.apiHooks = DeploymentDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

DeploymentDefinition.collection = 'contexts'

DeploymentDefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {

  BuiltinContextModelDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, path, options)
  selections.target = true
  selections.stage = true

}

DeploymentDefinition.prototype.getNativeOptions = function() {

  return {
    hasCreator: false,
    hasOwner: false,
    _id: consts.NativeIds.deployment,
    objectLabel: 'Deployment',
    objectName: 'deployment',
    pluralName: 'deployments',
    collection: 'contexts',
    isExtensible: false,
    auditing: {
      enabled: true,
      all: true,
      category: 'deployment'
    },
    isFavoritable: false,
    obeyObjectMode: false,
    defaultAclOverride: false,
    defaultAclExtend: false,
    shareChainOverride: false,
    shareAclOverride: false,
    allowConnections: false,
    allowConnectionsOverride: false,
    allowConnectionOptionsOverride: false,
    requiredAclPaths: ['_id'],
    defaultAcl: [
      { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Delete : acl.AccessLevels.Read) },
      { type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Delete }
    ],
    createAclOverwrite: false,
    createAclExtend: false,
    createAcl: config('app.env') === 'development'
      ? [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Min }]
      : [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }],
    shareChain: [],
    properties: [
      {
        label: 'Label',
        name: 'label',
        type: 'String',
        writable: true,
        nativeIndex: true,
        trim: true,
        validators: [{
          name: 'required'
        }, {
          name: 'string',
          definition: {
            min: 1,
            max: 100
          }
        }]
      },
      {
        label: 'Description',
        name: 'description',
        type: 'String',
        writable: true,
        trim: true,
        nativeIndex: true,
        default: '',
        validators: [{
          name: 'string',
          definition: {
            min: 0,
            max: 512
          }
        }]
      },
      {
        label: 'Target',
        name: 'target',
        type: 'ObjectId',
        writable: true,
        dependencies: ['mappings'],
        validators: [{
          name: 'required'
        }, {
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value) {
              const target = utils.findIdInArray(utils.array(utils.path(ac.org.deployment, 'targets')), '_id', value)
              if (!target) {
                throw Fault.create('cortex.notFound.unspecified', { reason: 'The target does not exist.' })
              }
              if (!~['Active', 'Pending'].indexOf(target.state)) {
                throw Fault.create('cortex.invalidArgument.inactiveDeploymentTarget')
              }
              return true
            }
          }
        }]
      },
      {
        label: 'Close Output Streams',
        name: 'closeOutputStreams',
        type: 'Boolean',
        writable: true,
        default: false
      },
      {
        label: 'Close After Seconds',
        name: 'outputStreamsGracePeriodSeconds',
        type: 'Number',
        writable: true,
        default: 10,
        validators: [
          {
            name: 'required'
          },
          {
            name: 'number',
            definition: {
              min: 0,
              max: 120,
              allowDecimal: false
            }
          }
        ]
      },
      {
        label: 'Give Up Seconds',
        name: 'giveUpSeconds',
        type: 'Number',
        writable: true,
        default: 60,
        validators: [
          {
            name: 'required'
          },
          {
            name: 'number',
            definition: {
              min: 0,
              max: 120,
              allowDecimal: false
            }
          }
        ]
      },
      {
        label: 'Configuration',
        name: 'configuration',
        type: 'Document',
        writable: true,
        dependencies: ['mappings', 'target'],
        properties: [

          deploymentOption('Scripts', consts.deployment.mapping.types.script, (ac, node, values, callback) => {
            if (values.length === 0) {
              return callback(null, true)
            }
            modules.db.models.Script.find({ _id: { $in: values }, org: ac.orgId, object: 'script' }).lean().select('_id').exec((err, docs) => {
              if (!err) {
                if (utils.intersectIdArrays(values, docs.map(doc => doc._id)).length < values.length) {
                  err = Fault.create('cortex.notFound.unspecified', { reason: 'One or more scripts do not exist.' })
                }
              }
              callback(err)
            })
          }),

          deploymentOption('Roles', consts.deployment.mapping.types.role, (ac, node, values) => {
            if (utils.intersectIdArrays(values, utils.array(ac.org.roles).map(role => role._id)).length < values.length) {
              throw Fault.create('cortex.notFound.unspecified', { reason: 'One or more roles do not exist.' })
            }
            return true
          }),

          deploymentOption('Service Accounts', consts.deployment.mapping.types.serviceAccount, (ac, node, values) => {
            if (utils.intersectIdArrays(values, utils.array(ac.org.serviceAccounts).map(serviceAccount => serviceAccount._id)).length < values.length) {
              throw Fault.create('cortex.notFound.unspecified', { reason: 'One or more service accounts do not exist.' })
            }
            return true
          }),

          deploymentOption('Policies', consts.deployment.mapping.types.policy, (ac, node, values) => {
            if (utils.intersectIdArrays(values, utils.array(ac.org.policies).map(policy => policy._id)).length < values.length) {
              throw Fault.create('cortex.notFound.unspecified', { reason: 'One or more policies do not exist.' })
            }
            return true
          }),

          deploymentOption('Views', consts.deployment.mapping.types.view, (ac, node, values, callback) => {
            if (values.length === 0) {
              return callback(null, true)
            }
            modules.db.models.View.find({ _id: { $in: values }, org: ac.orgId, object: 'view' }).lean().select('_id').exec((err, docs) => {
              if (!err) {
                if (utils.intersectIdArrays(values, docs.map(doc => doc._id)).length < values.length) {
                  err = Fault.create('cortex.notFound.unspecified', { reason: 'One or more views do not exist.' })
                }
              }
              callback(err)
            })
          }),

          deploymentOption('Objects', consts.deployment.mapping.types.object, (ac, node, values, callback) => {
            if (values.length === 0) {
              return callback(null, true)
            }
            modules.db.models.Object.find({ lookup: { $in: values }, org: ac.orgId, object: 'object' }).lean().select('lookup').exec((err, docs) => {
              if (!err) {
                if (utils.intersectIdArrays(values, docs.map(doc => doc.lookup)).length < values.length) {
                  err = Fault.create('cortex.notFound.unspecified', { reason: 'One or more objects do not exist.' })
                }
              }
              callback(err)
            })
          }),

          deploymentOption('Notifications', consts.deployment.mapping.types.notification, (ac, node, values) => {

            // remove all the built-in values before comparing because some built-in items may not have preferences saved.
            values = values.filter(_id => !consts.Notifications.TypeMap[_id])

            if (utils.intersectIdArrays(values, utils.array(utils.path(ac.org.configuration, 'notifications')).map(n => n._id)).length < values.length) {
              throw Fault.create('cortex.notFound.unspecified', { reason: 'One or more notifications do not exist.' })
            }
            return true
          }),

          deploymentOption('Sms Numbers', consts.deployment.mapping.types.sms, (ac, node, values) => {
            if (utils.intersectIdArrays(values, utils.array(utils.path(ac.org.configuration, 'sms.numbers')).map(n => n._id)).length < values.length) {
              throw Fault.create('cortex.notFound.unspecified', { reason: 'One or more notifications do not exist.' })
            }
            return true
          }),

          deploymentOption('Configuration', consts.deployment.mapping.types.config, (ac, node, values, callback) => {
            modules.config.keys(ac.org, (err, keys) => {
              if (!err && _.intersection(keys, values).length < values.length) {
                err = Fault.create('cortex.notFound.unspecified', { reason: 'One or more configuration keys do not exist.' })
              }
              callback(err, true)
            })
          }, null, 'String'),

          deploymentOption('Apps', consts.deployment.mapping.types.app, (ac, node, values) => {
            if (utils.intersectIdArrays(values, utils.array(ac.org.apps).map(n => n._id)).length < values.length) {
              throw Fault.create('cortex.notFound.unspecified', { reason: 'One or more apps do not exist.' })
            }
            return true
          }, [{
            label: 'Preserve Certificates',
            name: 'preserveCerts',
            type: 'Boolean',
            writable: true,
            default: true,
            validators: [{ name: 'required' }]
          }]),

          deploymentOption('Templates', consts.deployment.mapping.types.template, (ac, node, values, callback) => {
            if (values.length === 0) {
              return callback(null, true)
            }
            modules.db.models.Template.find({ _id: { $in: values }, org: ac.orgId, locale: { $in: [ null, [] ] } }).lean().select('_id').exec((err, docs) => {
              if (!err) {
                if (utils.intersectIdArrays(values, docs.map(doc => doc._id)).length < values.length) {
                  err = Fault.create('cortex.notFound.unspecified', { reason: 'One or more templates do not exist.' })
                }
              }
              callback(err)
            })
          })

        ]
      },
      {
        label: 'Stage',
        name: 'stage',
        type: 'String',
        default: 'Configuration',
        stub: 'Configuration'
      },
      {
        label: 'Last Deployed',
        name: 'lastDeployed',
        type: 'Date',
        default: null,
        writable: true,
        writeAccess: acl.AccessLevels.System
      },
      {
        label: 'Last Deployment Run',
        name: 'lastRunId',
        type: 'ObjectId',
        default: null,
        writable: true,
        writeAccess: acl.AccessLevels.System
      },
      {
        label: 'Last Deployer',
        name: 'lastDeployer',
        type: 'ObjectId',
        default: null,
        writable: true,
        writeAccess: acl.AccessLevels.System
      },
      {
        label: 'Last Deployment Result',
        name: 'lastRunResult',
        type: 'Any',
        serializeData: false,
        default: null,
        writable: true,
        writeAccess: acl.AccessLevels.System
      },
      {
        label: 'Current isSupportLogin',
        name: 'isSupportLogin',
        type: 'Boolean',
        default: false,
        writable: true,
        readAccess: acl.AccessLevels.System,
        writeAccess: acl.AccessLevels.System
      },
      {
        label: 'Current Session Data',
        name: 'session',
        type: 'Any',
        serializeData: true,
        maxSize: config('deploy.sessionDataMaxBytes'),
        writable: true,
        readAccess: acl.AccessLevels.System,
        writeAccess: acl.AccessLevels.System
      },
      {
        label: 'Refresh',
        name: 'refreshMappings',
        type: 'Boolean',
        default: false,
        optional: true,
        writable: true,
        dependencies: ['mappings', 'configuration'],
        readAccess: acl.AccessLevels.System,
        writeAccess: acl.AccessLevels.System
      },
      {
        label: 'Mappings',
        name: 'mappings',
        type: 'Set',
        array: true,
        optional: true,
        discriminatorKey: 'type',
        canPush: false,
        canPull: false,
        writable: true,
        maxItems: -1,
        updateAccess: acl.AccessLevels.Update,
        writeAccess: acl.AccessLevels.System,
        dependencies: ['configuration', 'target', 'stage'],
        documents: modules.db.definitions.createDeploymentMappings()
      }, {
        label: 'Scripts',
        name: 'scripts',
        type: 'Document',
        readable: true,
        writable: true,
        properties: [{
          label: 'Before Script',
          name: 'before',
          type: 'String',
          readable: true,
          writable: true,
          trim: true,
          validators: [{
            name: 'adhoc',
            definition: {
              validator: function(ac, node, source) {
                let maxLen = utils.rInt(ac.org.configuration.scripting.maxScriptSize, 1024 * 50)
                if (!_.isString(source) || source.length > maxLen) {
                  throw Fault.create('cortex.invalidArgument.maxScriptLength', { reason: `Your script exceeds the maximum length of ${maxLen} by ${source.length - maxLen}` })
                }
                return true
              }
            }
          }, {
            name: 'adhoc',
            definition: {
              message: 'A valid script.',
              validator: function(ac, node, source, callback) {
                transpiler.transpile(source, { language: 'javascript', specification: 'es6' }, (err, result) => {
                  callback(err, utils.path(result, 'source'))
                })
              }
            }
          }]
        }, {
          label: 'After Script',
          name: 'after',
          type: 'String',
          readable: true,
          writable: true,
          trim: true,
          validators: [{
            name: 'adhoc',
            definition: {
              validator: function(ac, node, source) {
                let maxLen = utils.rInt(ac.org.configuration.scripting.maxScriptSize, 1024 * 50)
                if (!_.isString(source) || source.length > maxLen) {
                  throw Fault.create('cortex.invalidArgument.maxScriptLength', { reason: `Your script exceeds the maximum length of ${maxLen} by ${source.length - maxLen}` })
                }
                return true
              }
            }
          }, {
            name: 'adhoc',
            definition: {
              message: 'A valid script.',
              validator: function(ac, node, source, callback) {
                transpiler.transpile(source, { language: 'javascript', specification: 'es6' }, (err, result) => {
                  callback(err, utils.path(result, 'source'))
                })
              }
            }
          }]
        }, {
          label: 'Rollback Script',
          name: 'rollback',
          type: 'String',
          readable: true,
          writable: true,
          trim: true,
          validators: [{
            name: 'adhoc',
            definition: {
              validator: function(ac, node, source) {
                let maxLen = utils.rInt(ac.org.configuration.scripting.maxScriptSize, 1024 * 50)
                if (!_.isString(source) || source.length > maxLen) {
                  throw Fault.create('cortex.invalidArgument.maxScriptLength', { reason: `Your script exceeds the maximum length of ${maxLen} by ${source.length - maxLen}` })
                }
                return true
              }
            }
          }, {
            name: 'adhoc',
            definition: {
              message: 'A valid script.',
              validator: function(ac, node, source, callback) {
                transpiler.transpile(source, { language: 'javascript', specification: 'es6' }, (err, result) => {
                  callback(err, utils.path(result, 'source'))
                })
              }
            }
          }]
        }, {
          label: 'Local Result Post Deployment Script',
          name: 'result',
          type: 'String',
          readable: true,
          writable: true,
          trim: true,
          validators: [{
            name: 'adhoc',
            definition: {
              validator: function(ac, node, source) {
                let maxLen = utils.rInt(ac.org.configuration.scripting.maxScriptSize, 1024 * 50)
                if (!_.isString(source) || source.length > maxLen) {
                  throw Fault.create('cortex.invalidArgument.maxScriptLength', { reason: `Your script exceeds the maximum length of ${maxLen} by ${source.length - maxLen}` })
                }
                return true
              }
            }
          }, {
            name: 'adhoc',
            definition: {
              message: 'A valid script.',
              validator: function(ac, node, source, callback) {
                transpiler.transpile(source, { language: 'javascript', specification: 'es6' }, (err, result) => {
                  callback(err, utils.path(result, 'source'))
                })
              }
            }
          }]
        }]
      }
    ]
  }

}

// shared methods --------------------------------------------------------

DeploymentDefinition.methods = {

  generateSourceMappings: function(ac, callback) {

    // empty and restart mappings.
    if (this.mappings.length) {
      this.mappings.splice(0, this.mappings.length)
    }

    const sourceMap = {},
          loadIntoSourceMap = (selections, selected, callback) => {
            async.eachSeries(Object.keys(modules.db.definitions.mappingDefinitions),
              (key, callback) => {
                const type = modules.db.definitions.mappingDefinitions[key]
                type.getSourceMappingDocs(ac, selections[key] || {}, (err, docs) => {
                  if (!err) {
                    docs.forEach(doc => {
                      sourceMap[doc._id] = {
                        type: type,
                        doc: doc,
                        mapping: type.addStubMapping(ac, type, this.mappings, doc, selected)
                      }
                    })
                  }
                  setImmediate(callback, err)
                })
              },
              callback
            )

          }

    async.series([

      // load source mapping docs and add to the sourceMap and stub mappings.
      callback => {

        loadIntoSourceMap(this.configuration, true, callback)

      },

      // while there are unsatisfied dependencies, collect
      callback => {

        let missing = {}, errs = []

        async.whilst(

          // locate missing dependencies in sourceMap and organize into types.
          () => {
            let count = 0
            missing = Object.keys(sourceMap).reduce(
              (missing, key) => {
                sourceMap[key].mapping.dependencies.forEach(dep => {
                  if (!sourceMap[dep._id]) {
                    count++
                    if (!missing[dep.type]) {
                      missing[dep.type] = {
                        ids: [],
                        select: consts.deployment.selections.include
                      }
                    }
                    if (!utils.inIdArray(missing[dep.type].ids, dep._id)) {
                      if (dep._id === null) {
                        errs.push(Fault.create('cortex.notFound.unspecified', {
                          reason: ['Null dependency for', dep.type, 'in', sourceMap[key].type.mappingTypeName, key].join(' ')
                        }))
                      }
                      missing[dep.type].ids.push(dep._id)
                    }
                  }
                })
                return missing
              }, {}
            )
            return count > 0
          },

          // load mapping documents.
          callback => {

            loadIntoSourceMap(missing, false, err => {

              if (!err) {

                // if there are any unsatisfied dependencies, halt and inform the user.
                const unsatisfied = Object.keys(missing).reduce(
                  (unsatisfied, key) =>
                    unsatisfied.concat(missing[key].ids.filter(id => !sourceMap[id]))
                  , [])

                // find the items that depend on it for a little bit of extra info for the caller.
                if (unsatisfied.length) {
                  err = Fault.create('cortex.invalidArgument.validation', { reason: 'Missing deployment dependencies' })
                  errs.forEach(f => err.add(f))
                  Object.keys(sourceMap).forEach(key => {
                    sourceMap[key].mapping.dependencies.forEach(dep => {
                      if (utils.inIdArray(unsatisfied, dep._id)) {
                        err.add(Fault.create('cortex.notFound.unspecified', {
                          reason: ['Missing dependency', dep._id, 'for', sourceMap[key].type.mappingTypeName, key].join(' ')
                        }))
                      }
                    })
                  })
                }

              }

              setImmediate(callback, err)
            })
          },

          callback
        )
      },

      // update each stub mapping with data from the documents. dependencies are now all fully loaded.
      callback => {
        setImmediate(() => {
          Object.keys(sourceMap).forEach(key => {
            const entry = sourceMap[key]
            entry.type.updateMapping(ac, this.mappings, entry.mapping.source, entry.doc)
          })
          callback()
        })
      }

    ], callback)
  },

  updateTargetMappings: function(ac, callback) {

    async.series([
      callback => {
        async.eachSeries(
          Object.keys(modules.db.definitions.mappingDefinitions),
          (key, callback) => {
            const mappings = this.mappings.filter(mapping => mapping.type === key && mapping.target == null)
            if (mappings.length === 0) {
              return callback()
            }
            modules.db.definitions.mappingDefinitions[key].matchSourceMappings(
              ac,
              this,
              mappings,
              err => setImmediate(callback, err)
            )
          },
          callback
        )
      }
    ], callback)

  },

  getDeploymentPayload: function(ac, callback) {

    if (this.stage !== 'Deployment') {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid deployment stage (' + (this.stage || 'Configuration') + ')' }))
    }
    if (!this.isSelected('mappings')) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Mappings have not been loaded' }))
    }
    if (_.some(this.mappings, mapping => mapping.target == null)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Some mappings remain unresolved.' }))
    }

    const payload = this.toObject()

    // remove targets
    payload.mappings.forEach(mapping => delete mapping.targets)

    payload.settings = {
      // @todo org settings here.
    }

    async.eachSeries(
      Object.keys(modules.db.definitions.mappingDefinitions),
      (key, callback) => {
        const mappings = payload.mappings.filter(mapping => mapping.type === key)
        if (mappings.length === 0) {
          return callback()
        }
        modules.db.definitions.mappingDefinitions[key].getDeploymentPayload(
          ac,
          this,
          this.configuration[key],
          mappings,
          err => setImmediate(callback, err))
      },
      err => setImmediate(callback, err, payload)
    )

  },

  validateForTarget(ac, callback) {

    async.eachSeries(
      orderedTypekeys,
      (key, callback) => {
        const mappings = ac.subject.mappings.filter(mapping => mapping.type === key)
        if (mappings.length === 0) {
          return callback()
        }
        modules.db.definitions.mappingDefinitions[key].validateForTarget(ac, this, this.configuration[key], mappings, callback)
      },
      callback
    )

  },

  deploy(ac, callback) {

    async.eachSeries(
      orderedTypekeys,
      (key, callback) => {
        const mappings = ac.subject.mappings.filter(mapping => mapping.type === key)
        if (mappings.length === 0) {
          return callback()
        }
        modules.db.definitions.mappingDefinitions[key].deploy(ac, this, this.configuration[key], mappings, callback)
      },
      err => {

        if (err) logger.error('[deploy]', utils.toJSON(err, { stack: true }))

        ac.apiHooks.fire(this, 'deploy.after', err, { ac: ac, deployment: this }, () => {
          callback(err)
        })
      }
    )

  }

}

// shared statics --------------------------------------------------------

DeploymentDefinition.statics = {

  createBackup: function(ac, callback) {

    const backup = {}

    // @todo backup org settings that get modified.

    async.eachSeries(
      Object.keys(modules.db.definitions.mappingDefinitions),
      (key, callback) => {
        modules.db.definitions.mappingDefinitions[key].createBackup(ac, (err, data) => {
          if (!err && data) {
            backup[key] = data
          }
          callback(err)
        })
      },
      err => {
        if (err) {
          return callback(err)
        }
        modules.deployment.zipPayload(backup, callback)
      }
    )

  },

  rollback: function(ac, backup, callback) {

    // @todo rollback org settings that get modified.

    modules.deployment.unzipPayload(backup, (err, data) => {
      if (err) {
        return callback(err)
      }
      async.eachSeries(
        Object.keys(modules.db.definitions.mappingDefinitions),
        (key, callback) => {
          modules.db.definitions.mappingDefinitions[key].rollback(ac, data, data[key], callback)
        },
        callback
      )
    })

  },

  aclInit: function() {

    modules.db.models.Object.hook('delete').after((vars, callback) => {
      this.collection.updateMany({ org: vars.ac.orgId, object: 'deployment' }, { $pull: { mappings: { _id: vars.ac.subject.lookup } } }, callback)
    })

    modules.db.models.View.hook('delete').after((vars, callback) => {
      this.collection.updateMany({ org: vars.ac.orgId, object: 'deployment' }, { $pull: { mappings: { _id: vars.ac.subjectId } } }, callback)
    })

    modules.db.models.Script.hook('delete').after((vars, callback) => {
      this.collection.updateMany({ org: vars.ac.orgId, object: 'deployment' }, { $pull: { mappings: { _id: vars.ac.subjectId } } }, callback)
    })

    modules.db.models.Org.hook('app.removed').after((vars, callback) => {
      this.collection.updateMany({ org: vars.ac.orgId, object: 'deployment' }, { $pull: { mappings: { _id: vars.appId } } }, callback)
    })

    modules.db.models.Org.hook('policy.removed').after((vars, callback) => {
      this.collection.updateMany({ org: vars.ac.orgId, object: 'deployment' }, { $pull: { mappings: { _id: vars.policyId } } }, callback)
    })

    modules.db.models.Org.hook('role.removed').after((vars, callback) => {
      this.collection.updateMany({ org: vars.ac.orgId, object: 'deployment' }, { $pull: { mappings: { _id: vars.roleId } } }, callback)
    })

    modules.db.models.Org.hook('serviceAccount.removed').after((vars, callback) => {
      this.collection.updateMany({ org: vars.ac.orgId, object: 'deployment' }, { $pull: { mappings: { _id: vars.serviceAccountId } } }, callback)
    })

    modules.db.models.Org.hook('notification.removed').after((vars, callback) => {
      this.collection.updateMany({ org: vars.ac.orgId, object: 'deployment' }, { $pull: { mappings: { _id: vars.notificationId } } }, callback)
    })

    modules.db.models.Org.hook('sms-number.removed').after((vars, callback) => {
      this.collection.updateMany({ org: vars.ac.orgId, object: 'deployment' }, { $pull: { mappings: { _id: vars.numberId } } }, callback)
    })

    modules.db.models.Template.hook('delete').after((vars, callback) => {
      this.collection.updateMany({ org: vars.template.org, object: 'deployment' }, { $pull: { mappings: { _id: vars.template._id } } }, callback)
    })

  }

}

// shared hooks  ---------------------------------------------------------

DeploymentDefinition.apiHooks = [{
  name: 'save',
  before: function(vars, callback) {

    const doc = vars.ac.subject,
          modified = doc.modifiedPaths()

    // only update if the target changes or we edit something that affects mappings.
    let shouldRemap = ~modified.indexOf('target') || doc.refreshMappings
    if (!shouldRemap) {
      Object.keys(modules.db.definitions.mappingDefinitions).forEach(key => {
        shouldRemap = shouldRemap || modules.db.definitions.mappingDefinitions[key].shouldRemap(vars.ac, doc, doc.configuration[key], modified)
      })
    }

    doc.refreshMappings = undefined // don't actually write this as it's just a mechanism for forcing a refresh

    if (shouldRemap) {
      doc.generateSourceMappings(vars.ac, err => {
        if (!err) {
          doc.stage = 'Source Mappings'
        }
        callback(err)
      })
      return
    }

    if (_.intersection(modified, ['mappings']).length) {
      if (_.every(
        doc.mappings,
        mapping => {
          // special case for non-concrete mappings (they don't get copied and are only there to satisfy local dependencies)
          if (mapping.type === consts.deployment.mapping.types.object && !mapping.source.concrete) {
            return true
          }
          return mapping.target != null
        }
      )) {
        doc.stage = 'Deployment'
      }
    }
    callback()
  }
}]
// exports --------------------------------------------------------

module.exports = DeploymentDefinition
