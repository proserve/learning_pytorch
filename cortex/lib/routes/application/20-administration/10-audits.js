'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      Audit = modules.db.models.Audit,
      utils = require('../../../utils'),
      _ = require('underscore'),
      config = require('cortex-service/lib/config'),
      acl = require('../../../acl')

module.exports = function(express, router) {

  router.get('/audit/',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res) {

      const options = _.pick(req.query, 'paths', 'include', 'skip', 'limit', 'where', 'map', 'sort', 'pipeline')

      options.total = utils.rBool(utils.stringToBoolean(req.query.total), false)
      options.req = req
      options.passive = utils.stringToBoolean(utils.path(req.query, 'passive'))

      options.parserExecOptions = {
        maxTimeMS: utils.clamp(utils.rInt(req.query.maxTimeMS, config('query.defaultMaxTimeMS')), 1, config('query.maxTimeMS')), // legacy default to max.
        explain: req.principal.isDeveloper() && req.query.explain,
        engine: req.query.engine
      }

      options.skipAcl = true
      options.grant = acl.AccessLevels.Read

      if (options.limit === undefined) {
        options.limit = config('contexts.defaultLimit')
      } else if (utils.stringToBoolean(options.limit, true) === false) {
        options.limit = false
      }

      Audit.aclCursor(req.principal, options, function(err, cursor) {
        utils.outputResults(res, err, cursor)
      })

    }
  )

  router.post('/audit/',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res) {

      const options = _.pick(req.body, 'paths', 'include', 'skip', 'limit', 'where', 'map', 'sort', 'pipeline')

      options.total = utils.rBool(utils.stringToBoolean(req.body.total), false)
      options.req = req
      options.passive = utils.stringToBoolean(utils.path(req.body, 'passive'))

      options.parserExecOptions = {
        maxTimeMS: utils.clamp(utils.rInt(req.body.maxTimeMS, config('query.defaultMaxTimeMS')), 1, config('query.maxTimeMS')), // legacy default to max.
        explain: req.principal.isDeveloper() && req.body.explain,
        engine: req.body.engine
      }

      options.skipAcl = true
      options.grant = acl.AccessLevels.Read

      if (options.limit === undefined) {
        options.limit = config('contexts.defaultLimit')
      } else if (utils.stringToBoolean(options.limit, true) === false) {
        options.limit = false
      }

      Audit.aclCursor(req.principal, options, function(err, cursor) {
        utils.outputResults(res, err, cursor)
      })

    }
  )

}
