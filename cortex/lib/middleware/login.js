'use strict'

const utils = require('../../lib/utils'),
      Fault = require('cortex-service/lib/fault'),
      async = require('async'),
      _ = require('underscore'),
      config = require('cortex-service/lib/config'),
      logger = require('cortex-service/lib/logger'),
      modules = require('../modules'),
      middleware = require('../middleware'),
      ap = require('../../lib/access-principal'),
      acl = require('../../lib/acl'),
      sessionInitializer = middleware.session_initializer({ regenerate: true })

function loginMiddleware(opts) {

  const options = {
    fingerprint: null,
    password: null,
    account: null,
    body: null,
    script: null,
    verifyLocation: true,
    sso: false,
    beforeLogin: function(req, body, principal, account, callback) { callback() }
  }
  utils.extend(options, opts)

  return function(req, res, next) {

    const body = options.body || req.body || {}

    // @todo remove me. this was a pre-scripting hack.
    try {
      res.setHeader('P3P', 'CP="ALL DSP COR LAW CURa ADMa DEVa TAIa CONi OUR IND PHY COM DEM STA HEA LOC"')
    } catch (e) {}

    async.waterfall([

      // ensure the client key supports sessions.
      function(callback) {

        let err
        const clientSessions = req.orgClient ? req.orgClient.sessions : true

        if (!clientSessions) {
          err = Fault.create('cortex.accessDenied.app', { reason: 'Client api sessions not supported.' })
        }
        callback(err)
      },

      // ensure the fingerprint is valid. this triggers session support.
      function(callback) {
        if (options.verifyLocation) {
          modules.authentication.readFingerprint(req, res, { create: true, allowNull: false, fingerprint: options.fingerprint }, function(err, fingerprint) {
            callback(err, fingerprint)
          })
        } else {
          callback(null, null)
        }
      },

      // make sure we have session support
      function(fingerprint, callback) {
        sessionInitializer(req, res, function(err) {
          callback(err, fingerprint)
        })
      },

      // perform email/password authentication
      function(fingerprint, callback) {
        if (!options.account) {
          modules.authentication.attemptAuth(req.org, utils.path(body, 'email') || utils.path(body, 'username'), utils.path(body, 'password'), { req, script: options.script, checkLock: true, checkExpired: true, newPassword: utils.path(body, 'newPassword') }, (err, account) => {
            callback(err, fingerprint, account)
          })
        } else {
          callback(null, fingerprint, options.account)
        }
      },

      // create the session access principal
      function(fingerprint, account, callback) {
        if (!account) {
          callback(Fault.create('cortex.accessDenied.invalidCredentials'))
        } else {
          ap.create(req.org, account, function(err, principal) {
            callback(err, principal, fingerprint, account)
          })
        }
      },

      // fire pre-login event
      function(principal, fingerprint, account, callback) {

        // maintenance mode?
        if (req.org.maintenance) {
          if (!principal || !principal.isDeveloper()) {
            return callback(Fault.create('cortex.accessDenied.maintenance', { reason: req.org.maintenanceMessage }))
          }
        }

        req.log.oid = req.log.pid = principal._id
        if (req.sessionID) {
          req.log.ses = req.sessionID
        }

        try {
          options.beforeLogin(req, body, principal, account, function(err) {
            // after pre-login event, check if we're still not activated.
            if (!err && account.activationRequired) {
              err = Fault.create('cortex.accessDenied.accountActivationRequired')
            }
            callback(err, principal, fingerprint, account)

          })
        } catch (err) {
          callback(err)
        }
      },

      // validate the location and login.
      function(principal, fingerprint, account, callback) {

        if (fingerprint) {
          modules.locations.handleLocationLogin(req, fingerprint, utils.path(body, 'location'), principal, function(err, location) {
            callback(err, principal, fingerprint, account, location)
          })
        } else {
          callback(null, principal, fingerprint, account, null)
        }
      },

      // trigger scripts
      function(principal, fingerprint, account, location, callback) {

        const ac = new acl.AccessContext(principal, account, { req: req })
        modules.sandbox.triggerScript('signin.before', null, ac, { requestBody: _.omit(body, 'password') }, function(err) {
          callback(err, ac, fingerprint, account, location)
        })

      },

      // update last login inline so results can be used immediately
      function(ac, fingerprint, account, location, callback) {
        modules.db.models.Account.updateLastLogin(ac.principal._id, utils.getClientIp(req), err => {
          void err
          callback(null, ac, fingerprint, account, location)
        })
      },

      // perform login
      function(ac, fingerprint, account, location, callback) {

        req.logIn(ac.principal, function(err) {
          if (err) {
            callback(Fault.from(err))
          } else {

            // attach the key to the session. we compare it during authorization.
            if (fingerprint) {
              req.session.location = {
                _id: location._id,
                type: location.type,
                fingerprint: fingerprint
              }
              req.fingerprint = fingerprint
              req.locationId = location._id
            }

            if (options.sso) {
              req.session.sso = options.sso
            }

            // set the session expiration.
            const authDuration = utils.path(req.orgClient, 'authDuration') || config('sessions.authDuration'),
                  enforceCSRF = req.orgClient ? req.orgClient.csrf : true

            req.session.expires = new Date().getTime() + (authDuration * 1000)

            // enforce CSRF protection
            if (enforceCSRF) {
              req.session.csrfToken = modules.authentication.genAlphaNumString(64)
              res.setHeader('Medable-Csrf-Token', req.session.csrfToken)
            }

            // add the client key
            account.decryptClientKey(options.password || body.password, function(err, decryptedSecret) {
              let key = null
              if (!err && decryptedSecret) {
                key = {
                  fingerprint: account.key.fingerprint,
                  secret: decryptedSecret
                }
                req.session.clientKey = key
              }

              // trigger post login script.
              modules.sandbox.triggerScript('signin.after', null, ac, { requestBody: _.omit(body, 'password') }, () => {
                callback(null, fingerprint)
              })

            })

          }
        })
      },

      // logout other sessions
      function(fingerprint, callback) {

        if (!utils.path(req.org, 'configuration.allowSimultaneousLogins')) {
          modules.sessions.logoutAccounts(req.principal._id, req.principal.orgId, req.sessionID, function(err) {
            if (err) logger.debug('failed to logout other accounts', { error: err.stack || err, accountId: req.principal._id })
          })
        }

        callback()
      }

    ], function(err) {

      let tags = {
        org: req.orgCode,
        userAgent: req.headers['user-agent'] || 'unknown',
        app: req.orgApp.label,
        sso: !!options.sso,
        ...(err ? (Fault.isFault(err) ? { errCode: err.errCode } : { errCode: err.code }) : {})
      }
      modules.metrics.dd.increment(`cortex.auth.login.${err ? 'fail' : 'success'}`, tags)
      next(err)
    })
  }
}

module.exports = loginMiddleware
loginMiddleware.anonymous = loginMiddleware({ allowAnonymous: true })
loginMiddleware.default = loginMiddleware()
