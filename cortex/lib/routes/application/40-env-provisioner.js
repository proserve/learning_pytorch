'use strict'

const _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      middleware = require('../../middleware'),
      modules = require('../../modules'),
      utils = require('../../utils'),
      { asyncHandler } = utils

module.exports = function(express, router) {

  router.post('/sys/orgs/provision',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.client_limits({ allowSessions: false, allowSigned: true, allowUnsigned: false, includeOrgs: 'medable' }),
    function(req, res, next) {

      const body = req.body || {},
            options = _.pick(body, 'validateOrgCode', 'validateOnly')
      options.req = req
      modules.org.provision(body.org || {}, body.account || {}, options, (err, result) => {
        utils.outputResults(res, err, result)
      })

    }
  )

  router.delete('/sys/env/:code',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.env_restricted.development,
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.policy,
    asyncHandler(async function(req) {
      if (!modules.authentication.authInScope(req.principal.scope, 'admin', false)) {
        throw Fault.create('cortex.accessDenied.scope', { path: 'admin' })
      }
      return modules.hub.teardownEnv(req.params.code, { req })
    })
  )

  router.post('/sys/env',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.policy,
    asyncHandler(async function(req, res) {
      if (!modules.authentication.authInScope(req.principal.scope, 'admin', false)) {
        throw Fault.create('cortex.accessDenied.scope', { path: 'admin' })
      }
      return modules.hub.provisionEnv(req.body, { req })
    }))

}
