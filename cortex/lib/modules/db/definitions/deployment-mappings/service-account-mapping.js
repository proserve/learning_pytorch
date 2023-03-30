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
    return consts.deployment.mapping.types.serviceAccount
  }

  rollback(ac, backup, data, callback) {
    modules.db.models.Org.collection.updateOne({ _id: ac.orgId }, { $set: { serviceAccounts: data } }, { writeConcern: { w: 'majority' } }, callback)
  }

  createBackup(ac, callback) {
    callback(null, ac.org.serviceAccounts.toObject())
  }

  getDependencies(ac, doc) {
    return utils.array(doc.roles).filter(role => !acl.isBuiltInRole(role)).map(include => ({ _id: include, type: consts.deployment.mapping.types.role }))
  }

  updateMapping(ac, mappings, mapping, doc) {
    mapping.name = doc.name
    mapping.label = doc.label
  }

  _writePayload(validating, topAc, subject, deploymentObject, mappingConfig, filteredMappings, callback) {

    const ac = new acl.AccessContext(topAc.principal, subject, { override: true, req: topAc.req }),
          serviceAccounts = utils.array(subject.serviceAccounts)

    ac.option('sandbox.logger.source', consts.logs.sources.deployment)
    ac.option('deferSyncEnvironment', true)

    // first add all the base roles and take of the includes later so all deps are met.
    for (let i = 0; i < filteredMappings.length; i++) {

      const mapping = filteredMappings[i]

      let targetId = mapping.target,
          create = utils.equalIds(targetId, consts.emptyId),
          source = mapping.get('payload'), // getter for ad-hoc mongoose document path.
          target = create ? null : utils.findIdInArray(serviceAccounts, '_id', targetId),
          targetRoles = []

      if (!create && !target) {
        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target role: ' + mapping.source.name }))
      }

      if (create) {
        subject.serviceAccounts.push({
          name: source.name,
          label: source.label,
          locked: source.locked,
          did: [mapping._id]
        })
        target = subject.serviceAccounts[subject.serviceAccounts.length - 1]
      } else {
        target.name = source.name
        target.label = source.label
        target.locked = source.locked
        target.did.addToSet(mapping._id)
      }

      for (let i = 0; i < source.roles.length; i++) {
        let sourceRoleId = utils.getIdOrNull(source.roles[i]),
            targetRoleId = utils.path(this.findMapping(sourceRoleId, deploymentObject.mappings, [consts.deployment.mapping.types.role]), 'target')

        // during validation, role mappings for new items will not exist. we just have to ensure they exist in mappings.
        if (utils.equalIds(consts.emptyId, targetRoleId)) {
          if (validating) {
            continue
          } else {
            targetRoleId = utils.path(ac.principal.org.roles.find(role => utils.inIdArray(role.did, sourceRoleId)), '_id')
          }
        }
        if (targetRoleId) {
          targetRoles.push(targetRoleId)
        } else if (acl.isBuiltInRole(sourceRoleId)) {
          targetRoles.push(sourceRoleId)
        } else {
          return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target role for service account: ' + mapping.source.label }))
        }

      }

      target.roles = targetRoles
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
        const sa = utils.findIdInArray(ac.org.serviceAccounts, '_id', mapping._id)
        if (!sa) {
          throw Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source service account: ' + mapping.source.name })
        }
        mapping.payload = sa.toObject()
      })
    } catch (e) {
      err = e
    }
    callback(err)
  }

  matchSourceMappings(ac, deploymentObject, filteredMappings, callback) {

    const docs = utils.array(ac.org.serviceAccounts).map(sa => ({ _id: sa._id, did: sa.did, name: sa.name, label: sa.label, roles: sa.roles })),
          addTarget = (mapping, match, type) => {
            if (!utils.findIdInArray(mapping.targets, '_id', match._id)) {
              mapping.targets.push({
                _id: match._id,
                name: match.name,
                label: match.label,
                matchType: type
              })
            }
          }

    filteredMappings.forEach(mapping => {
      mapping.targets.splice(0)

      docs.filter(doc => mapping.source.name && doc.name === mapping.source.name).forEach(match =>
        addTarget(mapping, match, 'Name')
      )

      docs.filter(doc => utils.inIdArray(doc.did, mapping._id)).forEach(match =>
        addTarget(mapping, match, 'Identifier')
      )

    })

    callback()

  }

  getSourceMappingDocs(ac, configuration, callback) {

    let docs = utils.array(ac.org.serviceAccounts).map(sa => ({ _id: sa._id, label: sa.label, name: sa.name, roles: sa.roles.slice() }))
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
