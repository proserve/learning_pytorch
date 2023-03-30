'use strict'

const utils = require('../../../../utils'),
      BaseMapping = require('../base-mapping-definition'),
      async = require('async'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      Fault = require('cortex-service/lib/fault')

class Mapping extends BaseMapping {

  get mappingTypeName() {
    return consts.deployment.mapping.types.config
  }

  rollback(ac, backup, data, callback) {

    // remove all keys then insert backup list.
    async.waterfall(
      [
        callback => modules.config.keys(ac.org, (err, keys) => {
          void err
          callback(null, keys || [])
        }),
        (keys, callback) => {
          async.eachSeries(
            keys,
            (key, callback) => modules.config.set(ac.org, key, null, () => callback()),
            callback
          )
        }
      ],
      () => {
        async.eachSeries(
          data,
          ({ key, isPublic, value }, callback) => modules.config.set(ac.org, key, value, { isPublic }, () => callback()),
          callback
        )
      }
    )

  }

  createBackup(ac, callback) {

    async.waterfall(
      [
        callback => modules.config.keys(ac.org, { extended: true }, callback),
        (keys, callback) => {
          async.mapSeries(
            keys,
            ({ key, isPublic }, callback) => {
              modules.config.get(ac.org, key, (err, value) => {
                callback(err, { key, isPublic, value })
              })
            },
            callback
          )
        }
      ],
      callback
    )
  }

  validateForTarget(ac, deploymentObject, mappingConfig, filteredMappings, callback) {
    callback()
  }

  deploy(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    async.eachSeries(
      filteredMappings,
      (mapping, callback) => {
        modules.config.set(
          ac.org,
          mapping.source.key,
          mapping.payload.value,
          { isPublic: mapping.payload.isPublic },
          callback)
      },
      callback
    )

  }

  matchSourceMappings(ac, deploymentObject, filteredMappings, callback) {

    async.eachSeries(
      filteredMappings,
      (mapping, callback) => {

        mapping.targets.splice(0)

        modules.config.get(ac.org, mapping.source.key, (err, value) => {
          if (!err && utils.isSet(value)) {
            mapping.targets.push({
              _id: utils.createId(),
              key: mapping.source.key,
              matchType: 'Key'
            })
          }
          callback(err)
        })
      },
      callback
    )

  }

  updateMapping(ac, mappings, mapping, doc) {

    mapping.key = doc.key

  }

  getDeploymentPayload(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    async.eachSeries(
      filteredMappings,
      (mapping, callback) => {

        modules.config.get(ac.org, mapping.source.key, { extended: true }, (err, value) => {
          if (!err && value === null) {
            err = Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source configuration key: ' + mapping.source.key })
          }
          mapping.payload = value
          callback(err)
        })
      },
      callback
    )

  }

  getSourceMappingDocs(ac, configuration, callback) {

    modules.config.keys(ac.org, (err, keys) => {

      if (err) {
        return callback(err)
      }

      let docs = keys.map(item => ({ _id: utils.createId(), key: item }))

      switch (configuration.select) {

        case consts.deployment.selections.all:
          break

        case consts.deployment.selections.include:
          docs = docs.filter(doc => configuration.ids.includes(doc.key))
          break

        case consts.deployment.selections.exclude:
          docs = docs.filter(doc => !configuration.ids.includes(doc.key))
          break

        case consts.deployment.selections.none:
        default:
          docs = []
          break

      }
      callback(null, docs)

    })

  };

  // ----------------------------------------------------------------------------------

  static getProperties() {
    return [{
      label: 'Key',
      name: 'key',
      type: 'String'
    }]
  }

}

module.exports = Mapping
