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
    return consts.deployment.mapping.types.app
  }

  getDependencies(ac, doc) {

    const dependencies = {}
    doc.clients.forEach(doc => {
      if (doc.principalId && !acl.isBuiltInPrincipal(doc.principalId)) {
        dependencies[doc.principalId] = consts.deployment.mapping.types[utils.findIdInArray(ac.org.serviceAccounts, '_id', doc.principalId) ? 'serviceAccount' : 'account']
      }
    })
    return _.map(dependencies, (type, _id) => ({ _id: utils.getIdOrNull(_id), type: type }))

  }

  rollback(ac, backup, data, callback) {
    modules.db.models.Org.collection.updateOne({ _id: ac.orgId }, { $set: { apps: data } }, { writeConcern: { w: 'majority' } }, callback)
  }

  createBackup(ac, callback) {
    callback(null, ac.org.apps.toObject())
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
          target = create ? null : utils.findIdInArray(subject.apps, '_id', targetId),
          tmp,
          client

      if (!create && !target) {
        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target app: ' + mapping.source.label }))
      }

      // prep app and client
      source.clients = source.clients.slice(0, 1) // ensure one-to-one for now
      if (!source.clients[0]) {
        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source app client: ' + mapping.source.label }))
      }
      if (!create && !target.clients[0]) {
        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target app client: ' + mapping.source.label }))
      }

      // create dummy and get object in order to get clean object.
      tmp = new subject.constructor()
      tmp.apps = [source]
      source = tmp.apps[0].toObject()
      client = source.clients[0]

      if (create) {
        source.did = [mapping._id]
        delete source._id
        delete client._id
        ac.method = 'post'
      } else {
        source._id = targetId
        client._id = target.clients[0]._id
        ac.method = 'put'
        delete client.sessions
        delete source.did
      }
      delete client.key
      delete client.secret
      delete client.rsa

      // map principal
      if (client.principalId && !acl.isBuiltInPrincipal(client.principalId)) {

        let targetPrincipalId = utils.path(this.findMapping(client.principalId, deploymentObject.mappings, [consts.deployment.mapping.types.account, consts.deployment.mapping.types.serviceAccount]), 'target')
        if (utils.equalIds(consts.emptyId, targetPrincipalId)) {
          if (validating) {
            targetPrincipalId = acl.AnonymousIdentifier // re-assign to anonymous for validation purposes
          } else {
            // assume a service account was just created, so match by deployment identifier.
            targetPrincipalId = utils.path(ac.principal.org.serviceAccounts.find(sa => utils.inIdArray(sa.did, client.principalId)), '_id')
          }
        }
        if (!targetPrincipalId) {
          return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target principal: ' + mapping.source.label }))
        }
        client.principalId = targetPrincipalId

      }

      // write and add did for existing apps.
      ac.subject.aclWrite(ac, { apps: source }, err => {
        if (!err) {
          if (create) {
            const target = _.find(ac.subject.apps, app => utils.inIdArray(app.did, mapping._id))
            if (!target) {
              err = Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target app: ' + mapping.source.label })
            } else if (!validating) {
              mapping.target = target._id // <-- store in mapping for dependent scripts.
            }
          } else {
            const target = utils.findIdInArray(ac.subject.apps, '_id', targetId)
            if (!target) {
              err = Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target app: ' + mapping.source.label })
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

      (org, callback) => {

        let createCount = 0

        for (let i = 0; i < filteredMappings.length; i++) {

          const mapping = filteredMappings[i],
                targetId = mapping.target

          let target, sclient, tclient

          // honor max apps.
          if (utils.equalIds(consts.emptyId, targetId)) {
            createCount++
            if (createCount + org.apps.length > ac.subject.configuration.maxApps) {
              return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Adding an app would breach the limit of ' + ac.subject.configuration.maxApps + ' apps.' }))
            }
            continue
          }

          // make sure targets still exist
          target = utils.findIdInArray(org.apps, '_id', targetId)
          if (!target) {
            return callback(Fault.create('cortex.notFound.unspecified', { reason: 'An app selected as a target no longer exist in the deployment configuration: ' + targetId }))
          }

          sclient = utils.path(mapping.get('payload'), 'clients.0')
          tclient = utils.path(target, 'clients.0')
          if (!sclient || !tclient || sclient.sessions !== tclient.sessions) {
            return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'An app selected as a target has an incompatible client configuration: ' + targetId }))
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

        const app = utils.findIdInArray(ac.org.apps, '_id', mapping._id)
        if (!app) {
          throw Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source app: ' + mapping.source.label })
        }

        mapping.payload = app.toObject()

        if (!mappingConfig.preserveCerts) {
          delete mapping.payload.GCM
          delete mapping.payload.FCM
          delete mapping.payload.TPNS
          delete mapping.payload.APNs
        }
        mapping.payload.clients.forEach(function(client) {
          delete client.key
          delete client.secret
          delete client.rsa
        })

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

    const docs = utils.array(ac.org.apps).map(({ _id, did, label, name }) => ({ _id, did, label, name })),
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
      docs.filter(doc => doc.label === mapping.source.label && utils.path(doc, 'clients.0.sessions') === utils.path(mapping.source, 'clients.0.sessions')).forEach(match =>
        addTarget(mapping, match, 'Label')
      )
    })

    callback()

  }

  getSourceMappingDocs(ac, configuration, callback) {

    let docs = utils.array(ac.org.apps).map(app => ({
      _id: app._id,
      label: app.label,
      name: app.name,
      clients: app.clients.map(client => ({
        _id: client._id,
        label: client.label,
        key: client.key,
        principalId: client.principalId,
        sessions: client.sessions
      }))
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
