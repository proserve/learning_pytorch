'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      async = require('async'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      acl = require('../../../acl'),
      ap = require('../../../access-principal')

module.exports = function(express, router) {

  /**
     * Support login.
     */
  router.post('/sys/orgs/support-login/:orgCode/:email',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.client_limits({ includeOrgs: 'medable', whitelist: config('administration.whitelist'), blacklist: config('administration.blacklist') }),
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.policy,
    function(req, res, next) {

      if (req.principal.scope) {
        return next(Fault.create('cortex.accessDenied.scoped'))
      }

      const reason = utils.rString(req.body.reason, '')
      if (!reason) {
        return next(Fault.create('cortex.accessDenied.supportReasonRequired', { reason: 'Support login requires a reason for the login.' }))
      }

      async.waterfall([

        function(callback) {
          modules.db.models.org.loadOrg(req.params.orgCode, function(err, org) {
            callback(err, org)
          })
        },

        function(org, callback) {
          if (org.state !== 'enabled') {
            return callback(Fault.create('cortex.invalidArgument.envDisabled'))
          }
          if (utils.path(org, 'support.disableSupportLogin')) {
            return callback(Fault.create('cortex.accessDenied.supportDisabled'))
          }

          const pinnedAccount = utils.rString(utils.path(org, 'support.pinnedAccount'), '').toLowerCase(),
                loginAs = utils.rString(req.params.email, '').toLowerCase()

          if (pinnedAccount && loginAs !== pinnedAccount) {
            return callback(Fault.create('cortex.accessDenied.supportPinned'))
          }

          ap.create(org, loginAs, function(err, principal) {
            callback(err, org, principal)
          })

        },

        // do switch.
        function(org, principal, callback) {

          req.org = org

          req.session.cookie.path = '/' + org.code
          req.session.passport.user.accountId = principal._id
          req.session.passport.user.orgId = org._id

          const passport = req.session.passport,
                location = req.session.location

          delete req.session.clientKey

          req.session.regenerate(function(err) {
            if (!err) {
              req.session.passport = passport
              req.session.location = location
              req.fingerprint = req.session.fingerprint = location.fingerprint
              req.session.isSupportLogin = true
            }
            callback(err, principal)
          })

        },

        function(supportPrincipal, callback) {

          async.parallel({
            by: function(callback) {

              modules.db.models.account.findOne({ _id: req.principal._id }).select('name').lean().exec(function(err, doc) {
                let name
                if (!err) {
                  name = (utils.rString(utils.path(doc, 'name.first'), '') + ' ' + utils.rString(utils.path(doc, 'name.last'), '')).trim()
                }
                callback(err, name)
              })

            },
            as: function(callback) {

              modules.db.models.account.findOne({ _id: supportPrincipal._id }).select('email').lean().exec(function(err, doc) {
                callback(err, utils.path(doc, 'email'))
              })

            }
          }, function(err, metadata) {

            metadata.reason = reason

            const originalPrincipal = req.principal
            req.principal = supportPrincipal

            modules.audit.recordEvent(
              new acl.AccessContext(supportPrincipal, null, { req }),
              'support',
              'login',
              { err, context: { object: 'account', _id: supportPrincipal._id }, metadata },
              () => {
                req.principal = originalPrincipal
                callback()
              })

          })

        }

      ], function(err) {

        utils.outputResults(res, err)

      })

    }
  )

}
