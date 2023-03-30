'use strict'

const modules = require('../../../modules'),
      middleware = require('../../../middleware'),
      { outputResults, path: pathTo, stringToBoolean } = require('../../../utils'),
      config = require('cortex-service/lib/config')

module.exports = function(express, router) {

  router.get('/config',
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'development' ? middleware.role_restricted.developer_only : middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res) {
      const extended = stringToBoolean(req.query.extended, false)
      modules.config.keys(req.org, { extended }, (err, result) => {
        outputResults(res, err, result)
      })
    }
  )

  router.get('/config/:key',
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'development' ? middleware.role_restricted.developer_only : middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res) {
      const extended = stringToBoolean(req.query.extended, false)
      modules.config.get(req.org, req.params.key, { extended }, (err, result) => {
        outputResults(res, err, result)
      })
    }
  )

  router.put('/config/:key',
    middleware.body_parser.runtime.loose,
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'development' ? middleware.role_restricted.developer_only : middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res) {
      const extended = stringToBoolean(req.query.extended, false),
            body = extended ? pathTo(req.body, 'value') : req.body,
            isPublic = extended ? pathTo(req.body, 'isPublic') : null
      modules.config.set(req.org, req.params.key, body, { isPublic }, (err, result) => {
        outputResults(res, err, result)
      })
    }
  )

}
