'use strict'

const modules = require('../../../modules'),
      middleware = require('../../../middleware'),
      utils = require('../../../utils'),
      _ = require('underscore'),
      config = require('cortex-service/lib/config')

module.exports = function(express, router) {

  router.get('/stats',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.developer_and_support_only,
    middleware.policy,
    function(req, res) {

      const options = _.pick(req.query, 'startingAfter', 'endingBefore', 'paths', 'where', 'map', 'group', 'sort', 'skip', 'pipeline'),
            find = (req.principal.isSysAdmin() && utils.stringToBoolean(utils.path(req.query, 'crossOrg'))) ? null : { org: req.orgId }

      options.req = req
      options.limit = utils.queryLimit(utils.path(req.query, 'limit'))
      options.total = utils.rBool(utils.stringToBoolean(req.query.total), false)
      options.parserExecOptions = {
        maxTimeMS: config('query.defaultMaxTimeMS'),
        engine: req.query.engine
      }

      modules.db.models.Stat.nodeList(req.principal, find, options, function(err, docs) {
        utils.outputResults(res, err, docs)
      })

    }
  )

}
