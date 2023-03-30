'use strict'

const utils = require('../../../../utils'),
      BaseMapping = require('../base-mapping-definition'),
      async = require('async'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      acl = require('../../../../acl'),
      Fault = require('cortex-service/lib/fault')

class Mapping extends BaseMapping {

  get mappingTypeName() {
    return consts.deployment.mapping.types.role
  }

  rollback(ac, backup, data, callback) {
    modules.db.models.Org.collection.updateOne({ _id: ac.orgId }, { $set: { roles: data } }, { writeConcern: { w: 'majority' } }, callback)
  }

  createBackup(ac, callback) {
    callback(null, ac.org.roles.toObject())
  }

  getDependencies(ac, doc) {
    return utils.array(doc.include).map(include => ({ _id: include, type: consts.deployment.mapping.types.role }))
  }

  updateMapping(ac, mappings, mapping, doc) {

    mapping.name = doc.name
    mapping.code = doc.code
  }

  _writePayload(validating, topAc, subject, deploymentObject, mappingConfig, filteredMappings, callback) {

    const ac = new acl.AccessContext(topAc.principal, subject, { override: true, req: topAc.req }),
          roles = utils.array(subject.roles).filter(role => !acl.isBuiltInRole(role._id)),
          targets = []

    ac.option('sandbox.logger.source', consts.logs.sources.deployment)
    ac.option('deferSyncEnvironment', true)

    // first add all the base roles and take of the includes later so all deps are met.
    for (let i = 0; i < filteredMappings.length; i++) {

      const mapping = filteredMappings[i]

      let targetId = mapping.target,
          create = utils.equalIds(targetId, consts.emptyId),
          source = mapping.get('payload'), // getter for ad-hoc mongoose document path.
          target = create ? null : utils.findIdInArray(roles, '_id', targetId)

      if (!create && !target) {
        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target role: ' + mapping.source.name }))
      }

      if (create) {
        subject.roles.push({
          name: source.name,
          did: [mapping._id]
        })
        target = subject.roles[subject.roles.length - 1]
        if (source.code !== undefined) {
          target.code = source.code // validation will occur if set so avoid it when no code is given.
        }
      } else {
        target.name = source.name
        target.code = source.code
        target.did.addToSet(mapping._id)
      }
      target.$sourceId = mapping._id

      targets.push(target)
    }

    for (let i = 0; i < targets.length; i++) {

      let role = targets[i],
          mapping = utils.findIdInArray(filteredMappings, '_id', role.$sourceId),
          sourceInclude = utils.array(mapping.get('payload').include)

      role.include = sourceInclude.map(sourceId => {
        const targetRole = utils.findIdInArray(targets, '$sourceId', sourceId)
        return targetRole._id
      })
    }

    for (let i = 0; i < targets.length; i++) {
      delete targets[i].$sourceId
    }

    callback(null, ac)

  }

  validateForTarget(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    async.waterfall([
      callback => {
        modules.db.models.Org.loadOrg(ac.orgId, { cache: false }, callback)
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
        const role = utils.findIdInArray(ac.org.roles, '_id', mapping._id)
        if (!role) {
          throw Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source role: ' + mapping.source.name })
        }
        mapping.payload = role.toObject()
      })
    } catch (e) {
      err = e
    }
    callback(err)
  }

  matchSourceMappings(ac, deploymentObject, filteredMappings, callback) {

    const docs = utils.array(ac.org.roles).map(role => ({ _id: role._id, did: role.did, code: role.code, name: role.name, include: role.include })).filter(role => !acl.isBuiltInRole(role._id)),
          addTarget = (mapping, match, type) => {
            if (!utils.findIdInArray(mapping.targets, '_id', match._id)) {
              mapping.targets.push({
                _id: match._id,
                name: match.name,
                code: match.code,
                matchType: type
              })
            }
          }

    filteredMappings.forEach(mapping => {
      mapping.targets.splice(0)

      docs.filter(doc => mapping.source.code && doc.code === mapping.source.code).forEach(match =>
        addTarget(mapping, match, 'Name')
      )

      docs.filter(doc => utils.inIdArray(doc.did, mapping._id)).forEach(match =>
        addTarget(mapping, match, 'Identifier')
      )

      docs.filter(doc => doc.name === mapping.source.name).forEach(match =>
        addTarget(mapping, match, 'Label')
      )
    })

    callback()

  }

  getSourceMappingDocs(ac, configuration, callback) {

    let docs = utils.array(ac.org.roles).map(role => ({ _id: role._id, name: role.name, code: role.code, include: role.include })).filter(role => !acl.isBuiltInRole(role._id))
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
    callback(null, docs)

  };

  // ----------------------------------------------------------------------------------

  static getProperties() {
    return [{
      label: 'Label',
      name: 'name',
      type: 'String'
    }, {
      label: 'Name',
      name: 'code',
      type: 'String'
    }]
  }

}

module.exports = Mapping
