'use strict'

const utils = require('../../../../utils'),
      BaseMapping = require('../base-mapping-definition'),
      async = require('async'),
      clone = require('clone'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      acl = require('../../../../acl'),
      Fault = require('cortex-service/lib/fault'),
      _ = require('underscore')

class Mapping extends BaseMapping {

  get mappingTypeName() {
    return consts.deployment.mapping.types.policy
  }

  getDependencies(ac, doc) {

    const dependencies = {},
          policy = ac.org.policies.find(policy => utils.equalIds(doc._id, policy._id))

    // app deps
    policy.appWhitelist.concat(policy.appBlacklist).forEach(appId => {
      dependencies[appId] = consts.deployment.mapping.types.app
    })

    // acl deps
    this._addAclDependencies(policy.aclWhitelist.concat(policy.aclBlacklist), dependencies)

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

  rollback(ac, backup, data, callback) {
    modules.db.models.Org.collection.updateOne({ _id: ac.orgId }, { $set: { policies: data } }, { writeConcern: { w: 'majority' } }, callback)
  }

  createBackup(ac, callback) {
    callback(null, ac.org.policies.toObject())
  }

  /**
     *
     * @param validating
     * @param topAc
     * @param subject
     * @param deploymentObject
     * @param mappingConfig
     * @param filteredMappings
     * @param callback err -> ac
     * @private
     */
  _writePayload(validating, topAc, subject, deploymentObject, mappingConfig, filteredMappings, callback) {

    const ac = new acl.AccessContext(topAc.principal, subject, { override: true, req: topAc.req })
    ac.option('sandbox.logger.source', consts.logs.sources.deployment)
    ac.option('deferSyncEnvironment', true)

    async.eachSeries(filteredMappings, (mapping, callback) => {

      let targetId = mapping.target,
          create = utils.equalIds(targetId, consts.emptyId),
          source = clone(mapping.get('payload')), // getter for adhoc mongoose document path.
          target = create ? null : utils.findIdInArray(subject.policies, '_id', targetId)

      if (!create && !target) {
        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target policy: ' + mapping.source.label }))
      }

      // create dummy and get object in order to get clean object with all the arrays and required arrays
      const tmp = new subject.constructor()
      tmp.policies = [source]
      source = tmp.policies[0].toObject()

      if (create) {
        source.did = [mapping._id]
        delete source._id
        ac.method = 'post'
      } else {
        source._id = targetId
        ac.method = 'put'
        delete source.did
      }
      delete source.regexp

      // when validating, none of the mappings will exist
      if (validating) {
        source.appWhitelist = []
        source.appBlacklist = []
        source.aclWhitelist = []
        source.aclBlacklist = []
      }

      // map apps
      for (let i = 0; i < source.appWhitelist.length; i++) {
        const mapping = this.findMapping(source.appWhitelist[i], deploymentObject.mappings, consts.deployment.mapping.types.app)
        if (!mapping) {
          return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source app: ' + source.appWhitelist[i] }))
        }
        source.appWhitelist[i] = mapping.target
      }

      for (let i = 0; i < source.appBlacklist.length; i++) {
        const mapping = this.findMapping(source.appBlacklist[i], deploymentObject.mappings, consts.deployment.mapping.types.app)
        if (!mapping) {
          return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source app: ' + source.appBlacklist[i] }))
        }
        source.appBlacklist[i] = mapping.target
      }

      // map acl
      source.aclWhitelist = this.mapAclToTarget(ac.principal.org, deploymentObject.mappings, source.aclWhitelist, true)
      source.aclBlacklist = this.mapAclToTarget(ac.principal.org, deploymentObject.mappings, source.aclBlacklist, true)

      // mapping script includes is not required because we use the export string in the object
      source.script = utils.rString(source.script && source.script.script, '')

      // write and add did for existing policies.
      ac.subject.aclWrite(ac, { policies: source }, err => {
        if (!err) {
          if (create) {
            const target = _.find(ac.subject.policies, policy => utils.inIdArray(policy.did, mapping._id))
            if (!target) {
              err = Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target policy: ' + mapping.source.label })
            } else if (!validating) {
              mapping.target = target._id // <-- store in mapping for dependent scripts.
            }
          } else {
            const target = utils.findIdInArray(ac.subject.policies, '_id', targetId)
            if (!target) {
              err = Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target policy: ' + mapping.source.label })
            } else {
              target.did.addToSet(mapping._id)
            }
          }
        }
        callback(err)
      })

    }, err => {
      callback(err, ac)
    })

  }

  validateForTarget(ac, deploymentObject, mappingConfig, filteredMappings, callback) {
    async.waterfall([
      callback => {
        modules.db.models.Org.loadOrg(ac.orgId, { cache: false }, callback)
      },
      // make sure targets still exist
      (org, callback) => {
        for (let { target } of filteredMappings) {
          if (!utils.equalIds(consts.emptyId, target) && !utils.findIdInArray(org.policies, '_id', target)) {
            return callback(Fault.create('cortex.notFound.unspecified', { reason: 'A policy selected as a target no longer exist in the deployment configuration: ' + target }))
          }
        }
        callback(null, org)
      },
      (org, callback) => {
        this._writePayload(true, ac, org, deploymentObject, mappingConfig, filteredMappings, callback)
      },
      (ac, callback) => {
        ac.subject.validateWithAc(ac, callback)
      }
    ], callback)

  }

  deploy(ac, deploymentObject, mappingConfig, filteredMappings, callback) {
    async.waterfall([
      callback => {
        modules.db.models.Org.loadOrg(ac.orgId, { cache: false }, callback)
      },
      (org, callback) => {
        this._writePayload(false, ac, org, deploymentObject, mappingConfig, filteredMappings, callback)
      },
      (ac, callback) => {
        ac.save(callback)
      }
    ], callback)
  }

  getDeploymentPayload(ac, deploymentObject, mappingConfig, filteredMappings, callback) {
    let err
    try {
      filteredMappings.forEach(mapping => {
        const policy = utils.findIdInArray(ac.org.policies, '_id', mapping._id)
        if (!policy) {
          throw Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source policy: ' + mapping.source.label })
        }
        mapping.payload = policy.toObject()
      })
    } catch (e) {
      err = e
    }
    callback(err)
  }

  updateMapping(ac, mappings, mapping, doc) {

    mapping.label = doc.label
    mapping.name = doc.name

  }
  matchSourceMappings(ac, deploymentObject, filteredMappings, callback) {

    const docs = utils.array(ac.org.policies).map(({ _id, did, label }) => ({ _id, did, label })),
          addTarget = (mapping, match, type) => {
            if (!utils.findIdInArray(mapping.targets, '_id', match._id)) {
              mapping.targets.push({
                _id: match._id,
                label: match.label,
                name: match.name,
                matchType: type
              })
            }
          }

    filteredMappings.forEach(mapping => {
      mapping.targets.splice(0)
      docs.filter(doc => utils.inIdArray(doc.did, mapping._id)).forEach(match =>
        addTarget(mapping, match, 'Identifier')
      )
      docs.filter(doc => mapping.source.name && doc.name === mapping.source.name).forEach(match =>
        addTarget(mapping, match, 'Name')
      )
      docs.filter(doc => doc.label === mapping.source.label).forEach(match =>
        addTarget(mapping, match, 'Label')
      )
    })

    callback()

  }

  getSourceMappingDocs(ac, configuration, callback) {

    let docs = utils.array(ac.org.policies).map(({ _id, label, script }) => ({
      _id,
      label,
      scriptIds: (script && script.requires) || [],
      serviceAccountIds: (script && script.serviceAccounts) || []
    }))
    switch (configuration.select) {
      case consts.deployment.selections.all:
        break
      case consts.deployment.selections.include:
        docs = docs.filter(doc => utils.inIdArray(configuration.ids, doc._id))
        break
      case consts.deployment.selections.exclude:
        docs = docs.filter(doc => !utils.inIdArray(configuration.ids, doc._id))
        break
      case consts.deployment.selections.none:
      default:
        docs = []
        break

    }

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

  };

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
