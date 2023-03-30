'use strict'

const utils = require('../../../../utils'),
      BaseMapping = require('../base-mapping-definition'),
      async = require('async'),
      consts = require('../../../../consts'),
      acl = require('../../../../acl'),
      modules = require('../../../../modules'),
      Fault = require('cortex-service/lib/fault')

class Mapping extends BaseMapping {

  get mappingTypeName() {
    return consts.deployment.mapping.types.sms
  }

  rollback(ac, backup, data, callback) {
    modules.db.models.Org.collection.updateOne({ _id: ac.orgId }, { $set: { 'configuration.sms.numbers': data } }, { writeConcern: { w: 'majority' } }, callback)
  }

  createBackup(ac, callback) {
    callback(null, ac.org.configuration.sms.numbers.toObject())
  }

  _writePayload(validating, topAc, subject, deploymentObject, mappingConfig, filteredMappings, callback) {

    const ac = new acl.AccessContext(topAc.principal, subject, { override: true, req: topAc.req }),
          numbers = subject.configuration.sms.numbers

    ac.option('sandbox.logger.source', consts.logs.sources.deployment)
    ac.option('deferSyncEnvironment', true)

    // first add all the base roles and take of the includes later so all deps are met.
    for (let i = 0; i < filteredMappings.length; i++) {

      const mapping = filteredMappings[i]

      let targetId = mapping.target,
          create = utils.equalIds(targetId, consts.emptyId),
          source = mapping.get('payload'), // getter for ad-hoc mongoose document path.
          target = create ? null : utils.findIdInArray(numbers, '_id', targetId)

      if (!create && !target) {
        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target role: ' + mapping.source.name }))
      }

      if (create) {
        numbers.push({
          _id: utils.createId()
        })
        target = numbers[numbers.length - 1]
      }
      if (source.name) {
        target.name = source.name
      }
      target.number = source.number
      target.did.addToSet(mapping._id)
      if (source.isDefault) {
        numbers.forEach(number => {
          number.isDefault = false
        })
      }
      target.isDefault = source.isDefault

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

  matchSourceMappings(ac, deploymentObject, filteredMappings, callback) {

    const docs = utils.array(utils.path(ac.org.configuration, 'sms.numbers')).map(number => ({ _id: number._id, did: number.did, number: number.number })),
          addTarget = (mapping, match, type) => {
            if (!utils.findIdInArray(mapping.targets, '_id', match._id)) {
              mapping.targets.push({
                _id: match._id,
                number: match.number,
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

      docs.filter(doc => doc.number === mapping.source.number).forEach(match =>
        addTarget(mapping, match, 'Number')
      )
    })

    callback()

  }

  updateMapping(ac, mappings, mapping, doc) {

    mapping.name = doc.name
    mapping.number = doc.number
  }

  getDeploymentPayload(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    let err
    try {
      filteredMappings.forEach(mapping => {
        const number = utils.findIdInArray(utils.path(ac.org.configuration, 'sms.numbers'), '_id', mapping._id)
        if (!number) {
          throw Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source number: ' + mapping.source.number })
        }
        mapping.payload = number.toObject()
      })
    } catch (e) {
      err = e
    }
    callback(err)
  }

  getSourceMappingDocs(ac, configuration, callback) {

    let docs = utils.array(utils.path(ac.org.configuration, 'sms.numbers')).map(number => ({ _id: number._id, name: number.name, number: number.number }))

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
      label: 'Number',
      name: 'number',
      type: 'String'
    }, {
      label: 'Name',
      name: 'name',
      type: 'String'
    }]
  }

}

module.exports = Mapping
