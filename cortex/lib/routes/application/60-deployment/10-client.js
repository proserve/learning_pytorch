'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      crypto = require('crypto'),
      config = require('cortex-service/lib/config'),
      acl = require('../../../acl')

function encrypt(data) {
  const cipher = crypto.createCipher('aes256', config('sessions.secret'))
  return cipher.update(JSON.stringify(data), 'utf8', 'base64') + cipher.final('base64')
}

function decrypt(data) {
  const decipher = crypto.createDecipher('aes256', config('sessions.secret'))
  return JSON.parse(decipher.update(data, 'base64', 'utf8') + decipher.final('utf8'))
}

function getOptions(req) {
  let token = req.header('Medable-Deployment-Token')
  if (token) {
    return { token: decrypt(token) }
  }
  return { session: req.session }
}

module.exports = function(express, router) {

  // client routes are only callable form the web app by admins.

  /**
     * Authenticate for Deployment
     * @description authenticate with target credentials
     */
  router.post('/deployments/source/authenticate/:id',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    modules.deployment.sourceCheckMiddleware,
    middleware.policy,
    function(req, res) {
      const { email, password, loginAs, token } = req.body || {}
      modules.deployment.authWithTarget(req.principal, req.params.id, { email, password, loginAs, token, isSupportLogin: req.principal.isSupportLogin }, function(err, deploymentSession) {
        if (!err) {
          if (req.session) {
            req.session.deploymentSession = deploymentSession
          } else {
            res.setHeader('Medable-Deployment-Token', encrypt(deploymentSession))
          }
        }
        utils.outputResults(res, err, true)
      })
    }
  )

  /**
     * Refresh Source Mappings
     */
  router.post('/deployments/source/refresh-mappings/:id',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    modules.deployment.sourceCheckMiddleware,
    middleware.policy,
    function(req, res, next) {
      modules.deployment.refreshMappings(new acl.AccessContext(req.principal, null, { req: req }), req.params.id, function(err, doc) {
        utils.outputResults(res, err, doc)
      })
    }
  )

  /**
     * Update Server Mappings
     */
  router.post('/deployments/source/update-mappings/:id',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    modules.deployment.sourceCheckMiddleware,
    middleware.policy,
    function(req, res, next) {
      modules.deployment.updateMappings(new acl.AccessContext(req.principal, null, { req: req }), utils.getIdOrNull(req.params.id), getOptions(req), function(err, doc) {
        utils.outputResults(res, err, doc)
      })
    }
  )

  /**
     * Deploy
     */
  router.post('/deployments/source/deploy/:id',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    modules.deployment.sourceCheckMiddleware,
    middleware.policy,
    function(req, res, next) {
      modules.deployment.deploy(new acl.AccessContext(req.principal, null, { req: req }), utils.getIdOrNull(req.params.id), getOptions(req), function(err, lastDeployed) {
        utils.outputResults(res, err, lastDeployed)
      })
    }
  )

  /**
     * Load Deployment Logs
     */
  router.get('/deployments/source/log/:id',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    modules.deployment.sourceCheckMiddleware,
    middleware.policy,
    function(req, res, next) {
      const options = Object.assign(getOptions(req), {
        skip: utils.path(req.query, 'skip'),
        runId: utils.path(req.query, 'runId'),
        limit: utils.path(req.query, 'limit')
      })
      modules.deployment.logs(new acl.AccessContext(req.principal, null, { req: req }), utils.getIdOrNull(req.params.id), options, function(err, results) {
        utils.outputResults(res, err, results)
      })
    }
  )

}
