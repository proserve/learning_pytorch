'use strict'

const utils = require('../../../utils'),
      { asyncHandler, promised } = utils,
      Fault = require('cortex-service/lib/fault'),
      modules = require('../../../modules'),
      clone = require('clone'),
      middleware = require('../../../middleware'),
      models = modules.db.models,
      ap = require('../../../access-principal'),
      _ = require('underscore'),
      url = require('url'),
      async = require('async'),
      validUrl = require('valid-url'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      consts = require('../../../consts'),
      acl = require('../../../acl')

function getAccountModel(req, callback) {
  req.org.createObject('account', function(err, accountModel) {
    if (err) {
      accountModel = models.account
    }
    callback(null, accountModel)
  })
}

module.exports = function(express, router) {

  const signInLoginMiddlware = middleware.login({ beforeLogin: modules.accounts.connectionTokenCheckBeforeLoginHandler }),
        accountScriptRouter = middleware.system_router(express, { allowSystemObjects: true })

  /**
     * Request a password reset
     * @param req.body.email
     */
  router.post('/accounts/request-password-reset',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.policy,
    accountScriptRouter,
    function(req, res) {
      const { accountId, email, username, sendEmail = true, sendSms = true } = req.body || {}
      modules.accounts.requestPasswordReset(req.org, email, username, accountId, req.locale, { sendEmail, sendSms, clientKey: req.orgClient.key }, function(err) {
        utils.outputResults(res, err, true)
      })
    }
  )

  /**
     * Update password
     * @description Change the password for the current account. On success, returns an updated account key
     * @param req.body.current
     * @param req.body.password
     * @todo tarpit just like authentication routes.
     */
  router.post('/accounts/me/update-password',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res) {

      async.waterfall([

        // load the account with system access (to read the password).
        function(callback) {
          getAccountModel(req, (err, model) => {
            void err
            model.aclReadOne(req.principal, req.principalId, { req: req, paths: ['password'], override: true, json: false }, callback)
          })
        },

        // verify the current password
        function(account, ac, callback) {

          modules.authentication.verifyPassword(utils.path(req, 'body.current'), account.password, function(err, result) {
            if (err) {
              err = Fault.create('cortex.error.unspecified', { reason: 'Password update failure.' })
            } else if (!result) {
              err = Fault.create('cortex.accessDenied.badPassword')
            }
            callback(err, account, ac)
          })
        },

        // attempt to update the account password.
        function(account, ac, callback) {

          const payload = { password: utils.path(req, 'body.password') }
          ac.method = 'put' // override method because it's really an update
          account.aclWrite(ac, payload, function(err) {
            if (err) {
              return callback(err)
            }
            ac.save({ versioned: false, changedPaths: ['password'] }, function(err) {
              callback(err, account, ac)
            })
          })
        },

        // read the new client key
        function(account, ac, callback) {
          account.aclRead(ac, { paths: ['key'] }, function(err, json) {
            callback(err, utils.digIntoResolved(json, 'key'))
          })
        }

      ], function(err, key) {
        utils.outputResults(res, err, key)
      })

    }
  )

  /**
     * Sign in.
     * @description Authenticates using email and password credentials, and returns the current account context
     * @note If CSRF protection is enabled for the API client, a \'Medable-Csrf-Token\' response header is sent, which must be sent as a
     * request header for the life of the authentication session. HTTP-only, secure, signed and encrypted cookies are used for session state.
     * @note parsed url-encoded bodies.
     *
     * @param req.body.email
     * @param req.body.password
     * @param req.body.token
     * @param req.body.location.singleUse
     * @param req.body.location.verificationToken
     * @param req.body.location.iosNotificationToken
     * @param req.body.location.gcmRegistrationId
   * * @param req.body.location.fcmRegistrationToken
     * @param req.body.location.locationName
     * @param req.body.redirectUrl (redirect with medableResponse=base64_encoded_json_response)
     */
  router.post('/accounts/login',
    middleware.body_parser.strict,
    middleware.body_parser.urlencoded,
    middleware.client_detection.default,
    middleware.policy,
    accountScriptRouter,
    function(req, res) {

      async.series([

        // login - note the beforeLogin hook above that checks for connections.
        callback => signInLoginMiddlware(req, res, callback),

        // read the account
        callback => {
          getAccountModel(req, (err, model) => {
            void err
            model.aclReadOne(req.principal, req.principal._id, { req: req }, function(err, account) {
              if (!err && req.__tokenFault) {
                account.tokenFault = req.__tokenFault.toJSON()
              }
              callback(err, account)
            })
          })
        }
      ], (err, results) => {

        const account = results ? results[1] : null,
              redirectUrl = utils.path(req, 'query.redirectUrl') || ''

        if (validUrl.isWebUri(redirectUrl)) {

          const parsed = url.parse(redirectUrl, true),
                q = parsed.query || (parsed.query = {})

          let result

          if (!err) {
            result = {
              _id: account._id,
              object: 'account',
              path: '/accounts/' + account._id
            }
            if (account.tokenFault) result.tokenFault = account.tokenFault
          }
          q.medableResponse = Buffer.from(utils.prepareResult(err, result)).toString('base64')
          delete parsed.search // node will only use query if search is absent.
          return res.redirect(url.format(parsed))
        }

        utils.outputResults(res, err, account)
      })

    }
  )

  /**
     * Login Status
     *
     * @description Returns the status of a session client as a "loggedin" boolean property. If connected, the result will contain an "account" property. If there is an error, the response will contain a fault.
     * @param query.expand: If true (and the account property exists), the account id property is expanded as the current account context.
     *
     */
  router.get('/accounts/status',
    middleware.client_detection.default,
    middleware.authorize({ passFault: true, passMaintenanceMode: true }),
    middleware.client_limits({ allowSigned: true }),
    middleware.policy,
    asyncHandler(async(req) => {

      const { org, principal: requestPrincipal, fault: requestFault } = req,
            principal = requestPrincipal || ap.synthesizeAnonymous(org),
            fault = Fault.from(requestFault),
            output = {
              loggedin: !principal.isAnonymous()
            }

      if (fault && fault.errCode !== 'cortex.accessDenied.notLoggedIn') {
        output.fault = fault.toJSON()
      }

      if (!principal.isAnonymous()) {
        output.account = principal._id
      }

      if (output.account && principal.isAuthenticated() && utils.stringToBoolean(req.query['expand'])) {

        if (principal.isServiceAccount()) {

          output.account = principal.toObject()

        } else {

          const Model = await promised(null, getAccountModel, req)
          try {
            output.account = await promised(Model, 'aclReadOne', principal, principal._id, { req: req })
            if (principal.isSupportLogin) {
              utils.path(output.account, 'isSupportLogin', true)
            }
          } catch (err) {
            void err // could have scope issues
          }

        }

        if (principal.isSupport() || principal.isDeveloper() || principal.isOrgAdmin()) {

          try {
            output.org = await promised(
              org,
              'aclRead',
              new acl.AccessContext(principal, org, { passive: true }),
              {
                paths: [
                  'deployment.supportOnly',
                  'deployment.allowEdits',
                  'deployment.enabled',
                  'deployment.availability',
                  'configuration.researchEnabled',
                  'configuration.axon.enabled',
                  'configuration.axon.exports',
                  'configuration.axon.trials',
                  'configuration.legacyObjects',
                  'configuration.cortexDisabled',
                  'configuration.allowAccountDeletion',
                  'configuration.allowOrgRefresh',
                  'configuration.minSelectablePasswordScore',
                  'configuration.reporting.enabled',
                  'configuration.scriptablePasswordValidation',
                  'configuration.storage.enableLocations',
                  'configuration.accounts',
                  'configuration.televisit.roomsEnabled'
                ]
              }
            )
          } catch (err) {
            void err // could have scope issues
          }

        }

      }

      return output

    })
  )

  /**
     * Sign Out
     */
  router.post('/accounts/me/logout',
    middleware.client_detection.default,
    middleware.authorize({ passFault: true }),
    middleware.policy,
    accountScriptRouter,
    function(req, res) {
      modules.sessions.logout(req, (err, loggedIn) => {
        void err
        utils.outputResults(res, null, loggedIn)
      })
    }
  )

  /**
     * Password Reset
     * @description Updates the account password with a token received through a password reset request or an account provisioning email
     * @param req.body.token
     * @param req.body.password
     */
  router.post('/accounts/reset-password',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.policy,
    accountScriptRouter,
    function(req, res) {

      async.waterfall([

        // lookup the token
        callback => {
          if (!modules.authentication.isCallbackToken(req.body.token, config('callbacks.tokenLength'))) {
            callback(Fault.create('cortex.notFound.passwordResetToken', { reason: 'Invalid token format.' }))
          } else {
            models.callback.findOne({ token: req.body.token, handler: consts.callbacks.pass_reset, org: req.orgId }).exec(function(err, callbackObject) {
              if (err) {
                err = Fault.create('cortex.error.unspecified', { reason: 'Token lookup failure.' })
              } else if (!callbackObject) {
                err = Fault.create('cortex.notFound.passwordResetToken')
              } else if (callbackObject['expired']) {
                err = Fault.create('cortex.notFound.passwordResetToken', { reason: 'Token expired.' })
                callbackObject.remove(function(err) {
                  if (err) logger.error('removing expired callback ', utils.toJSON(err, { stack: true }))
                })
              } else if (!callbackObject.sender) {
                err = Fault.create('cortex.notFound.account')
              }
              callback(err, callbackObject)
            })
          }
        },

        // get account data we might need in case this callback is the result of a provisioned account.
        (callbackObject, callback) => {
          ap.create(req.org, callbackObject.sender, { include: ['activationRequired', 'state'] }, (err, principal) => {
            callback(err, callbackObject, principal)
          })
        },

        // update the account.
        (callbackObject, principal, callback) => {

          const ops = [{
                  op: 'set',
                  path: 'password',
                  value: req.body.password
                }],
                options = {
                  req: req,
                  override: true,
                  acOptions: {
                    skipAccountProfileUpdateTrigger: !!utils.path(callbackObject, 'data.skipAccountProfileUpdateTrigger')
                  }
                }

          let didActivateOrVerify = false
          if (utils.path(callbackObject, 'data.activateOrVerify')) {
            if (principal.account.activationRequired) {
              ops.push({
                op: 'remove',
                path: 'activationRequired'
              })
              didActivateOrVerify = true
            }
            if (principal.account.state === 'unverified') {
              ops.push({
                op: 'set',
                path: 'state',
                value: 'verified'
              })
              didActivateOrVerify = true
            }
          }

          getAccountModel(req, (err, model) => {
            void err
            model.aclPatch(principal, principal._id, ops, options, err => {

              if (!err) {
                callbackObject.remove(function(err) {
                  if (err) logger.error('error removing password reset token callback', utils.toJSON(err, { stack: true }))
                })
              }

              if (didActivateOrVerify) {
                if (err) {
                  logger.error('Account activation flag removal on password reset failed for account: ' + principal._id, utils.toJSON(err, { stack: true }))
                } else {

                  // cleanup verification tokens.
                  models.callback.deleteMany(
                    { handler: consts.callbacks.ver_acct, sender: principal._id },
                    function(err) {
                      if (err) logger.debug('error removing account verification callbacks', utils.toJSON(err, { stack: true }))
                    }
                  )

                  // remove activation emails.
                  models.callback.deleteMany(
                    { handler: consts.callbacks.act_acct, sender: principal._id, org: req.orgId },
                    function(err) {
                      if (err) logger.debug('error removing account activation callbacks', utils.toJSON(err, { stack: true }))
                    }
                  )

                }
              }
              callback(err)
            })
          })

        }

      ], function(err) {
        utils.outputResults(res, err, true)
      })
    }
  )

  /**
     * Retrieve Current Account
     */
  router.get('/accounts/me',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res) {
      const options = utils.extend(_.pick(req.query, 'paths', 'include', 'expand'), {
        req: req,
        passive: utils.stringToBoolean(utils.path(req.query, 'passive'))
      })
      getAccountModel(req, (err, model) => {
        void err
        model.aclReadOne(req.principal, req.principal._id, options, function(err, document) {
          utils.outputResults(res, err, document)
        })
      })
    }
  )

  /**
     * Resend Account Verification
     *
     * @description resend account verification email. this will only work for activated accounts.
     * @note accounts in organizations that require manual activation will already have been verified.
     * @param req.body.
     *
     * @todo delete other pending callbacks?
     */
  router.post('/accounts/me/resend-verification',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res, next) {
      getAccountModel(req, (err, model) => {
        void err
        model.aclReadOne(req.principal, req.principal._id, { req: req, paths: ['_id', 'email', 'locale', 'state', 'locked'] }, function(err, account) {
          if (err) next(err)
          else if (account.state === 'verified') next(Fault.create('cortex.conflict.accountAlreadyVerified'))
          else if (account.locked) next(Fault.create('cortex.accessDenied.accountLocked'))
          else {
            const template = req.principal.hasRole(acl.OrgProviderRole) ? 'account-welcome-verification-provider' : 'account-welcome-verification'
            modules.accounts.sendAccountVerification(template, req.org, account, { clientKey: req.orgClient.key }, function(err) {
              utils.outputResults(res, err, true)
            })
          }
        })
      })
    }
  )

  /**
     * Activate/Verify an Account
     *
     * @note accounts in organizations that require manual activation will already have been verified.
     * @param req.params.token
     *
     * @todo delete other pending callbacks?
     */
  router.post('/accounts/:token',
    middleware.client_detection.default,
    middleware.policy,
    function(req, res, next) {

      // skip out for other routes.
      if (!modules.authentication.isCallbackToken(req.params.token, config('callbacks.tokenLength'))) {
        return next()
      }

      async.waterfall([

        // look up the token
        function(callback) {

          models.callback.findOne({ token: req.params.token, handler: { $in: [consts.callbacks.ver_acct, consts.callbacks.act_acct] }, org: req.orgId }).populate('sender', '_id state org roles locked activationRequired').exec(function(err, callbackObject) {
            if (err) {
              err = Fault.create('cortex.error.unspecified', { reason: 'Token lookup failure.' })
            } else if (!callbackObject || !callbackObject.sender) {
              err = Fault.create('cortex.notFound.accountToken')
            }
            callback(err, callbackObject)
          })
        },

        // check the user account status
        function(callbackObject, callback) {

          let err = null
          if (!callbackObject.sender) {
            err = Fault.create('cortex.notFound.accountToken')
          } else if (callbackObject.handler === consts.callbacks.ver_acct && callbackObject.sender.state === 'verified') {
            err = Fault.create('cortex.conflict.accountAlreadyVerified')
          } else if (callbackObject.sender.locked) {
            err = Fault.create('cortex.accessDenied.accountLocked')
          }
          callback(err, callbackObject)
        },

        // update the account status
        function(callbackObject, callback) {
          ap.create(req.org, callbackObject.sender._id, (err, principal) => {
            if (err) {
              return callback(err)
            }
            getAccountModel(req, (err, model) => {
              void err
              model.aclPatch(
                principal,
                principal._id,
                [{
                  op: 'set',
                  path: 'state',
                  value: 'verified'
                }, {
                  op: 'remove',
                  path: 'activationRequired'
                }],
                {
                  skipAcl: true,
                  grant: acl.AccessLevels.System
                },
                err => callback(err, callbackObject)
              )
            })

          })
        },

        // cleanup callbacks
        function(callbackObject, callback) {

          // noinspection JSValidateTypes,JSCheckFunctionSignatures
          models.callback.deleteMany(
            { handler: { $in: [consts.callbacks.ver_acct, consts.callbacks.act_acct] }, sender: callbackObject.sender._id },
            function(err) {
              if (err) logger.debug('error removing account activation/verification callbacks', err.stack)
            }
          )

          // noinspection JSValidateTypes,JSCheckFunctionSignatures
          models.callback.deleteMany(
            { handler: consts.callbacks.act_acct, sender: callbackObject.sender._id, org: req.orgId },
            function(err) {
              if (err) logger.debug('error removing account activation callbacks', err.stack)
            }
          )
          callback(null, callbackObject.sender._id)
        }

      ], function(err, _id) {
        utils.outputResults(res, Fault.from(err), _id)
      })
    }
  )

  /**
     * Register an account
     *
     * @note When using an invitation token, a tokenFault property will be added to the result if the invitation was unsuccessful
     * @note parsed url-encoded bodies.
     *
     * @param req.body.email
     * @param req.body.password
     * @param req.body.username
     * @param req.body.role (provider only)
     * @param req.body.token
     * @param req.body.location.singleUse
     * @param req.body.location.verificationToken
     * @param req.body.location.iosNotificationToken
     * @param req.body.location.gcmRegistrationId
     * @param req.body.location.fcmRegistrationToken
     * @param req.body.location.voipToken
     * @param req.body.location.locationName
     * @param req.body.redirectUrl (redirect with medableResponse=base64_encoded_json_response)
     */
  router.post('/accounts/register',
    middleware.body_parser.strict,
    middleware.body_parser.urlencoded,
    middleware.client_detection.default,
    middleware.policy,
    accountScriptRouter,
    function(req, res) {

      const password = utils.rString(utils.path(req, 'body.password'), '')

      async.waterfall([

        // create account
        function(callback) {

          modules.authentication.readFingerprint(req, res, { create: true, allowNull: false }, function(err, fingerprint) {
            if (err) callback(err)
            else {
              const accountState = utils.path(req.org, 'registration.bypassAccountVerification') ? 'verified' : 'unverified'
              modules.accounts.createAccount(null, clone(req.body || {}), req.org, req.locale, accountState, fingerprint, req, { clientKey: req.orgClient.key }, function(err, account, tokenFault) {
                callback(err, fingerprint, account, tokenFault)
              })
            }
          })

        },

        // login? ensure there is an access principal. if the caller has not been logged in, then ensure there is context access.
        function(fingerprint, account, tokenFault, callback) {

          if (account.activationRequired) {

            ap.create(req.org, account, function(err, principal) {
              callback(err, account.constructor, principal, tokenFault)
            })

          } else {

            const loginHandler = middleware.login({
              sessions: true,
              password: password,
              fingerprint: fingerprint,
              account: account
            })
            loginHandler(req, res, function(err) {
              callback(err, account.constructor, req.principal, tokenFault)
            })

          }

        },

        // read the account and tack on token and image faults.
        function(accountModel, principal, tokenFault, callback) {
          getAccountModel(req, (err, model) => {
            void err
            model.aclReadOne(principal, principal._id, { req: req }, function(err, account) {
              if (!err) {
                tokenFault = Fault.from(tokenFault)
                if (tokenFault) account.tokenFault = tokenFault.toJSON()
              }
              callback(err, account)
            })
          })

        }

      ], function(err, account) {

        const redirectUrl = utils.path(req, 'query.redirectUrl') || ''
        if (validUrl.isWebUri(redirectUrl)) {

          const parsed = url.parse(redirectUrl, true),
                q = parsed.query || (parsed.query = {})
          let result

          if (!err) {
            result = {
              _id: account._id,
              object: 'account',
              path: '/accounts/' + account._id
            }
            if (account.tokenFault) result.tokenFault = account.tokenFault
          }
          q.medableResponse = Buffer.from(utils.prepareResult(err, result)).toString('base64')
          delete parsed.search // node will only use query if search is absent.
          return res.redirect(url.format(parsed))

        }

        utils.outputResults(res, err, account)
      })
    }
  )

}
