'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      stripe = require('stripe')(config('integrations.stripe.live') ? config('integrations.stripe.server.live.key') : config('integrations.stripe.server.test.key'))

/**
 * These routes are only available to the web app client.
 */
module.exports = function(express, router) {

  /**
     * Get customer billing data
     */
  router.get('/integrations/stripe/customers/:customerId',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.read')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'admin.read' }))
      }

      stripe.customers.retrieve(req.params.customerId, function(err, customer) {
        utils.outputResults(res, err, customer)
      })
    }
  )

  /**
     * Add/Update Stripe Payment Source
     */
  router.post('/integrations/stripe/customers/:customerId',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.update')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'admin.update' }))
      }

      stripe.customers.update(req.params.customerId, { source: utils.path(req, 'body.token') }, function(err, customer) {
        utils.outputResults(res, err, customer)
      })
    }
  )

}
