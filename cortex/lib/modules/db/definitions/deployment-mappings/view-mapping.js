'use strict'

const
      utils = require('../../../../utils'),
      BaseMapping = require('../base-mapping-definition'),
      async = require('async'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      acl = require('../../../../acl'),
      ap = require('../../../../access-principal'),
      clone = require('clone'),
      Fault = require('cortex-service/lib/fault'),
      _ = require('underscore')

class Mapping extends BaseMapping {

  get mappingTypeName() {
    return consts.deployment.mapping.types.view
  }

  rollback(ac, backup, data, callback) {

    modules.db.models.View.deleteMany({ org: ac.orgId, object: 'view' }).exec(err => {
      if (err) return callback(err)
      async.eachSeries(
        data,
        (doc, callback) => {
          modules.db.models.View.collection.insertOne(doc, { writeConcern: { w: 'majority' } }, callback)
        },
        callback
      )
    })
  }

  createBackup(ac, callback) {
    modules.db.models.View.find({ org: ac.orgId, object: 'view' }).lean().exec(callback)
  }

  validateForTarget(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    const View = modules.db.models.View

    async.waterfall([

      // load existing views for comparison, to ensure we don't have duplicates.
      callback => {

        const options = { allowSystemAccessToParserProperties: true, skipParserIndexChecks: true, relaxParserLimits: true, limit: false, allowNoLimit: true, paths: ['_id', 'name'], skipAcl: true, json: true, grant: acl.AccessLevels.System }
        View.aclList(ac.principal, options, (err, docs) => {
          callback(err, utils.path(docs, 'data'))
        })

      },

      // check for duplicates. this is about as far as we can go, because until deployment, mapped roles and objects may not exist.
      (existing, callback) => {
        async.eachSeries(filteredMappings, mapping => {

          let source = mapping.get('payload'),
              targetId = mapping.target,
              create = utils.equalIds(targetId, consts.emptyId),
              target = create ? null : utils.findIdInArray(existing, '_id', targetId)

          if (!create && !target) {
            return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target view: ' + mapping.source.label }))
          }

          // check for duplicates in existing views.
          if (_.find(existing, doc => source.name === doc.name && (create || !utils.equalIds(targetId, doc._id)))) {
            return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Duplicate mapping target view: ' + mapping.source.label }))
          }
          callback()
        })
      }

    ], callback)

  }

  deploy(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    const View = modules.db.models.View

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

      // load fresh views
      (principal, callback) => {
        modules.db.models.View.aclList(ac.principal, { include: ['did'], allowSystemAccessToParserProperties: true, skipParserIndexChecks: true, relaxParserLimits: true, limit: false, allowNoLimit: true, skipAcl: true, json: false, grant: acl.AccessLevels.System }, (err, existing) => {
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
            return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target view: ' + mapping.source.label }))
          }

          if (!target) {
            target = new View()
            target.org = ac.orgId
            target.object = View.objectName
            target.did = [source._id]
          } else {
            target.did.addToSet(source._id)
          }

          target.creator = { _id: ac.principalId }
          target.owner = { _id: ac.principalId }
          target.updater = source.updater ? { _id: ac.principalId } : undefined
          target.updated = source.updated
          target.created = source.created

          // tidy up the payload
          delete payload._id
          utils.array(payload.query).forEach(query => {
            delete query._id
            delete query.variables
          })

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
              return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target principal: ' + mapping.source.label }))
            }
          }
          payload.acl = this.mapAclToTarget(principal.org, deploymentObject.mappings, payload.acl, true)
          payload.objectAcl = this.mapAclToTarget(principal.org, deploymentObject.mappings, payload.objectAcl)

          const viewAc = new acl.AccessContext(principal, target, { method: 'put', req: ac.req, grant: acl.AccessLevels.System })
          viewAc.option('sandbox.logger.source', consts.logs.sources.deployment)
          viewAc.option('deferSyncEnvironment', true)

          payload = _.pick(payload, 'acl active description label limit name objectAcl paths postType principal query skip sourceObject'.split(' '))

          payload.script = utils.rString(source.script, '')

          target.aclWrite(viewAc, payload, err => {
            if (err) {
              callback(err)
            } else {
              viewAc.save(callback)
            }
          })

        }, callback)

      }

    ], callback)

  }

  matchSourceMappings(ac, deploymentObject, filteredMappings, callback) {

    const where = {
            $or: [{
              did: { $in: filteredMappings.map(mapping => mapping.source._id) }
            }, {
              name: { $in: filteredMappings.map(mapping => mapping.source.name) }
            }, {
              label: { $in: filteredMappings.map(mapping => mapping.source.label) }
            }]
          },
          paths = ['did', 'label', 'name'],
          addTarget = (mapping, match, type) => {
            if (!utils.findIdInArray(mapping.targets, '_id', match._id)) {
              mapping.targets.push(utils.extend({ matchType: type }, match))
            }
          }

    modules.db.models.View.aclList(ac.principal, { allowSystemAccessToParserProperties: true, skipParserIndexChecks: true, relaxParserLimits: true, limit: false, allowNoLimit: true, where: where, paths: paths, skipAcl: true, json: true, grant: acl.AccessLevels.System }, (err, docs) => {

      if (!err) {
        filteredMappings.forEach(mapping => {
          mapping.targets.splice(0)
          docs.data.filter(doc => utils.inIdArray(doc.did, mapping._id)).forEach(match => {
            addTarget(mapping, match, 'Identifier')
          })
          docs.data.filter(doc => doc.name === mapping.source.name).forEach(match => {
            addTarget(mapping, match, 'Name')
          })
          docs.data.filter(doc => doc.label === mapping.source.label).forEach(match => {
            addTarget(mapping, match, 'Label')
          })
        })
      }
      callback(err)
    })

  }

  getDependencies(ac, doc) {

    const dependencies = {}

    dependencies[doc.sourceObject] = consts.deployment.mapping.types.object

    if (doc.principal && !acl.isBuiltInPrincipal(doc.principal)) {
      dependencies[doc.principal] = consts.deployment.mapping.types[utils.findIdInArray(ac.org.roles, '_id', doc.principal) ? 'role' : utils.findIdInArray(ac.org.serviceAccounts, '_id', doc.principal) ? 'serviceAccount' : 'account']
    }

    this._addAclDependencies(doc.acl, dependencies)
    this._addAclDependencies(doc.objectAcl, dependencies)

    // script deps
    utils.array(doc.scriptIds).forEach(include => {
      dependencies[include] = consts.deployment.mapping.types.script
    })

    // service account deps
    utils.array(doc.serviceAccountIds).forEach(include => {
      dependencies[include] = consts.deployment.mapping.types.serviceAccount
    })

    return _.map(dependencies, (type, _id) => ({ _id: utils.getIdOrNull(_id), type: type }))

  }

  getDeploymentPayload(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    var viewIds = filteredMappings.map(mapping => mapping._id)
    if (viewIds.length === 0) {
      return callback()
    }

    modules.db.models.View.aclList(ac.principal, { allowSystemAccessToParserProperties: true, skipParserIndexChecks: true, relaxParserLimits: true, limit: false, allowNoLimit: true, where: { _id: { $in: viewIds } }, skipAcl: true, json: true, grant: acl.AccessLevels.System }, (err, views) => {

      if (!err) {
        try {
          filteredMappings.forEach(mapping => {
            const view = utils.findIdInArray(views.data, '_id', mapping._id)
            if (!view) {
              throw Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source view: ' + mapping.source.label })
            }
            mapping.payload = view
          })
        } catch (e) {
          err = e
        }
      }
      callback(err)
    })

  }

  updateMapping(ac, mappings, mapping, doc) {

    mapping.label = doc.label || ''
    mapping.name = doc.name || ''
  }

  getSourceMappingDocs(ac, configuration, callback) {

    const paths = [
      'label',
      'name',
      'sourceObject',
      'principal',
      'objectAcl',
      'script'
    ]

    this.getSelectedDocsForObject(ac, 'View', configuration, { paths: paths }, (err, docs) => {

      if (err) {
        return callback(err)
      }

      docs = docs.map(({ _id, name, label, sourceObject, principal, objectAcl, script }) => ({
        _id,
        name,
        label,
        sourceObject,
        principal,
        objectAcl,
        scriptIds: (script && script.requires) || [],
        serviceAccountIds: (script && script.serviceAccounts) || []
      }))

      Promise.resolve(null)
        .then(async() => {

          const allIncludes = _.uniq(docs.reduce((includes, doc) => includes.concat(doc.scriptIds), []))

          if (allIncludes.length) {

            const libs = await modules.db.models.Script.find({
              org: ac.orgId,
              object: 'script',
              reap: false,
              type: 'library',
              'configuration.export': { $in: allIncludes }
            }).lean().select('_id configuration.export').exec()

            docs.forEach(doc => {
              doc.scriptIds = doc.scriptIds.map(req => {
                const lib = libs.find(lib => lib.configuration.export === req)
                return lib ? lib._id : req // returning the c_export will raise a missing dependency error later on.
              })
            })

          }

          docs.forEach(doc => {
            doc.serviceAccountIds = doc.serviceAccountIds.map(name => {
              const lib = ac.org.serviceAccounts.find(sa => sa.name === name)
              return lib ? lib._id : name // returning the name will raise a missing dependency error later on.
            })
          })

          return docs

        })
        .then(result => callback(null, result))
        .catch(err => callback(err))

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
    }]
  }

}

module.exports = Mapping
