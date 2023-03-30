'use strict'

const _ = require('underscore'),
      modules = require('../../../modules'),
      middleware = require('../../../middleware'),
      IterableCursor = require('../../../classes/iterable-cursor'),
      { outputResults, stringToBoolean, rBool } = require('../../../utils'),
      config = require('cortex-service/lib/config'),
      acl = require('../../../acl')

module.exports = function(express, router) {

  /**
   * Get the latest developer deployment source
   */
  router.post('/developer/environment/export',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'production' ? middleware.role_restricted.org_admin_only : middleware.role_restricted.developer_only,
    middleware.policy,
    function(req, res) {
      const options = _.pick(req.body || {}, 'manifest', 'preferUrls', 'silent', 'package'),
            ac = new acl.AccessContext(req.principal, null, { req })

      ac.principal = ac.principal.clone().merge(ac, { skipAcl: true, grant: 'script' })

      options.preferUrls = stringToBoolean(req.query.preferUrls, rBool(options.preferUrls, true))
      options.silent = stringToBoolean(req.query.silent, rBool(options.silent, false))

      modules.developer.exportEnvironment(ac, options, (err, cursor) => {
        outputResults(res, err, cursor)
      })
    }
  )

  /**
   * Update the deployment from developer source.
   */
  router.post('/developer/environment/import',
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'production' ? middleware.role_restricted.org_admin_only : middleware.role_restricted.developer_only,
    function(req, res, next) {

      let err

      const options = {
              backup: stringToBoolean(req.query.backup, false),
              triggers: stringToBoolean(req.query.triggers, false),
              production: stringToBoolean(req.query.production, false)
            },
            ac = new acl.AccessContext(req.principal, null, { req })

      ac.principal = ac.principal.clone().merge(ac, { skipAcl: true, grant: 'script' })

      IterableCursor.fromHttp(req)
        .catch(e => {
          err = e
        })
        .then(cursor => {
          if (err) {
            return next(err)
          }
          modules.developer.importEnvironment(ac, cursor, options, (err, cursor) => {
            outputResults(res, err, cursor)
          })
        })

    })

}
