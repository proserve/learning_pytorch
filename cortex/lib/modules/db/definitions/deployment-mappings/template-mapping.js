'use strict'

const utils = require('../../../../utils'),
      BaseMapping = require('../base-mapping-definition'),
      async = require('async'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      Fault = require('cortex-service/lib/fault')

class Mapping extends BaseMapping {

  get mappingTypeName() {
    return consts.deployment.mapping.types.template
  }

  rollback(ac, backup, data, callback) {

    modules.db.models.Template.deleteMany({ org: ac.orgId }).exec(err => {
      if (err) return callback(err)
      async.eachSeries(
        data,
        (doc, callback) => {
          modules.db.models.Template.collection.insertOne(doc, { writeConcern: { w: 'majority' } }, callback)
        },
        callback
      )
    })
  }

  createBackup(ac, callback) {
    modules.db.models.Template.find({ org: ac.orgId }).lean().exec(callback)
  }

  validateForTarget(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    callback()

  }

  deploy(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    var bulk = modules.db.models.Template.collection.initializeUnorderedBulkOp()

    filteredMappings.forEach(mapping => {

      utils.array(mapping.get('payload')).forEach(template => {

        // map account to target, or to caller as a last resort
        let sourceAccountId

        sourceAccountId = utils.path(template, 'updated.by')
        if (sourceAccountId) {
          utils.path(template, 'updated.by', ac.principalId)
        }

        utils.array(template.changes).forEach(change => {
          sourceAccountId = utils.path(change, 'created.by')
          if (sourceAccountId) {
            utils.path(change, 'created.by', ac.principalId)
          }
          sourceAccountId = utils.path(change, 'updated.by')
          if (sourceAccountId) {
            utils.path(change, 'updated.by', ac.principalId)
          }
        })

        const $set = {
                updated: template.updated,
                sequence: template.sequence,
                current: template.current,
                version: template.version,
                changes: template.changes,
                spec: template.spec,
                builtin: template.builtin
              },
              $setOnInsert = {
                org: ac.orgId,
                locale: template.locale,
                type: template.type,
                name: template.name
              }

        bulk.find({ org: ac.orgId, locale: template.locale, type: template.type, name: template.name }).upsert().updateOne({ $set: $set, $setOnInsert: $setOnInsert })

      })

    })

    bulk.execute(function(err) {
      callback(Fault.from(err))
    })
  }

  getDeploymentPayload(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    var templateNames = filteredMappings.map(mapping => mapping.source.name)
    if (templateNames.length === 0) {
      return callback()
    }

    modules.db.models.Template.find({ org: ac.orgId, name: { $in: templateNames } }).lean().exec((err, templates) => {
      if (!err) {
        try {
          filteredMappings.forEach(mapping => {
            const matches = templates.filter(doc => doc.name === mapping.source.name && doc.type === mapping.source.type)
            if (matches.length === 0) {
              throw Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source template: ' + mapping.source.label })
            }
            mapping.payload = matches
          })
        } catch (e) {
          err = e
        }
      }
      callback(err)
    })

  }

  matchSourceMappings(ac, deploymentObject, filteredMappings, callback) {

    const where = {
            org: ac.orgId,
            locale: null,
            $or: filteredMappings.map(mapping => ({ name: mapping.source.name, type: mapping.source.type }))
          },
          addTarget = (mapping, match, type) => {
            if (!utils.findIdInArray(mapping.targets, '_id', match._id)) {
              mapping.targets.push({
                _id: match._id,
                label: utils.path(match, 'spec.0.nickname') || match.name,
                name: match.name,
                type: match.type,
                matchType: type
              })
            }
          }

    modules.db.models.Template.find(where).select('name type spec.nickname').lean().exec((err, docs) => {
      if (!err) {
        filteredMappings.forEach(mapping => {
          mapping.targets.splice(0)
          docs.filter(doc => doc.name === mapping.source.name && doc.type === mapping.source.type).forEach(match => {
            addTarget(mapping, match, 'Name')
          })
        })
      }
      callback(err)
    })

  }

  updateMapping(ac, mappings, mapping, doc) {

    mapping.label = utils.path(doc, 'spec.0.nickname') || doc.name
    mapping.name = doc.name
    mapping.type = doc.type

  }

  getSourceMappingDocs(ac, configuration, callback) {

    const options = {
      paths: [
        'name',
        'type',
        'builtin',
        'spec.nickname'
      ],
      find: {
        locale: { $in: [ null, [] ] }
      },
      inCustomCollection: true,
      notReapable: true
    }

    this.getSelectedDocsForObject(ac, 'Template', configuration, options, (err, docs) => {
      callback(err, docs)
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
    }]
  }

}

module.exports = Mapping
