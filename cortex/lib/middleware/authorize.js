'use strict'

const utils = require('../utils'),
      Fault = require('cortex-service/lib/fault'),
      async = require('async'),
      config = require('cortex-service/lib/config'),
      modules = require('../modules'),
      middleware = require('../middleware'),
      ap = require('../access-principal'),
      acl = require('../acl'),
      csrfCheckMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']),
      sessionInitializer = middleware.session_initializer()

module.exports = function(opts) {

  // if a fingerprint exists, sessions are always used.
  const options = {
    allowAnonymous: false,
    passFault: false,
    requireSession: false,
    allowNullFingerprint: false,
    passMaintenanceMode: false,
    policyTags: []
  }

  utils.extend(options, opts)

  if (options.allowAnonymous) options.allowNullFingerprint = true

  return function(req, res, next) {

    if (req.principal) {
      return next()
    }

    const clientSessions = req.bearerToken ? false : (req.orgClient ? req.orgClient.sessions : true),
          // check csrf token?
          checkCSRFToken = req.bearerToken ? false : (csrfCheckMethods.has(req.method) && clientSessions && req.orgClient && req.orgClient.csrf)

    async.waterfall([

      // the client determines whether to use sessions.
      function(callback) {
        if (clientSessions) {
          sessionInitializer(req, res, function(err) {
            callback(err)
          })
        } else {
          callback(null)
        }
      },

      // read fingerprint.
      function(callback) {

        const locationLess = !req.session || !req.session.location
        if (locationLess) {
          callback(null, null)
        } else {
          modules.authentication.readFingerprint(req, res, { create: false, allowNull: options.allowNullFingerprint || !clientSessions }, function(err, fingerprint) {
            callback(err, fingerprint)
          })
        }
      },

      // read the session or authorize using another strategy.
      function(fingerprint, callback) {

        if (options.requireSession && !req.session) {

          callback(Fault.create('cortex.error.sessionRequired'))

        } else if (req.bearerToken) {

          modules.authentication.authenticateToken(new acl.AccessContext(ap.synthesizeAnonymous(req.org), null, { req }), req.bearerToken, { checkPolicy: true, tags: options.policyTags }, (err, { principal, account } = {}) => {

            if (err) {
              return callback(err, fingerprint)
            }

            req.log.oid = req.log.pid = principal._id
            req.principal = principal

            modules.sandbox.triggerScript('authorizeToken.after', null, new acl.AccessContext(principal, account, { req }), function(err) {
              callback(err, fingerprint)
            })

          })

        } else if (clientSessions) {

          // @todo: get rid of passport. it isn't really helping us, and we can't pass the org into the authenticator. sucks.
          // this will de-serialize the session into req.principal. see api-controllers/1-account.js :: passport.deserializeUser()

          /*
                     passport.authenticate('session', function(err) {
                     callback(err, fingerprint);
                     })(req, res, function(err) {
                     callback(err, fingerprint);
                     });
                     return;
                     */

          const sessionAccountId = utils.getIdOrNull(utils.path(req.session, 'passport.user.accountId')),
                sessionOrgId = utils.getIdOrNull(utils.path(req.session, 'passport.user.orgId'))

          if (sessionAccountId) {
            req.log.oid = req.log.pid = sessionAccountId
            req.log.ses = req.sessionID
            req.log.lid = utils.path(req, 'session.location._id')
          }

          if (!sessionAccountId) {
            callback(null, null)
          } else {
            ap.create(req.org, sessionAccountId, function(err, principal) {
              if (!err) {
                req.principal = principal
                if (!sessionOrgId || !utils.equalIds(req.orgId, sessionOrgId)) {
                  err = Fault.create('cortex.accessDenied.sessionOrgMismatch')
                }
              }

              if (err) {
                modules.sessions.destroy(req, { err }, () => {
                  callback(err)
                })
              } else {
                req.principal.isSupportLogin = req.session.isSupportLogin
                callback(null, fingerprint)
              }

            })
          }

        } else {

          // if valid, set the principal (check for principal override). an unsigned principal is always anonymous.
          let principalId = acl.AnonymousIdentifier,
              principalEmail = null

          if (req.signature) {
            const headerPrincipal = req.header('Medable-Client-Account')
            if (req.orgClient.principalOverride && headerPrincipal) {
              const id = utils.getIdOrNull(headerPrincipal)
              if (id) {
                principalId = id
              } else {
                principalEmail = !id && modules.validation.isEmail(headerPrincipal) && headerPrincipal.toLowerCase()
              }
            } else if (req.orgClient.principalId) {
              principalId = req.orgClient.principalId
            }
          }

          req.log.oid = req.log.pid = principalId

          if (!principalEmail && (utils.equalIds(principalId, acl.AnonymousIdentifier) || utils.equalIds(principalId, acl.PublicIdentifier))) {
            req.principal = ap.synthesizeAccount({ org: req.org, accountId: principalId })
            callback(null, fingerprint)
          } else if (!principalEmail && utils.equalIds(principalId, acl.SystemAdmin)) {
            callback(Fault.create('cortex.accessDenied.principal'))
          } else {
            ap.create(req.org, principalEmail || principalId, function(err, principal) {
              if (!err) {
                principalId = principal._id
                req.log.oid = req.log.pid = principalId
              }
              if (utils.equalIds(principalId, acl.SystemAdmin) || (principal && principal.role)) { // can never run as role
                err = Fault.create('cortex.accessDenied.principal')
              } else {
                req.principal = principal
              }
              callback(err, null)
            })
          }
        }

      },

      // catch anything coming out of passport session loader
      function(fingerprint, callback) {

        let err, principal = req.principal

        if ((!principal || principal.isAnonymous()) && !options.allowAnonymous) {
          err = Fault.create('cortex.accessDenied.notLoggedIn')
        }

        if (!err && req.session && principal) {

          if (req.session.expires < new Date().getTime()) {
            err = Fault.create('cortex.accessDenied.sessionExpired')
          } else if (fingerprint && req.session.location && (req.session.location.fingerprint !== fingerprint)) {
            err = Fault.create('cortex.invalidArgument.fingerprintMismatch')
          } else if (req.session['loggedOut']) {
            err = Fault.create('cortex.accessDenied.loggedInElsewhere')
          } else if (checkCSRFToken && req.session.csrfToken && req.session.csrfToken !== req.header('Medable-Csrf-Token')) {
            err = Fault.create('cortex.accessDenied.csrfTokenMismatch')
          } else if (principal.locked && !principal.isSupportLogin) {
            err = Fault.create('cortex.accessDenied.accountLocked')
          }

          if (!err && req.session.csrfToken) {
            res.setHeader('Medable-Csrf-Token', req.session.csrfToken)
          }

        }

        if (err) {
          modules.sessions.destroy(req, { err }, () => {
            callback(err)
          })
        } else {

          if (req.session && principal) {
            const authDuration = utils.path(req.orgClient, 'authDuration') || config('sessions.authDuration')
            req.session.expires = new Date().getTime() + (authDuration * 1000)
          }
          if (fingerprint) {
            req.fingerprint = fingerprint
            if (req.session && req.session.location) {
              req.locationId = req.session.location._id
            }
          }
          callback(null, fingerprint)
        }

      }

    ], function(err) {

      if (!err) {
        if (req.org.maintenance) {
          if (!req.principal || !req.principal.isDeveloper()) {
            err = Fault.create('cortex.accessDenied.maintenance', { reason: req.org.maintenanceMessage })
          }
        }
      }
      if (err && options.passFault) {
        if (options.passMaintenanceMode || err.errCode !== 'cortex.accessDenied.maintenance') {
          req.fault = err
          err = null
        }
      }
      if (!req.principal) {
        req.principal = ap.synthesizeAccount({ org: req.org, accountId: acl.AnonymousIdentifier })
      }

      next(err)

    })

  }

}

module.exports.anonymous = module.exports({ allowAnonymous: true })
module.exports.anonymous_and_faulty = module.exports({ allowAnonymous: true, passFault: true })
module.exports.default = module.exports()
