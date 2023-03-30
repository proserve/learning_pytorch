'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      _ = require('underscore'),
      async = require('async'),
      Fault = require('cortex-service/lib/fault')

module.exports = function(express, router) {

  /**
     * List all Notifications
     */
  router.get('/notifications',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res) {

      const options = _.pick(req.query, 'startingAfter', 'endingBefore', 'paths', 'include', 'expand', 'skip', 'where', 'map', 'group', 'sort', 'pipeline')
      options.req = req
      options.script = null
      options.limit = utils.queryLimit(utils.path(req.query, 'limit'))
      options.passive = utils.stringToBoolean(utils.path(req.query, 'passive'))

      modules.db.models.notification.nodeList(req.principal, { account: req.principal._id }, options, function(err, docs) {
        utils.outputResults(res, err, docs)
      })

    }
  )

  /**
     * Clear Notification (by id)
     */
  router.delete('/notifications/:id',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res, next) {

      const id = utils.getIdOrNull(req.params.id)
      if (!id) {
        return next()
      }

      if (!modules.authentication.authInScope(req.principal.scope, 'object.delete.notification')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'object.delete.notification' }))
      }

      modules.notifications.acknowledgeId(req.principal._id, id, function(err, numRemoved) {
        utils.outputResults(res, err, numRemoved)
      })
    }
  )

  /**
     * Clear Post Notifications
     * @param req.query.ids[]
     * @param req.query.postTypes[]
     */
  router.delete('/notifications/posts',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'object.delete.notification')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'object.delete.notification' }))
      }

      modules.notifications.acknowledgePostOnOrBefore(req.principal, req.query.ids ? utils.getIdArray(req.query.ids) : null, req.query.postTypes, new Date(), function(err, numRemoved) {
        utils.outputResults(res, err, numRemoved)
      })
    }
  )

  /**
     * Clear Comment Notifications
     * @param req.query.ids[]
     */
  router.delete('/notifications/comments',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'object.delete.notification')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'object.delete.notification' }))
      }

      modules.notifications.acknowledgeCommentOnOrBefore(req.principal, utils.getIdArray(req.query.ids), Date.now(), function(err, numRemoved) {
        utils.outputResults(res, err, numRemoved)
      })
    }
  )

  /**
     * Clear Notifications
     * @param req.query.type: limits the operation to a notification type
     * @param req.params.objects
     * @param req.params.contextId
     */
  router.delete('/notifications/:objects?/:contextId?',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'object.delete.notification')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'object.delete.notification' }))
      }

      async.waterfall([

        callback => {
          const objectName = req.params.objects
          if ((!_.isString(objectName) || objectName.length === 0)) {
            return callback(null, null)
          }
          req.org.createObject(objectName, function(err, object) {
            callback(err, utils.path(object, 'objectName'))
          })
        },

        (objectName, callback) => {

          const type = req.query.type, contextId = utils.getIdOrNull(req.params.contextId)
          if (contextId) {
            modules.notifications.acknowledgeOnOrBefore(req.principalId, type, objectName, contextId, Date.now(), callback)
          } else {
            modules.notifications.acknowledgeAllOnOrBefore(req.principal, type, objectName, Date.now(), callback)
          }

        }

      ], (err, numRemoved) => {
        utils.outputResults(res, err, numRemoved)
      })
    }
  )

}
