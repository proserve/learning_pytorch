
'use strict'

const _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      async = require('async'),
      modules = require('../../../../modules'),
      { path: pathTo, promised, rString, rBool, equalIds, isPlainObject, isCustomName } = require('../../../../utils'),
      ap = require('../../../../access-principal'),
      middleware = require('../../../../middleware'),
      acl = require('../../../../acl')

function isSupportLogin(script) {
  return script.ac.option('deployment.isSupportLogin') || script.ac.principal.isSupportLogin
}

module.exports = {

  static: {

    /**
         *
         * @param script
         * @param message
         * @param payload
         *   username, password, [identifierProperty]
         * @param options
         *     passwordLess = false
         *     verifyLocation = true
         *     identifierProperty
         * @param callback
         */
    login: function(script, message, payload, options, callback) {

      options = options || {}
      payload = payload || {}

      const req = script.ac.req,
            res = req && req.res,
            email = rString(payload.email),
            username = rString(payload.username),
            passwordLess = rBool(options.passwordLess, false),
            identifierProperty = isCustomName(options.identifierProperty) && options.identifierProperty,
            identifierValue = identifierProperty && rString(payload[identifierProperty]),
            context = {
              object: 'account'
            },
            authOptions = {
              beforeLogin: modules.accounts.connectionTokenCheckBeforeLoginHandler,
              verifyLocation: rBool(pathTo(options, 'verifyLocation'), true),
              body: payload || {}
            }

      // only works where there is a request
      if (!req || !res || !['route', 'policy'].includes(script.configuration.type)) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'accounts.login is only callable from Route/Policy scripts.' }))
      }

      async.waterfall([

        // if passwordLess, look up the account and check for lock.
        callback => {
          if (!passwordLess) {
            if (identifierProperty) {
              return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'accounts.login must be passwordLess when using a custom identifier.' }))
            }
            return callback(null, null)
          }
          modules.authentication.loadAccount({ org: script.ac.org, email, username, identifierProperty, identifierValue }, (err, account) => {
            if (account) {
              context._id = account._id
            }
            callback(err, account)
          })
        },

        // perform middleware login.
        (account, callback) => {

          if (account) {
            authOptions.account = account
          }
          authOptions.script = script
          const handler = middleware.login(authOptions)

          handler(req, res, err => callback(err))

        },

        // if passwordLess and successful, reset security attempts. this needs to be re-factored an unified.
        callback => {

          if (!passwordLess) {
            return callback()
          }
          modules.authentication.succeedAuthAttempt(script.ac.org, authOptions.account, err => callback(err))

        }

      ], err => {

        if (passwordLess) {
          modules.audit.recordEvent(script.ac, 'authentication', 'login', { err, context, metadata: { email, username, passwordLess } })
        }
        callback(err, err ? null : req.principal.toObject())

      })

    },

    logout: function(script, message, callback) {

      modules.sessions.logout(script.ac.req, (err, loggedIn) => {
        void err
        callback(null, loggedIn)
      })

    },

    attemptAuth: function(script, message, emailOrUsername, password, options, callback) {

      const { req, org } = script.ac,
            { checkLock, checkExpired } = options || {}

      modules.authentication.attemptAuth(
        org,
        emailOrUsername,
        password,
        { req, checkLock, checkExpired },
        err => {
          callback(err)
        }
      )

    },

    preAuth: function(script, message, emailOrUsername, callback) {

      const { email, username } = modules.authentication.resolveAuthenticationSelectors(script.ac.org, emailOrUsername)

      modules.authentication.loadAccount({ org: script.ac.org, email, username }, (err, account) => {
        if (err) {
          return callback(err)
        }

        const principal = ap.synthesizeAccount({
          org: script.ac.org,
          accountId: account._id,
          email: account.email,
          username: account.username,
          roles: account.roles
        })
        account.constructor.aclReadOne(principal, principal._id, { req: script.ac.req }, function(err, account) {
          callback(err, account)
        })
      })

    },

    failAuth: function(script, message, emailOrUsername, callback) {

      const { email, username } = modules.authentication.resolveAuthenticationSelectors(script.ac.org, emailOrUsername)

      modules.authentication.loadAccount({ org: script.ac.org, email, username, checkLock: false }, (err, account) => {
        if (err) {
          return callback(Fault.create('cortex.accessDenied.invalidCredentials'))
        }
        modules.authentication.failAuthAttempt(script.ac.org, account, (err, account) => {
          void account
          callback(err)
        })
      })

    },

    createPasswordResetToken: async function(script, message, match, options) {

      let where = match,
          account

      const { email, username, _id } = modules.authentication.resolveAuthenticationSelectors(script.ac.org, match, { allowIdentifier: true }),
            resetOptions = {
              sendEmail: pathTo(options, 'sendEmail'),
              sendSms: pathTo(options, 'sendSms'),
              clientKey: script.ac.org.keyToClient(pathTo(options, 'clientKey'))?.key
            }

      if (email) {
        where = { email }
      } else if (username) {
        where = { username }
      } else if (_id) {
        where = { _id }
      }

      account = await promised(
        modules.db.models.account,
        'aclLoad',
        script.ac.principal,
        {
          where,
          skipAcl: true,
          paths: ['email', 'username'],
          forceSingle: true
        }
      )

      return promised(
        modules.accounts,
        'requestPasswordReset',
        script.ac.org,
        account.email,
        account.username,
        account._id,
        options.locale,
        resetOptions
      )

    },

    register: function(script, message, payload, opts, callback) {

      payload = isPlainObject(payload) ? payload : {}
      opts = isPlainObject(opts) ? opts : {}

      const req = pathTo(script, 'ac.req'), res = pathTo(req, 'res'),
            state = opts.skipVerification ? 'verified' : 'unverified',
            options = {
              skipSelfRegistrationCheck: true,
              isProvisioned: true,
              allowDirectRoles: true,
              clientKey: script.ac.org.keyToClient(opts.clientKey)?.key,
              skipActivation: !!opts.skipActivation,
              sendWelcomeEmail: !opts.skipNotification,
              verifyLocation: !!opts.verifyLocation,
              requireMobile: rBool(opts.requireMobile, script.ac.org.configuration.accounts.requireMobile)
            }

      // only works where there is a request
      if (!req || !res || script.configuration.type !== 'route') {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'accounts.register is only callable from Route scripts.' }))
      }

      if (!pathTo(payload, 'password')) {
        pathTo(payload, 'password', modules.authentication.generatePassword(32))
      }

      async.waterfall([

        callback => {
          if (options.verifyLocation) {
            modules.authentication.readFingerprint(req, res, { create: true, allowNull: false }, (err, fingerprint) => callback(err, fingerprint))
          } else {
            callback(null, null)
          }
        },

        (fingerprint, callback) => {

          modules.accounts.createAccount(null, payload, script.ac.org, 'en_US', state, fingerprint, req, options, function(err, account, tokenFault) {

            if (err) {
              return callback(err)
            }
            const principal = ap.synthesizeAccount({
              org: script.ac.org,
              accountId: account._id,
              email: 'principal@medable.com',
              username: 'principal.medable',
              roles: account.roles
            })
            account.constructor.aclReadOne(principal, principal._id, { req: req }, function(err, account) {
              if (!err) {
                tokenFault = Fault.from(tokenFault)
                if (tokenFault) account.tokenFault = tokenFault.toJSON()
              }
              callback(err, account)
            })

          })

        }

      ], callback)

    },

    provision: function(script, message, payload, opts, callback) {

      if ((!script.ac.principal.isSupport() && (config('app.env') === 'production')) || !script.ac.principal.isDeveloper()) {
        return callback(Fault.create('cortex.accessDenied.role'))
      }

      const options = _.pick(opts || {}, 'skipActivation', 'sendWelcomeEmail', 'requireMobile', 'clientKey'),
            accountState = pathTo(script.ac.org, 'registration.bypassAccountVerification') ? 'verified' : 'unverified'

      modules.accounts.provisionAccount(script.ac.principal, payload, script.ac.org, 'en_US', accountState, script.ac.req, options, function(err, account) {
        if (err) callback(err)
        else {
          modules.org.readAccount(script.ac.principal, account._id, function(err, account) {
            callback(err, account)
          })
        }
      })

    },

    optimizeAuthScope: function(script, message, scope, callback) {

      callback(null, modules.authentication.optimizeAuthScope(scope))
    },

    compileAuthScope: function(script, message, scope, callback) {

      callback(null, modules.authentication.compileAuthScope(scope))
    },

    /**
         *
         * @param script
         * @param message
         * @param apiKey
         * @param principal
         * @param options
         * @param callback
         * @returns {*}
         */
    createAuthToken: function(script, message, apiKey, principal, options, callback) {

      if (!modules.authentication.authInScope(script.ac.principal.scope, 'admin.update')) {
        return callback(Fault.create('cortex.accessDenied.scope', { path: 'admin.update' }))
      }

      options = script.allowedOptions(options, 'activatesIn', 'expiresIn', 'grant', 'maxUses', 'permanent', 'roles', 'scope', 'policy', 'skipAcl', 'bypassCreateAcl', 'validAt', 'includeEmail')
      options.isSupportLogin = isSupportLogin(script)
      modules.authentication.createToken(script.ac, principal, apiKey, options, (err, result) => {

        callback(err, result && result.token)
      })
    },

    decodeAuthToken: function(script, message, token, options, callback) {

      options = script.allowedOptions(options, 'complete')

      modules.authentication.decodeToken(token, options, callback)

    },

    /**
     * @param script
     * @param message
     * @param token
     * @param options
     *  checkPolicy
     *  tags - policy tag(s) required in matching policy.
     *  disableTriggers
     * @param callback
     * @returns {*}
     */
    authorizeToken: function(script, message, token, options, callback) {

      const { checkPolicy, tags, disableTriggers } = script.allowedOptions(options, 'checkPolicy', 'tags', 'disableTriggers')

      modules.authentication.authenticateToken(script.ac, token, { checkPolicy, tags }, (err, { principal, account } = {}) => {

        if (err || disableTriggers) {
          return callback(err, principal && principal.toObject())
        }
        const ac = new acl.AccessContext(principal, account, { req: script.ac.req })
        modules.sandbox.triggerScript('authorizeToken.after', null, ac, function(err) {
          callback(err, principal && principal.toObject())
        })

      })
    },

    /**
         *
         * @param script
         * @param message
         * @param tokenOrId
         * @param callback
         * @returns {*}
         */
    revokeAuthToken: function(script, message, tokenOrId, callback) {

      modules.authentication.revokeToken(script.ac, tokenOrId, (err, revoked) => {
        callback(err, revoked)
      })
    },

    getSubjectTokens: function(script, message, apiKey, principal, callback) {

      modules.authentication.getSubjectTokens(script.ac, apiKey, principal, (err, tokens) => {
        callback(err, tokens)
      })

    },

    revokeSubjectTokens: function(script, message, apiKey, principal, callback) {

      modules.authentication.revokeSubjectTokens(script.ac, apiKey, principal, (err, revoked) => {
        callback(err, revoked)
      })
    },

    inAuthScope: function(script, message, compiledScope, scopeString, acceptPrefixMatch, exactMatch, callback) {
      let err, result
      try {
        const authentication = modules.authentication
        authentication.validateAuthScope(script.ac.principal.org, scopeString)
        result = authentication.authInScope(compiledScope, scopeString, rBool(acceptPrefixMatch, true), rBool(exactMatch, false))
      } catch (e) {
        err = e
      }
      setImmediate(callback, err, result)
    },

    admin: {

      deactivate: function(script, message, accountId, callback) {

        modules.org.deactivateAccount(
          script.ac.principal,
          accountId,
          { req: script.ac.req },
          callback
        )

      },

      delete: function(script, message, accountId, callback) {

        modules.org.deleteAccount(
          script.ac.principal,
          accountId,
          { req: script.ac.req },
          callback
        )

      },

      update: function(script, message, accountId, input, callback) {

        modules.org.updateAccount(
          script.ac.principal,
          accountId,
          input,
          { req: script.ac.req },
          callback
        )

      },

      read: function(script, message, accountId, callback) {

        modules.org.readAccount(
          script.ac.principal,
          accountId,
          callback
        )

      },

      list: function(script, message, input, callback) {

        modules.org.listAccounts(
          script.ac.principal,
          { ...(input || {}), req: script.ac.req },
          callback
        )

      }

    }

  },

  instance: {

    inAuthScope: function(script, message, _id, scopeString, acceptPrefixMatch, callback) {

      if (!equalIds(script.ac.principal._id, _id)) {
        return callback(null, false)
      }

      let err, result
      try {
        const authentication = modules.authentication
        scopeString = String(scopeString)
        acceptPrefixMatch = rBool(acceptPrefixMatch, true)
        authentication.validateAuthScope(script.ac.principal.org, scopeString)
        result = authentication.authInScope(script.ac.principal.scope, scopeString, acceptPrefixMatch)
      } catch (e) {
        err = e
      }
      setImmediate(callback, err, result)
    }

  }
}
