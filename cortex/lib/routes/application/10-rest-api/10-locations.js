'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      _ = require('underscore'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      consts = require('../../../consts')

module.exports = function(express, router) {

  /**
     * List locations
     */
  router.get('/locations',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res) {

      const options = _.pick(req.query, 'startingAfter', 'endingBefore', 'where', 'map', 'group', 'sort', 'skip', 'pipeline')
      options.req = req
      options.limit = utils.queryLimit(utils.path(req.query, 'limit'))

      modules.db.models.location.nodeList(req.principal, { org: req.orgId, accountId: req.principal._id }, options, function(err, docs) {
        utils.outputResults(res, err, docs)
      })
    }
  )

  /**
     * Get Location
     */
  router.get('/locations/:id',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res, next) {

      const locationId = utils.getIdOrNull(req.params.id)
      if (!locationId) {
        return next(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid locationId' }))
      }
      modules.db.models.location.nodeList(req.principal, { _id: locationId, org: req.orgId, accountId: req.principal._id }, { req: req, single: true }, function(err, doc) {
        utils.outputResults(res, err, doc)
      })
    }
  )

  /**
   * refreshToken
   */
  router.post('/locations/:tokenType',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res, next) {

      const { locationId, body, principal } = req,
            { token } = body || {},
            { Location } = modules.db.models,
            { tokenType } = req.params || {}

      if (!locationId) {
        return next(Fault.create('cortex.invalidArgument.unspecified', { reason: 'The caller must be signed in with a valid locationId' }))
      } else if (!_.isString(token)) {
        return next(Fault.create('cortex.invalidArgument.unspecified', { reason: 'A token string was expected.' }))
      } else if (!['apn', 'gcm', 'fcm', 'tpns', 'voip'].includes(tokenType)) {
        return next(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid token type. expected apn, gcm, fcm, tpns or voip.' }))
      } else if (utils.path(req.orgClient, 'key') === config('webApp.apiKey')) {
        return next(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid app api key.' }))
      }

      Location.findOne({ _id: locationId }, function(err, location) {
        if (err) {
          return next(err)
        } else if (!location) {
          utils.outputResults(res, null, false)
        } else if (tokenType === 'apn') {
          Location.assignIosNotificationToken(token, principal, location, (err) => {
            utils.outputResults(res, null, !err)
          })
        } else if (tokenType === 'gcm') {
          Location.assignGcmRegistrationId(token, principal, location, (err) => {
            utils.outputResults(res, null, !err)
          })
        } else if (tokenType === 'fcm') {
          Location.assignFcmRegistrationToken(token, principal, location, (err) => {
            utils.outputResults(res, null, !err)
          })
        } else if (tokenType === 'tpns') {
          Location.assignTpnsRegistrationToken(token, principal, location, (err) => {
            utils.outputResults(res, null, !err)
          })
        } else if (tokenType === 'voip') {
          Location.assignVoipToken(token, principal, location, (err) => {
            utils.outputResults(res, null, !err)
          })
        } else {
          utils.outputResults(res, null, false)
        }
      })

    }
  )

  /**
     * Update Location
     */
  router.put('/locations/:id',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res, next) {

      const locationId = utils.getIdOrNull(req.params.id)
      if (!locationId) {
        return next(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid locationId' }))
      }
      modules.db.models.location.nodeUpdate(req.principal, { org: req.orgId, accountId: req.principal._id, _id: locationId }, req.body || {}, { req: req }, function(err) {
        if (err) next(err)
        else {
          modules.db.models.location.nodeList(req.principal, { _id: locationId, org: req.orgId, accountId: req.principal._id }, { req: req, single: true }, function(err, doc) {
            utils.outputResults(res, err, doc)
          })
        }
      })

    }
  )

  /**
     * Delete Location
     */
  router.delete('/locations/:id',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res, next) {

      const locationId = utils.getIdOrNull(req.params.id),
            requiredScope = `object.delete.location.${locationId}`

      if (!locationId) {
        return next(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid locationId' }))
      }

      if (!modules.authentication.authInScope(req.principal.scope, requiredScope)) {
        return next(Fault.create('cortex.accessDenied.scope', { path: requiredScope }))
      }

      modules.db.models.location.collection.deleteMany({ org: req.orgId, accountId: req.principal._id, _id: locationId }, { writeConcern: { w: 'majority' } }, function(err, result) {
        result = result ? result.result : result
        if (!err && !result) {
          err = Fault.create('cortex.notFound.unspecified')
        }
        if (err) {
          return next(err)
        }
        modules.db.models.Callback.deleteMany({ handler: consts.callbacks.ver_location, targetId: req.principal._id, 'data.locationId': locationId }, function(err) {
          if (err) logger.error('failed to delete callbacks for location', Object.assign(utils.toJSON(err, { stack: true }), { locationId }))
          utils.outputResults(res, err, true)
        })
      })

    }
  )

}
