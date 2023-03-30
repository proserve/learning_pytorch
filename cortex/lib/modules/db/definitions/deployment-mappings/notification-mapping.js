'use strict'

const utils = require('../../../../utils'),
      BaseMapping = require('../base-mapping-definition'),
      async = require('async'),
      clone = require('clone'),
      consts = require('../../../../consts'),
      acl = require('../../../../acl'),
      modules = require('../../../../modules'),
      Fault = require('cortex-service/lib/fault'),
      _ = require('underscore')

class Mapping extends BaseMapping {

  get mappingTypeName() {
    return consts.deployment.mapping.types.notification
  }

  getDependencies(ac, doc) {
    return utils.array(doc.templates).map(template => ({ _id: template, type: consts.deployment.mapping.types.template }))
  }

  rollback(ac, backup, data, callback) {
    modules.db.models.Org.collection.updateOne({ _id: ac.orgId }, { $set: { 'configuration.notifications': data } }, { writeConcern: { w: 'majority' } }, callback)
  }

  createBackup(ac, callback) {
    callback(null, ac.org.configuration.notifications.toObject())
  }

  _writePayload(validating, topAc, subject, deploymentObject, mappingConfig, filteredMappings, callback) {

    // in prep, load all org template by type and name.

    modules.db.models.Template.find({ org: topAc.orgId, locale: { $in: [ null, [] ] } }).lean().select('_id type name').exec((err, targetTemplates) => {

      if (err) {
        return callback(err)
      }

      const ac = new acl.AccessContext(topAc.principal, subject, { override: true, req: topAc.req }),
            // create dummy and get object in order to get clean object.
            tmp = new subject.constructor()

      ac.option('sandbox.logger.source', consts.logs.sources.deployment)
      ac.option('deferSyncEnvironment', true)

      async.eachSeries(filteredMappings, (mapping, callback) => {

        tmp.configuration.notifications = [clone(mapping.get('payload'))] // getter for ad-hoc mongoose document path.

        let targetId = mapping.target,
            create = utils.equalIds(targetId, consts.emptyId),
            builtin = consts.Notifications.TypeMap[mapping._id],
            source = tmp.configuration.notifications[0].toObject(),
            target = create ? null : utils.findIdInArray(subject.configuration.notifications, '_id', targetId)

        if (!create && !target && !builtin) {
          return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target notification: ' + mapping.source.label }))
        }

        // write but cut off before the save. we'll be left with a ready-to-save notifications array. we have to do this because
        // of the notification defaults/custom reader/pusher
        const saveOptions = {
                document: ac.subject,
                dryRun: true,
                method: create ? 'post' : 'put'
              },
              savePath = create ? 'configuration.notifications' : 'configuration.notifications.' + targetId

        if (create) {
          delete source._id
        } else {
          source._id = targetId
        }

        // map template(s) from target to source.
        for (let i = source.endpoints.length - 1; i >= 0; i--) {

          if (!builtin) {

            let endpoint = source.endpoints[i],
                templateName = endpoint.template,
                endpointTypeName = consts.Notifications.EndpointMap[endpoint._id].name,
                template,
                targetTemplate

            template = _.find(deploymentObject.mappings, mapping => {
              return mapping.type === consts.deployment.mapping.types.template && mapping.source.name === templateName && mapping.source.type === endpointTypeName
            })

            if (!template) {
              return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing source-mapped template for notification endpoint: ' + mapping.source.label }))
            }

            // if the target template has not yet materialized, just take out the endpoint so we don't get an error.
            // because of the deployment order, any new templates will already have been created, so we're pretty much gtg.
            targetTemplate = _.find(targetTemplates, tpl => tpl.name === templateName && tpl.type === endpointTypeName)
            if (!targetTemplate) {
              source.endpoints.splice(i, 1)
            }

            endpoint.eid = endpoint._id
            delete endpoint._id

          }

        }

        // we might have taken some out because of missing templates. don't save a notification with no endpoints.
        if (!builtin && source.endpoints.length === 0) {
          callback()
          return
        }

        ac.object.aclUpdatePath(ac.principal, ac.subject, savePath, source, saveOptions, err => {
          callback(err)
        })

      }, err => {
        callback(err, ac)
      })

    })

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

    const notifications = ac.org.configuration.notifications

    let err
    try {
      filteredMappings.forEach(mapping => {
        const notification = utils.findIdInArray(notifications, '_id', mapping._id)
        if (!notification) {
          throw Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source notification: ' + mapping.source.label })
        }
        mapping.payload = notification

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

    const addTarget = (mapping, match, type) => {
      if (!utils.findIdInArray(mapping.targets, '_id', match._id)) {
        mapping.targets.push({
          _id: match._id,
          label: match.label,
          name: match.name,
          matchType: type
        })
      }
    }
    ac.org.constructor.aclReadPath(ac.principal, ac.orgId, 'configuration.notifications', { relaxParserLimits: true, document: ac.org, skipAcl: true, grant: acl.AccessLevels.System }, (err, docs) => {
      if (err) {
        return callback(err)
      }
      filteredMappings.forEach(mapping => {
        mapping.targets.splice(0)
        docs.filter(
          doc => doc.name === mapping.source.name
        ).forEach(
          match => addTarget(mapping, match, 'Name')
        )
      })

    })
    callback()

  }

  getSourceMappingDocs(ac, configuration, callback) {

    // only use sources that have concrete settings.
    const concreteIds = ac.org.configuration.notifications.map(v => v._id)

    ac.org.constructor.aclReadPath(ac.principal, ac.orgId, 'configuration.notifications', { relaxParserLimits: true, document: ac.org, skipAcl: true, grant: acl.AccessLevels.System }, (err, docs) => {

      if (err) {
        return callback(err)
      }

      docs.forEach(doc => { doc.templates = [] })
      docs = docs.filter(v => utils.inIdArray(concreteIds, v._id))

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

      if (docs.length === 0) {
        return callback(null, docs)
      }

      // fetch custom templates and map them to identifiers.
      const find = { org: ac.orgId, locale: { $in: [ null, [] ] }, $or: [] }
      docs.forEach(doc =>
        doc.endpoints.forEach(endpoint => {
          if (endpoint.template) {
            find.$or.push({ type: endpoint.name, name: endpoint.template })
          }
        })
      )

      if (find.$or.length === 0) {
        return callback(null, docs)
      }

      modules.db.models.Template.find(find).lean().select('_id type name').exec(function(err, tpls) {
        if (!err) {
          docs.forEach(doc => {
            doc.templates = doc.endpoints
              .map(endpoint =>
                _.find(tpls, tpl =>
                  tpl.name === endpoint.template && tpl.type === endpoint.name
                )
              )
              .filter(id => !!id)
              .map(tpl => tpl._id)
          })
        }
        callback(err, docs)
      })

    })

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
