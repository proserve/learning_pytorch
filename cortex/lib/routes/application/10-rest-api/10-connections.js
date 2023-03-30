'use strict'

const utils = require('../../../utils'),
      modules = require('../../../modules'),
      middleware = require('../../../middleware'),
      _ = require('underscore'),
      async = require('async'),
      consts = require('../../../consts')

/**
 * @note Connection creation occurs later in the objects router due to /:object route ordering
 */
module.exports = function(express, router) {

  /**
     * List connections
     * @param req.query.limit
     * @param req.query.where
     * @param req.query.map
     * @param req.query.sort
     * @param req.query.group
     * @param req.query.limit
     * @param req.query.paths
     * @param req.query.expand
     * @param req.query.include
     * @param req.query.show
     * @param req.query.pipeline
     */
  router.get('/connections',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res) {

      const options = _.pick(req.query, 'startingAfter', 'endingBefore', 'paths', 'include', 'expand', 'where', 'map', 'group', 'sort', 'skip', 'show', 'state', 'objects', 'pipeline')
      options.req = req
      options.limit = utils.queryLimit(utils.path(req.query, 'limit'))
      options.passive = utils.stringToBoolean(utils.path(req.query, 'passive'))

      modules.db.models.connection.listConnections(req.principal, options, function(err, docs) {
        utils.outputResults(res, err, docs)
      })

    }
  )

  /**
     * Retrieve a Connection Via Token
     * @param req.params.token
     * @param req.query.paths
     * @param req.query.expand
     * @param req.query.include
     */
  router.get('/connections/:token',
    middleware.client_detection.default,
    middleware.authorize.anonymous_and_faulty,
    middleware.policy,
    function(req, res, next) {

      const token = utils.path(req, 'params.token'),
            options = _.pick(req.query, 'paths', 'include', 'expand')

      if (utils.isIdFormat(token)) {
        return next()
      }

      options.req = req
      options.passive = utils.stringToBoolean(utils.path(req.query, 'passive'))
      modules.db.models.connection.loadConnectionByToken(req.principal, token, options, function(err, json) {
        utils.outputResults(res, err, json)
      })
    }
  )

  /**
     * Retrieve a Connection
     * @param req.params.id
     * @param req.query.paths
     * @param req.query.expand
     * @param req.query.include
     */
  router.get('/connections/:id',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res) {

      const options = _.pick(req.query, 'paths', 'include', 'expand')
      options.req = req
      options.passive = utils.stringToBoolean(utils.path(req.query, 'passive'))

      modules.db.models.connection.loadConnection(req.principal, req.params.id, options, function(err, json) {
        utils.outputResults(res, err, json)
      })
    }
  )

  /**
     * Get Connection Property
     * @param req.params.token
     * @param req.params.*.
     */
  router.get('/connections/:token/*',
    middleware.client_detection.default,
    middleware.authorize.anonymous_and_faulty,
    middleware.policy,
    function(req, res, next) {

      const token = utils.path(req, 'params.token'),
            path = utils.normalizeObjectPath(req.params[0].replace(/\//g, '.')),
            options = {
              req: req,
              singlePath: path,
              paths: path
            }

      if (utils.isIdFormat(token)) {
        return next()
      }

      modules.db.models.connection.loadConnectionByToken(req.principal, token, options, function(err, json) {
        let prop
        if (!err) {
          prop = utils.digIntoResolved(json, path)
        }
        utils.outputResults(res, err, prop)
      })

    }
  )

  /**
     * Get Connection Property
     * @param req.params.id
     * @param req.params.*.
     */
  router.get('/connections/:id/*',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res) {

      const path = utils.normalizeObjectPath(req.params[0].replace(/\//g, '.')),
            options = {
              req: req,
              singlePath: path,
              paths: path
            }

      modules.db.models.connection.loadConnection(req.principal, req.params.id, options, function(err, json) {

        let prop
        if (!err) {
          prop = utils.digIntoResolved(json, path)
        }
        utils.outputResults(res, err, prop)

      })

    }
  )

  /**
     * Apply Connection
     * @param req.params.token
     */
  router.post('/connections/:token',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res, next) {

      const token = utils.path(req, 'params.token'),
            options = {
              req: req
            }

      if (utils.isIdFormat(token)) {
        return next()
      }

      modules.db.models.connection.applyToken(req.principal, token, options, function(err, json) {
        utils.outputResults(res, err, json)
      })

    }
  )

  /**
     * Reject connection
     * @param req.params.token
     */
  router.delete('/connections/:token',
    middleware.client_detection.default,
    middleware.authorize.anonymous_and_faulty,
    middleware.policy,
    function(req, res, next) {

      const token = utils.path(req, 'params.token')
      if (utils.isIdFormat(token)) {
        return next()
      }

      async.waterfall([

        // load the connection
        function(callback) {
          modules.db.models.connection.loadConnectionByToken(req.principal, token, { skipAccountTest: true, json: false, req: req }, callback)
        },

        function(connection, ac, callback) {
          connection.removeConnection(ac, { skipAcl: true }, function(err) {
            callback(err, ac, connection)
          })
        },

        // cleanup notifications
        function(ac, connection, callback) {
          modules.notifications.acknowledgeOnOrBefore(utils.path(connection, 'target.account._id'), consts.Notifications.Types.InviteExistingUser._id, ac.objectName, ac.subjectId, new Date())
          callback()
        }

      ], function(err) {
        utils.outputResults(res, err, true)
      })

    }
  )

  /**
     * Delete connection
     * @param req.params.id
     */
  router.delete('/connections/:id',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res) {

      async.waterfall([

        // load the connection
        function(callback) {
          modules.db.models.connection.loadConnection(req.principal, utils.path(req, 'params.id'), { json: false }, callback)
        },

        // check for access and delete. though the connection might be visible,
        // the caller still needs share access to the context if the
        function(connection, ac, callback) {
          connection.removeConnection(ac, function(err) {
            callback(err, ac, connection)
          })
        },

        // cleanup notifications
        function(ac, connection, callback) {
          modules.notifications.acknowledgeOnOrBefore(utils.path(connection, 'target.account._id'), consts.Notifications.Types.InviteExistingUser._id, ac.objectName, ac.subjectId, new Date())
          callback()
        }

      ], function(err) {
        utils.outputResults(res, err, true)
      })

    }
  )

}
