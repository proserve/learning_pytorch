'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      consts = require('../../../consts'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      acl = require('../../../acl'),
      _ = require('underscore')

let Undefined

module.exports = function(express, router) {

  router.post('/sys/script_runner',
    middleware.cors.runtime({
      ac_expose_headers: `Cortex-Sandbox-Stats, ${middleware.cors.options.ac_expose_headers}`,
      options_methods: 'POST, OPTIONS',
      request_methods: 'POST'
    }),
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.developer_and_support_only,
    middleware.policy,
    function(req, res, next) {

      const isProduction = config('app.env') === 'production',
            isDevDev = !isProduction && req.principal.isDeveloper(),
            isOrgAdmin = req.principal.isOrgAdmin(),
            isSysAdmin = req.principal.isSysAdmin(),
            isSupportLogin = req.principal.isSupportLogin,
            requiredScope = 'script.execute.runner',
            scriptSource = utils.rString(utils.path(req, 'body.script'), '')

      if (!(isDevDev || isOrgAdmin || isSupportLogin)) {
        next(Fault.create('cortex.accessDenied.unspecified', { reason: 'Running arbitrary scripts is not allowed in production.' }))
      } else if (!modules.authentication.authInScope(req.principal.scope, requiredScope, false)) {
        next(Fault.create('cortex.accessDenied.scope', { path: requiredScope }))
      } else {

        const ac = new acl.AccessContext(req.principal, null, { req: req }),
              context = {
                object: 'script',
                _id: consts.emptyId
              }, scriptRunner = modules.sandbox.sandboxed(
                ac,
                scriptSource,
                {
                  optimize: utils.stringToBoolean(utils.path(req, 'body.optimize')),
                  compilerOptions: {
                    type: 'route',
                    language: utils.path(req, 'body.language'),
                    specification: utils.path(req, 'body.specification')
                  },
                  scriptOptions: {
                    addBodyApi: true,
                    mustRunNext: isSysAdmin || isSupportLogin
                  }
                },
                utils.path(req, 'body.arguments')
              ),
              body = utils.path(req, 'body.body'),
              event = {
                context
              }

        if (body !== Undefined) {
          req.body = body
        }

        if (isProduction || isSupportLogin) {
          event.metadata = { scriptSource }
        }

        modules.audit.recordEvent(ac, 'developer', 'runner', event, (err, eventId) => {

          void err

          scriptRunner((err, result, script, sandboxStats) => {

            if (sandboxStats) {
              sandboxStats = _.omit(sandboxStats, 'rss', 'begin', 'end', 'flags')
            }

            if (err) {
              modules.audit.updateEvent(eventId, { err, metadata: sandboxStats }, () => {
              })
            }

            if (sandboxStats && !res.headersSent) {
              try {
                res.setHeader('Cortex-Sandbox-Stats', JSON.stringify(sandboxStats))
              } catch (err) {
                void err
              }
            }
            utils.outputResults(res, err, result)

          })
        })

      }
    }
  )

}
