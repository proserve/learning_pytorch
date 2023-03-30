'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
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

  function validateSystemRouteClient(includeOrgs = null) {

    const limits = {
            allowSessions: false,
            allowSigned: true,
            allowUnsigned: false,
            includeOrgs
          },
          clientDetection = middleware.client_detection(),
          clientLimits = middleware.client_limits(limits)

    return function(req, res, next) {
      clientDetection(req, res, function(err) {
        if (err) {
          return next(err)
        }
        clientLimits(req, res, function(err) {
          if (err || req.orgClient.key !== config('hub.apiKey')) {
            return next(err || Fault.create('cortex.accessDenied.unspecified'))
          }
          next()
        })
      })
    }
  }

  validateSystemRouteClient.default = validateSystemRouteClient()
  validateSystemRouteClient.medable = validateSystemRouteClient(['medable'])

  /**
     * provision a local project.
     */
  router.post('/hub/system/projects/provision',
    middleware.body_parser.strict,
    validateSystemRouteClient.medable,
    middleware.authorize.anonymous,
    function(req, res, next) {

      const body = req.body || {},
            options = _.pick(body, 'validateOrgCode', 'validateOnly')

      // use the hub organization's logo and favicon?
      modules.org.provision(body.project || {}, body.account || {}, options, (err, result) => {
        utils.outputResults(res, err, result)
      })

    }
  )

  /**
     * list local projects and their hub configuration.
     */
  router.get('/hub/system/projects',
    middleware.body_parser.strict,
    validateSystemRouteClient.medable,
    middleware.authorize.anonymous,
    function(req, res, next) {
      const options = _.extend(
        _.pick(req.query, 'skip', 'limit', 'where', 'sort'),
        {
          total: true,
          req,
          crossOrg: true,
          skipAcl: true,
          grant: acl.AccessLevels.System,
          paths: [...modules.hub.readableEnvironmentPaths(req.org, req.principal.roles), 'creator.email']

        }
      )
      modules.db.models.org.aclList(ap.synthesizeOrgAdmin(req.org), options, (err, results) => {
        utils.outputResults(res, err, results)

      })
    }
  )

}
