'use strict'

const utils = require('../../../../utils'),
      BaseMapping = require('../base-mapping-definition'),
      async = require('async'),
      clone = require('clone'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      acl = require('../../../../acl'),
      ap = require('../../../../access-principal'),
      Fault = require('cortex-service/lib/fault'),
      _ = require('underscore')

class Mapping extends BaseMapping {

  get mappingTypeName() {
    return consts.deployment.mapping.types.script
  }

  rollback(ac, backup, data, callback) {

    modules.db.models.Script.deleteMany({ org: ac.orgId, object: 'script' }).exec(err => {
      if (err) return callback(err)
      async.eachSeries(
        data,
        (doc, callback) => {
          modules.db.models.Script.collection.insertOne(doc, { writeConcern: { w: 'majority' } }, callback)
        },
        callback
      )
    })
  }

  createBackup(ac, callback) {
    modules.db.models.Script.find({ org: ac.orgId, object: 'script' }).lean().exec(callback)
  }

  validateForTarget(ac, deploymentObject, mappingConfig, filteredMappings, callback) {
    callback()
  }

  deploy(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    const Script = modules.db.models.script

    async.waterfall([

      // load a fresh org for the roles we need.
      callback => {
        modules.db.models.Org.loadOrg(ac.orgId, { cache: false }, callback)
      },

      // load a fresh principal
      (org, callback) => {
        ap.create(org, ac.principal.email, (err, principal) => {
          callback(err, principal)
        })
      },

      // load fresh scripts
      (principal, callback) => {
        Script.aclList(ac.principal, { include: ['did'], allowSystemAccessToParserProperties: true, skipParserIndexChecks: true, relaxParserLimits: true, limit: false, allowNoLimit: true, skipAcl: true, json: false, grant: acl.AccessLevels.System }, (err, existing) => {
          callback(err, principal, utils.path(existing, 'data'))
        })
      },

      // create/update each mapping
      (principal, existing, callback) => {

        async.eachSeries(filteredMappings, (mapping, callback) => {

          let targetId = mapping.target,
              create = utils.equalIds(targetId, consts.emptyId),
              source = mapping.get('payload'),
              payload = clone(source),
              target = create ? null : utils.findIdInArray(existing, '_id', targetId)

          if (!create && !target) {
            return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target script: ' + mapping.source.label }))
          }

          if (!target) {
            const Model = modules.db.models.getModelForType('script', source.type)
            target = new Model()
            target.org = ac.orgId
            target.object = Script.objectName
            target.did = [source._id]
            target.type = Model.objectTypeName
          } else {
            target.did.addToSet(source._id)
          }

          target.creator = { _id: ac.principalId }
          target.owner = { _id: ac.principalId }
          target.updater = source.updater ? { _id: ac.principalId } : undefined
          target.updated = source.updated
          target.created = source.created
          target.compiled = source.compiled || undefined

          // map principals
          payload.principal = payload.principal || null
          if (payload.principal && !acl.isBuiltInPrincipal(payload.principal)) {

            let targetPrincipalId = utils.path(this.findMapping(payload.principal, deploymentObject.mappings, [consts.deployment.mapping.types.account, consts.deployment.mapping.types.role, consts.deployment.mapping.types.serviceAccount]), 'target')
            if (utils.equalIds(consts.emptyId, targetPrincipalId)) {
              // must have created a new role or service account. look for it.
              targetPrincipalId = utils.path(principal.org.serviceAccounts.find(sa => utils.inIdArray(sa.did, payload.principal)), '_id') ||
                utils.path(principal.org.roles.find(role => utils.inIdArray(role.did, payload.principal)), '_id')

            }
            payload.principal = targetPrincipalId
            if (!payload.principal) {
              return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing script mapping target principal: ' + mapping.source.label }))
            }
          }

          const scriptAC = new acl.AccessContext(principal, target, { method: 'put', req: ac.req, grant: acl.AccessLevels.System })
          scriptAC.option('sandbox.logger.source', consts.logs.sources.deployment)
          scriptAC.option('deferSyncEnvironment', true)

          // tidy up the payload
          payload = _.pick(payload, 'label name description active principal script configuration language optimized'.split(' '))

          switch (source.type) {
            case 'job':
              payload.configuration = _.pick(payload.configuration, 'name', 'cron')
              break
            case 'library':
              payload.configuration = _.pick(payload.configuration, 'name', 'export')
              break
            case 'route':
              payload.configuration = _.pick(payload.configuration, 'name', 'urlEncoded', 'plainText', 'path', 'method', 'priority', 'acl', 'apiKey')
              payload.configuration.acl = this.mapAclToTarget(principal.org, deploymentObject.mappings, payload.configuration.acl, true)
              payload.configuration.apiKey = utils.path(this.findMapping(payload.configuration.apiKey, deploymentObject.mappings, consts.deployment.mapping.types.app), 'target') || null
              break
            case 'trigger':
              payload.configuration = _.pick(payload.configuration, 'name', 'object', 'event', 'inline')
              break
            default:
              return callback()
          }

          target.aclWrite(scriptAC, payload, err => {
            if (err) {
              callback(err)
            } else {
              scriptAC.save(callback)
            }
          })

        }, callback)

      }

    ], callback)

  }

  getDependencies(ac, doc) {

    const dependencies = {}

    if (doc.principal && !acl.isBuiltInPrincipal(doc.principal)) {
      dependencies[doc.principal] = consts.deployment.mapping.types[utils.findIdInArray(ac.org.roles, '_id', doc.principal) ? 'role' : utils.findIdInArray(ac.org.serviceAccounts, '_id', doc.principal) ? 'serviceAccount' : 'account']
    }

    utils.array(doc.serviceAccounts).forEach(serviceAccountName => {

      const serviceAccountId = utils.path(ac.org.serviceAccounts.find(sa => sa.name === serviceAccountName), '_id')
      if (serviceAccountId) {
        dependencies[serviceAccountId] = consts.deployment.mapping.types.serviceAccount
      }

    })

    utils.array(doc.requires).forEach(req => { dependencies[req] = consts.deployment.mapping.types.script })

    switch (doc.type) {
      case 'job':
      case 'library':
        break
      case 'route':
        {
          this._addAclDependencies(utils.path(doc, 'configuration.acl'), dependencies)
          const apiKey = utils.path(doc, 'configuration.apiKey')
          if (apiKey) {
            dependencies[apiKey] = consts.deployment.mapping.types.app
          }
        }
        break
      case 'trigger':
        {
          const objectId = modules.db.definitions.cachedObjectNameToId(ac.org, utils.path(doc, 'configuration.object'))
          if (objectId) {
            dependencies[objectId] = consts.deployment.mapping.types.object
          }
        }
        break
    }
    return _.map(dependencies, (type, _id) => ({ _id: utils.getIdOrNull(_id), type: type }))

  }

  updateMapping(ac, mappings, mapping, doc) {

    mapping.label = doc.label
    mapping.type = doc.type
    mapping.name = doc.name

    switch (doc.type) {
      case 'job':
        break
      case 'route':
        mapping.configuration.path = utils.path(doc, 'configuration.path')
        mapping.configuration.method = utils.path(doc, 'configuration.method')
        mapping.configuration.apiKey = utils.path(doc, 'configuration.apiKey')
        break
      case 'trigger':
        mapping.configuration.object = modules.db.definitions.cachedObjectToName(ac.org, utils.path(doc, 'configuration.object'))
        mapping.configuration.event = utils.path(doc, 'configuration.event')
        break
      case 'library':
        mapping.configuration.export = utils.path(doc, 'configuration.export')
        break
    }

  }

  getDeploymentPayload(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    var scriptIds = filteredMappings.map(mapping => mapping._id)
    if (scriptIds.length === 0) {
      return callback()
    }

    modules.db.models.Script.aclList(ac.principal, { allowSystemAccessToParserProperties: true, skipParserIndexChecks: true, relaxParserLimits: true, limit: false, allowNoLimit: true, where: { _id: { $in: scriptIds } }, skipAcl: true, json: true, grant: acl.AccessLevels.System }, (err, scripts) => {

      if (!err) {
        try {
          filteredMappings.forEach(mapping => {
            const script = utils.findIdInArray(scripts.data, '_id', mapping._id)
            if (!script) {
              throw Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source script: ' + mapping.source.label })
            }
            // never carry internals to another environment.
            delete script.bytecode
            delete script.bytecodeVersion
            delete script.resources
            mapping.payload = script
          })
        } catch (e) {
          err = e
        }
      }
      callback(err)
    })

  }

  matchSourceMappings(ac, deploymentObject, filteredMappings, callback) {

    const paths = ['did', 'label', 'type', 'configuration', 'name'],
          addTarget = (mapping, match, type) => {
            const existing = utils.findIdInArray(mapping.targets, '_id', match._id)
            if (existing) {
              if (existing.matchType === type) {
                return
              }
            }
            mapping.targets.push(utils.extend({ matchType: type }, match))
          }

    modules.db.models.Script.aclList(ac.principal, { allowSystemAccessToParserProperties: true, skipParserIndexChecks: true, relaxParserLimits: true, limit: false, allowNoLimit: true, paths: paths, skipAcl: true, json: true, grant: acl.AccessLevels.System }, (err, docs) => {

      if (!err) {

        // convert trigger objects to names for comparison.
        docs.data.forEach(doc => {
          if (doc.type === 'trigger') {
            doc.configuration.object = modules.db.definitions.cachedObjectToName(ac.org, doc.configuration.object)
          }
        })

        filteredMappings.forEach(mapping => {

          mapping.targets.splice(0)

          // script type can never change so this is fine.
          docs.data.filter(doc => utils.inIdArray(doc.did, mapping._id)).forEach(match => {
            addTarget(mapping, match, 'Identifier')
          })

          docs.data.filter(doc => mapping.source.name && doc.name === mapping.source.name).forEach(match =>
            addTarget(mapping, match, 'Name')
          )

          const typeName = mapping.source.type

          docs.data.filter(doc => doc.type === typeName).forEach(doc => {

            switch (typeName) {
              case 'job':
                if (doc.label === mapping.source.label) {
                  addTarget(mapping, doc, 'Label')
                }
                break
              case 'route':
                if (utils.path(doc, 'configuration.path') === utils.path(mapping.source, 'configuration.path') && utils.path(doc, 'configuration.method') === utils.path(mapping.source, 'configuration.method')) {
                  addTarget(mapping, doc, 'Configuration')
                }
                break
              case 'trigger':
                if (utils.path(doc, 'configuration.event') === utils.path(mapping.source, 'configuration.event') && utils.path(doc, 'configuration.object') === utils.path(mapping.source, 'configuration.object')) {

                  if (doc.label === mapping.source.label) {
                    addTarget(mapping, doc, 'Configuration & Label')
                  }

                  // always add an option to create a new one (triggers allow duplicates)
                  addTarget(mapping, {
                    _id: consts.emptyId
                  }, 'Duplicate')

                  addTarget(mapping, doc, 'Configuration')

                  mapping.targets.sort((a, b) => {
                    const order = ['Configuration & Label', 'Duplicate', 'Configuration']
                    return order.indexOf(a.matchType) - order.indexOf(b.matchType)
                  })

                }

                break
              case 'library':
                if (utils.path(doc, 'configuration.export') === utils.path(mapping.source, 'configuration.export')) {
                  addTarget(mapping, doc, 'Configuration')
                }
                break
            }

          })
        })
      }
      callback(err)

    })

  }

  getSourceMappingDocs(ac, configuration, callback) {

    const paths = [
      'label',
      'name',
      'type',
      'principal',
      'configuration',
      'requires',
      'serviceAccounts'
    ]

    this.getSelectedDocsForObject(ac, 'Script', configuration, { paths: paths }, (err, docs) => {

      if (err) {
        return callback(err)
      }

      const requires = _.uniq(docs.reduce((requires, doc) => requires.concat(utils.array(doc.requires)), []))
      if (requires.length === 0) {
        return callback(null, docs)
      }

      // get all creators and updaters for account dependencies.

      modules.db.models.Script.find({ org: ac.orgId, object: 'script', reap: false, type: 'library', 'configuration.export': { $in: requires } }).lean().select('_id configuration.export').exec((err, libs) => {
        if (!err) {
          docs.forEach(doc => {
            doc.requires = utils.array(doc.requires).map(req => _.find(libs, lib => lib.configuration.export === req)).filter(v => !!v).map(v => v._id)
          })
        }
        callback(err, docs)
      })

    })
  }

  // ----------------------------------------------------------------------------------

  static getProperties() {
    return [{
      label: 'Label',
      name: 'label',
      type: 'String'
    }, {
      label: 'Name',
      name: 'name',
      type: 'String'
    }, {
      label: 'Type',
      name: 'type',
      type: 'String'
    }, {
      label: 'Configuration',
      name: 'configuration',
      type: 'Document',
      properties: [{
        label: 'Path',
        name: 'path',
        type: 'String'
      }, {
        label: 'Method',
        name: 'method',
        type: 'String'
      }, {
        label: 'Api Key',
        name: 'apiKey',
        type: 'ObjectId'
      }, {
        label: 'Object',
        name: 'object',
        type: 'String'
      }, {
        label: 'Event',
        name: 'event',
        type: 'String'
      }, {
        label: 'Export',
        name: 'export',
        type: 'String'
      }]
    }]
  }

}

module.exports = Mapping
