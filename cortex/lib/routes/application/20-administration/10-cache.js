'use strict'

const modules = require('../../../modules'),
      middleware = require('../../../middleware'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault')

module.exports = function(express, router) {

  router.get('/cache/:keys?',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res) {
      modules.cache.list(req.org, req.params.keys || '', req.query.skip, req.query.limit, (err, result) => {
        utils.outputResults(res, err, result)
      })
    }
  )

  router.get('/cache/count/:keys',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res) {
      modules.cache.count(req.org, req.params.keys, (err, result) => {
        utils.outputResults(res, err, result)
      })
    }
  )

  router.get('/cache/key/:key',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res) {
      modules.cache.get(req.org, req.params.key, (err, result) => {
        if (!err && result === undefined) {
          err = Fault.create('cortex.notFound.cacheKey')
        }
        utils.outputResults(res, err, result)
      })
    }
  )

  router.get('/cache/has/:key',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res) {
      modules.cache.has(req.org, req.params.key, (err, result) => {
        utils.outputResults(res, err, result)
      })
    }
  )

  router.post('/cache/key/:key/:ttl?',
    middleware.body_parser.runtime.loose,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res) {
      modules.cache.set(req.org, req.params.key, req.body, utils.rInt(parseInt(req.params.ttl), null), (err, result) => {
        utils.outputResults(res, err, result)
      })
    }
  )

  router.delete('/cache/all/:keys?',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res) {
      modules.cache.clear(req.org, req.params.keys || '', (err, result) => {
        utils.outputResults(res, err, result)
      })
    }
  )

  router.delete('/cache/key/:key',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res) {
      modules.cache.del(req.org, req.params.key, (err, result) => {
        utils.outputResults(res, err, result)
      })
    }
  )

}
