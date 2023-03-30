'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      acl = require('../../../acl'),
      _ = require('underscore'),
      ap = require('../../../access-principal')

/**
 * These routes are called by the Hub. The client detection done here utilizes the keys configured in config.hub.[key/secret]
 *
 * @param express
 * @param router
 */
module.exports = function(express, router) {

  function validateEnvironmentRouteClient() {

    const limits = {
            allowSessions: false,
            allowSigned: true,
            allowUnsigned: false
          },
          clientDetection = middleware.client_detection(),
          clientLimits = middleware.client_limits(limits)

    return function(req, res, next) {
      clientDetection(req, res, function(err) {
        if (err) {
          return next(err)
        }
        clientLimits(req, res, function(err) {
          if (err || !req.org.hub || !req.org.hub.enabled || req.orgClient.key !== req.org.hub.envKey) {
            return next(err || Fault.create('cortex.accessDenied.unspecified'))
          }
          next()
        })
      })
    }
  }

  validateEnvironmentRouteClient.default = validateEnvironmentRouteClient()

  function notInMedable(req, res, next) {
    if (req.org.code === 'medable') {
      return next(Fault.create('cortex.accessDenied.unspecified', { reason: 'hub (1)' }))
    }
    next()
  }

  function notInHub(req, res, next) {
    if (req.org.code === 'hub') {
      return next(Fault.create('cortex.accessDenied.unspecified', { reason: 'hub (2)' }))
    }
    next()
  }

  /**
     * Create an ephemeral access token for hub users.
     *
     *  body: {
     *      principal: local account id or email,
     *      ... other token options
     *  }
     */
  router.post('/hub/environment/accounts/authenticate',
    middleware.body_parser.strict,
    validateEnvironmentRouteClient.default,
    notInMedable,
    notInHub,
    middleware.authorize.anonymous,
    function(req, res, next) {

      const tokenOptions = _.pick(req.body || {}, 'activatesIn', 'expiresIn', 'grant', 'maxUses', 'permanent', 'roles', 'scope', 'skipAcl', 'bypassCreateAcl', 'validAt', 'isSupportLogin'),
            hub = (req.org && req.org.hub) || null

      if (hub && hub.enabled) {
        tokenOptions.client = modules.hub.synthesizeApplicationClient(hub).clients[0]
      }

      // limit scope to permitted areas which do not include reading any phi.
      ap.create(req.org, req.body.principal, (err, principal) => {

        if (err) {
          return next(err)
        }

        const authentication = modules.authentication,
              limitTo = [
                'object.*.object',
                'object.*.script',
                'object.*.view',
                'object.*.template',
                'object.*.org',
                'object.*.account.' + principal._id,
                'admin.read',
                'admin.update',
                'script.execute.route'
              ],
              limitToScope = authentication.compileAuthScope(limitTo),
              desired = utils.array(tokenOptions.scope),
              desiredScope = authentication.compileAuthScope(desired),
              permittedScope = [],
              ac = new acl.AccessContext(req.principal, null, { req })

        desired.forEach(desired => authentication.authInScope(limitToScope, desired, false) && permittedScope.push(desired))
        limitTo.forEach(limitTo => authentication.authInScope(desiredScope, limitTo, false) && permittedScope.push(limitTo))
        tokenOptions.scope = permittedScope

        modules.authentication.createToken(ac, principal, null, tokenOptions, (err, result) => {
          utils.outputResults(res, err, result && { token: result.token, principal: principal.toObject() })
        })
      })

    }
  )

  /**
     * Provision an account in the local environment.
     *  body: {
     *      account: {
     *      },
     *      options: {
     *          maxExempt: false
     *      }
     *  }
     */
  router.post('/hub/environment/accounts/provision',
    middleware.body_parser.strict,
    notInMedable,
    notInHub,
    validateEnvironmentRouteClient.default,
    middleware.authorize.anonymous,
    function(req, res, next) {

      const options = {
        skipActivation: true,
        sendWelcomeEmail: false,
        requireMobile: false,
        maxExempt: utils.rBool(req.options && req.options.maxExempt, false),
        clientKey: req.orgClient.key
      }

      modules.accounts.provisionAccount(null, req.body.account || {}, req.org, 'en_US', 'verified', req, options, function(err, account) {
        utils.outputResults(res, err, account && {
          _id: account._id,
          name: {
            first: account.name.first,
            last: account.name.last
          },
          email: account.email
        })
      })
    }
  )

}
