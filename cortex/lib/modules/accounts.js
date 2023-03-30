'use strict'

const utils = require('../utils'),
      { resolveOptionsCallback, inIdArray } = utils,
      Fault = require('cortex-service/lib/fault'),
      modules = require('../modules'),
      models = modules.db.models,
      ap = require('../access-principal'),
      async = require('async'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      consts = require('../../lib/consts'),
      acl = require('../../lib/acl')

class AccountsModule {

  sendAccountVerification(notification, org, account, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    // create a registration verification token. it lives forever and basically limits the account until verified.
    const callbackOptions = {
      persistent: true,
      targetId: account._id,
      clientKey: options.clientKey
    }

    models.callback.createCallback(org, consts.callbacks.ver_acct, account._id, account.email, callbackOptions, (err, callbackObject) => {
      if (!err) {
        org.sendNotification(notification, {
          account: account,
          variables: {
            verification: callbackObject.token
          }
        })
      } else {
        logger.error('error creating verification token for account ' + account._id + '. failing silently.', utils.toJSON(err, { stack: true }))
      }
      callback(err, callbackObject)
    })

  }

  sendAccountActivation(notification, org, account, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const callbackOptions = {
      persistent: true,
      targetId: account._id,
      clientKey: options.clientKey
    }

    models.callback.createCallback(org, consts.callbacks.act_acct, account._id, account.email, callbackOptions, (err, callbackObject) => {
      if (!err) {
        org.sendNotification(notification, {
          account: account,
          variables: {
            activation: callbackObject.token
          }
        })
      } else {
        logger.error('error creating activation token for account ' + account._id + '.', utils.toJSON(err, { stack: true }))
      }
      callback(err, callbackObject)
    })

  }

  /**
     *
     * @param principal calling principal
     * @param payload
     * @param org
     * @param locale
     * @param state
     * @param req
     * @param {(object|function)=} options
     *      skipSelfRegistrationCheck: true
     *      skipActivation: false,
     *      isProvisioned: true,
     *      sendWelcomeEmail: true,
     *      allowDirectRoles: true,
     *      accountObject: null. force initial object properties
     *      requireMobile: true
     *      passwordExpires: null (Date)
     *      mustResetPassword: null (false)
   *        clientKey: null
     * @param {function=} callback -> err, account, tokenFault
     */
  provisionAccount(principal, payload, org, locale, state, req, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    options = utils.extend({
      skipSelfRegistrationCheck: true,
      isProvisioned: true,
      allowDirectRoles: true,
      requireMobile: utils.rBool(org.configuration.accounts.requireMobile, true),
      requireEmail: utils.rBool(org.configuration.accounts.requireEmail, true),
      requireUsername: utils.rBool(org.configuration.accounts.requireUsername, false),
      clientKey: options.clientKey
    }, options)

    if (!utils.path(payload, 'password')) {
      utils.path(payload, 'password', modules.authentication.generatePassword(32))
    }

    options.accountObject = utils.extend(true, options.accountObject, {
      security: {
      }
    })

    this.createAccount(principal, payload, org, locale, state, null, req, options, (err, account, tokenFault) => {
      callback(err, account, tokenFault)
    })

  }

  /**
     *
     * @param callingPrincipal calling principal (optional)
     * @param payload
     * @param org
     * @param locale
     * @param state
     * @param fingerprint
     * @param req
     * @param {(object|function)=} options
     *      skipSelfRegistrationCheck: false
     *      skipActivation: false,
     *      isProvisioned: false,
     *      sendWelcomeEmail: true,
     *      allowDirectRoles: false,
     *      accountObject: null. forced account data
     *      requireMobile: true. require a mobile number for 2fa and sms messaging
     *      passwordExpires: null (Date)
     *      mustResetPassword: null (false)
     *      clientKey
     *
     * @param {function=} callback -> err, account, tokenFault
     */
  createAccount(callingPrincipal, payload, org, locale, state, fingerprint, req, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    payload = payload || {}

    options = utils.extend({
      skipSelfRegistrationCheck: false,
      skipActivation: false,
      maxExempt: false,
      isProvisioned: false,
      sendWelcomeEmail: true,
      allowDirectRoles: false,
      requireMobile: utils.rBool(org.configuration.accounts.requireMobile, true),
      requireEmail: utils.rBool(org.configuration.accounts.requireEmail, true),
      requireUsername: utils.rBool(org.configuration.accounts.requireUsername, false),
      newLoginExperience: utils.rBool(org.configuration.newLoginExperience, false),
      passwordExpires: null,
      mustResetPassword: null,
      clientKey: null
    }, options)

    options.maxExempt = (callingPrincipal && callingPrincipal.isSupportLogin) || (req && req.principal && req.principal.isSupportLogin)

    const locationOptions = utils.extend({}, payload.location, { bypassActivation: true }),
          loginMethods = Array.isArray(payload.loginMethods) && payload.loginMethods.length ? payload.loginMethods : org.configuration.loginMethods,
          ssoOnly = Array.isArray(loginMethods) && loginMethods.length === 1 && loginMethods.includes('sso') && !utils.inIdArray(payload.roles, consts.roles.admin)

    delete payload.location

    if (ssoOnly) {
      options.skipActivation = true
    }

    if (callingPrincipal && !modules.authentication.authInScope(callingPrincipal.scope, 'object.create.account', false)) {
      return setImmediate(callback, Fault.create('cortex.accessDenied.scope', { path: 'object.create.account' }))
    }

    // noinspection JSUnresolvedFunction
    async.waterfall([

      // test org
      callback => {

        let err
        if (!org) {
          err = Fault.create('cortex.notFound.env')
        } else if (!options['isProvisioned'] && !options['skipSelfRegistrationCheck'] && !org.registration.allow) {
          err = Fault.create('cortex.accessDenied.selfRegistrationDisabled')
        } else if (!options['isProvisioned'] && !options['skipSelfRegistrationCheck']) {
          if (!org.registration.allow) {
            err = Fault.create('cortex.accessDenied.selfRegistrationDisabled')
          }
        }
        callback(err, org)

      },

      // count users
      (org, callback) => {

        if (options.maxExempt) {
          return callback(null, org)
        }
        models.account.collection.countDocuments({ org: org._id, object: 'account', reap: false }, (err, count) => {
          if (!err && (count > utils.rInt(utils.path(org, 'configuration.maxAccounts'), 0))) {
            err = Fault.create('cortex.accessDenied.maxAccounts')
          }
          callback(err, org)
        })

      },
      // determine whether an invitation is required.
      (org, callback) => {

        // if there is a token, test it now (without a principal). it will tell us if we need to require activation.
        if (payload.token) {
          const token = payload.token,
                anonymous = ap.synthesizeAnonymous(org)

          delete payload.token

          models.connection.loadConnectionByToken(anonymous, token, { req: req }, (err, connection, ac) => {
            callback(err, org, connection, token)
          })

        } else {
          callback(null, org, null, null)
        }
      },

      // get the account object.
      (org, connection, token, callback) => {

        org.createObject('account', (err, object) => {
          callback(err, org, connection, token, object)
        })

      },

      // create an account
      (org, connection, token, AccountModel, callback) => {

        // can we register without a valid token?
        if (!options['isProvisioned'] && !options['skipSelfRegistrationCheck'] && org.registration.invitationRequired && !connection) {
          callback(Fault.create('cortex.accessDenied.registrationInvitationRequired'))
          return
        }

        const account = new AccountModel()

        if (options['accountObject']) {
          utils.extend(account, options['accountObject'])
        }
        account.object = models.account.objectName
        account.org = org._id

        // fix up roles here so we can set them using the writer using system access
        // the write must be used to ensure audit records are created for rol access change.
        let roles = []
        if (options['allowDirectRoles']) {

          let allowedBuiltIn = [consts.roles.provider]
          if (!callingPrincipal || callingPrincipal.isSupport()) {
            allowedBuiltIn.push(consts.roles.support)
          }
          if (!callingPrincipal || callingPrincipal.isDeveloper()) {
            allowedBuiltIn.push(consts.roles.developer)
          }
          if (!callingPrincipal || callingPrincipal.isOrgAdmin()) {
            allowedBuiltIn.push(consts.roles.admin)
          }
          roles = utils.getIdArray(payload.roles).filter((role) => {
            if (acl.isBuiltInRole(role)) {
              return utils.inIdArray(allowedBuiltIn, role)
            }
            return true
          })

        } else {

          const role = payload.role
          delete payload.role

          if (role === 'provider') {
            roles = [acl.OrgProviderRole]

            if (!org.registration.allowProviders) {
              return callback(Fault.create('cortex.accessDenied.providerRegistrationDisabled', { reason: 'Registration as a provider is disabled.' }))
            }

          } else {
            roles = []
          }

        }
        delete payload.roles

        if (utils.inIdArray(roles, acl.OrgProviderRole)) {

          account.profile.provider.state = org.registration.manualProviderVerification ? 'unverified' : 'verified'
        }

        if (!options['skipActivation'] && org.registration.activationRequired && !connection) {
          account.activationRequired = true
        }

        account.state = state
        account.loginMethods = payload.loginMethods

        // noinspection JSUnresolvedFunction
        async.waterfall([

          // the password and roles must be written using system access.
          // create an access principal from the account data (for self-updating) and write properties.
          callback => {

            const principal = ap.synthesizeAccount({ org, accountId: account._id, email: 'principal@medable.com', roles }),
                  ac = new acl.AccessContext(principal, account, { req: req, method: 'post' }),
                  password = payload.password

            delete payload.password

            ac.option('originalPrincipal', callingPrincipal)
            ac.option('auditPrincipal', callingPrincipal)

            // @check is new account.
            async.parallel([
              callback => {

                const payload = { password, roles },
                      passwordExpires = utils.getValidDate(options.passwordExpires),
                      ac = new acl.AccessContext(principal, account, { req: req, method: 'post', override: acl.AccessLevels.System })

                if (options.mustResetPassword) {
                  utils.path(payload, 'stats.mustResetPassword', true)
                } else if (passwordExpires) {
                  utils.path(payload, 'stats.passwordExpires', passwordExpires)
                }
                account.aclWrite(ac, payload, callback)
              },
              callback => {
                account.aclWrite(ac, payload, callback)
              }
            ], err => {

              if (err) {

                callback(err)

              } else {

                if (options.requireMobile) {
                  ac.hook('validate').after(function(vars, callback) {
                    callback(account.mobile !== undefined ? null : Fault.create('cortex.invalidArgument.validation'))
                  })
                  ac.hook('validate').fail(function(err, vars, callback) {
                    if (account.mobile === undefined) err.add(Fault.create('cortex.invalidArgument.required', { reason: 'A mobile number is required.', path: 'account.mobile' }))
                    callback(err)
                  })
                }
                ac.save({ versioned: false }, function(err) {
                  callback(Fault.from(err), ac.org)
                })
              }
            })

          }

        ], (err, org) => {
          callback(err, org, account, connection, token)
        })

      },

      // update all pending connections with the actual account id, and remove the email address.
      (org, account, connection, token, callback) => {

        models.connection.collection.updateMany({ org: org._id, state: consts.connectionStates.pending, 'target.email': account.email }, { $set: { 'target.account': { _id: account._id } } }, err => {
          if (err) logger.error('updating registration invitation principal', utils.toJSON(err, { stack: true }))
          callback(null, org, account, connection, token)
        })

      },

      // create an access principal from the real account.
      (org, account, connection, token, callback) => {
        ap.create(org, account, (err, principal) => {
          callback(err, org, account, principal, connection, token)
        })
      },

      // create a location
      (org, account, principal, connection, token, callback) => {

        if (fingerprint) {
          models.location.findOrCreateLocation(principal, utils.path(req, 'orgClient.key'), fingerprint, locationOptions, err => {
            callback(err, org, account, principal, connection, token)
          })
        } else {
          callback(null, org, account, principal, connection, token)
        }

      },

      // process any tokens. if there is an invitation token we auto-activate - and possibly verify - the account (if the emails match).
      (org, account, principal, connection, token, callback) => {

        if (connection) {

          const oldState = account.state

          // if the collab target matches the registration email address, we can verify the account if we're on auto.
          let skipAccountTest = false, updateInvitation = false

          // if connecting with an invitation to a different target email address
          if (utils.path(connection, 'target.email') === principal.email) {
            // same email, allow it and set the state to verified.
            account.state = 'verified'
            skipAccountTest = true
          } else {
            // the collab is valid, but we can expect a cortex.accessDenied.connectionRequiresVerification error because emails don't match and this is a new, unverified account.
            // in this case, update the invitation to reflect the account's new address, in essence redirecting it.
            updateInvitation = true
          }

          models.connection.applyToken(principal, token, { skipAcl: true, skipAccountTest: skipAccountTest, req: req }, err => {
            if (err) {
              account.state = oldState
              if (err.errCode === 'cortex.accessDenied.connectionRequiresVerification' && updateInvitation) {
                models.connection.collection.updateOne({ _id: connection._id }, { $set: { 'target.account': { _id: principal._id }, 'target.email': principal.email } }, err => {
                  if (err) logger.error('updating registration invitation principal', utils.toJSON(err, { stack: true }))
                })
              }
              callback(null, org, account, principal, err)
            } else if (account.state !== oldState) {
              const options = {
                req: req,
                method: 'put',
                override: acl.AccessLevels.System
              }
              models.account.aclUpdatePath(principal, account._id, 'state', account.state, options, err => {
                callback(null, org, account, principal, err)
              })

            } else {
              callback(null, org, account, principal, err)
            }
          })
        } else {
          callback(null, org, account, principal, null)
        }
      },

      // send a welcome +/ verification email?
      (org, account, principal, tokenFault, callback) => {

        if (options['sendWelcomeEmail']) {

          if (options['isProvisioned']) {

            if (options['newLoginExperience']) {

              if (ssoOnly) {
                org.sendNotification('AccountWelcome', {
                  account: account,
                  req: req,
                  variables: {
                    ssoOnly,
                    newLoginExperience: true
                  }
                })
                callback(null, org, account, principal, tokenFault)
              } else {
                this.requestPasswordReset(org, account.email, account.username, account._id, locale, { sendEmail: false, sendSms: false, activateOrVerify: true, skipAccountProfileUpdateTrigger: true, clientKey: options.clientKey }, (err, token) => {
                  if (!err) {
                    org.sendNotification('AccountWelcome', {
                      account: account,
                      req: req,
                      variables: {
                        ssoOnly,
                        newLoginExperience: true,
                        passwordResetToken: token
                      }
                    })
                  }
                  callback(err, org, account, principal, tokenFault)
                })
              }
            } else {
              if (ssoOnly) {
                // sso only account should not get password reset notification
                callback(null, org, account, principal, tokenFault)
              } else {
                // create reset password link and send provisioning email.
                this.requestPasswordReset(org, account.email, account.username, account._id, locale, { sendEmail: false, sendSms: false, activateOrVerify: true, skipAccountProfileUpdateTrigger: true, clientKey: options.clientKey }, (err, token) => {
                  if (!err) {
                    org.sendNotification('AccountProvisioned', {
                      account: account,
                      req: req,
                      variables: {
                        createPassword: token
                      }
                    })
                  }
                  callback(err, org, account, principal, tokenFault)
                })
              }
            }
          } else if (account.activationRequired) {

            // send private beta activation email.
            org.sendNotification(principal.hasRole(acl.OrgProviderRole) ? 'AccountWelcomeActivationProvider' : 'AccountWelcomeActivation', {
              account: account,
              req: req
            })
            callback(null, org, account, principal, tokenFault)

          } else if (account.state === 'verified') {

            org.sendNotification(principal.hasRole(acl.OrgProviderRole) ? 'AccountWelcomeProvider' : 'AccountWelcome', {
              account: account,
              req: req
            })
            callback(null, org, account, principal, tokenFault)

          } else {

            // account is activated but requires verification. send welcome/verification combo.
            this.sendAccountVerification(principal.hasRole(acl.OrgProviderRole) ? 'AccountVerificationProvider' : 'AccountVerification', principal.org, account, { clientKey: options.clientKey }, () => {
              callback(null, org, account, principal, tokenFault)
            })

          }
        } else {
          callback(null, org, account, principal, tokenFault)
        }

      },

      // send a verification email if no token was processed.
      (org, account, principal, tokenFault, callback) => {

        // send a notice that an account was registered and requires activation?
        if (account.activationRequired) {
          try {
            const recipients = utils.array(utils.path(org, 'configuration.email.registrations'))
            if (recipients.length > 0) {
              org.sendNotification('AdminAccountRegistrationNotification', {
                account: account,
                subject: consts.Notifications.Types.AdminAccountRegistrationNotification.label,
                message: 'A new account in your organization (' + account.email + ') requires activation.',
                recipients: recipients
              })
            }
          } catch (e) {}
        }

        callback(null, account, tokenFault)
      }

    ], callback)
  }

  /**
     *
     * @param org
     * @param email
     * @param username
     * @param accountId
     * @param locale
     * @param {(object|function)=} options
     *     sendEmail: true,
     *     activateOrVerify: false,
     *     skipAccountProfileUpdateTrigger: false
     *     clientKey
     *
     * @param {function=} callback
     *
     */
  requestPasswordReset(org, email, username, accountId, locale, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    options = utils.extend({
      sendEmail: true,
      sendSms: true,
      activateOrVerify: false,
      skipAccountProfileUpdateTrigger: false,
      clientKey: null
    }, options)

    const query = { org: org._id, object: 'account' },
          { enableEmail, enableUsername } = org.configuration.accounts

    if (accountId) {

      if (!utils.couldBeId(accountId)) {
        callback(Fault.create('cortex.invalidArgument.invalidObjectId'))
        return
      }

      query._id = accountId

    } else if (enableEmail && enableUsername) {
      if (!modules.validation.isEmail(email) && username) {
        query.username = username
      } else if (modules.validation.isEmail(email)) {
        query.email = email
      }
    } else if (enableEmail && email) {
      if (email) {
        if (!modules.validation.isEmail(email)) {
          callback(Fault.create('cortex.invalidArgument.emailFormat'))
          return
        }
        query.email = email.toLowerCase()
      }
    } else if (enableUsername && username) {
      query.username = username
    }

    if (!query.email && !query.username && !query._id) {
      callback(Fault.create('cortex.invalidArgument.required', { reason: 'email, username, or accountId is not present' }))
      return
    }

    // find the associated account.
    models.account.findOne(query).select('_id locale loginMethods roles').lean().exec((err, account) => {

      err = Fault.from(err)
      if (err) {
        callback(err)
        return
      } else if (!account) {

        // fail silently to avoid information leakage?
        return callback(null, null)
      }

      // create a password reset token that expires in x days.
      const callbackOptions = {
              expiresMs: config('auth.passwordResetTokenExpiryMs'),
              targetId: account._id,
              clientKey: options.clientKey
            },
            loginMethods = Array.isArray(account.loginMethods) && account.loginMethods.length ? account.loginMethods : org.configuration.loginMethods

      if (Array.isArray(loginMethods) && !loginMethods.includes('credentials') && !inIdArray(account.roles, consts.roles.admin)) {
        callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Can not request password reset for passwordless account. Login methods must include credentials.' }))
        return
      }

      if (options['activateOrVerify']) {
        callbackOptions.data = { activateOrVerify: true, skipAccountProfileUpdateTrigger: utils.rBool(options.skipAccountProfileUpdateTrigger) }
      }

      models.callback.createCallback(org, consts.callbacks.pass_reset, account._id, email || username, callbackOptions, (err, callbackObject) => {

        if (!err && (options['sendEmail'] || options['sendSms'])) {
          org.sendNotification('LostPassword', {
            account: account,
            locale: account.locale || locale,
            variables: {
              reset: callbackObject.token
            }
          })
        }
        callback(err, callbackObject.token)
      })

    })

  }

  connectionTokenCheckBeforeLoginHandler(req, body, principal, account, callback) {

    async.waterfall([

      // when manual verification is active, tokens will activate accounts but will not verify them. in that case,
      // the token should live, so run a test against it instead of applying it.
      callback => {

        if (!body || !body.token) {
          return callback(null, null)
        }

        // for non-activated accounts, we allow invitations to trigger account verification. if we did this for activated accounts,
        // we'd create a hole whereby a token fault would occur for mismatched invitation emails when an account was created, but then allow verification
        // here because of the update. point is, please have a gander at the /account/register code before changing this behaviour. - james
        models.connection.applyToken(principal, body.token, { skipAccountTest: account.activationRequired, req: req }, (tokenErr, connection) => {

          if (!tokenErr && account.activationRequired) {

            const update = { $unset: { activationRequired: 1 } },
                  connectionEmail = utils.path(connection, 'target.email'),
                  doVerify = !connectionEmail || (connectionEmail === principal.email)

            // if the account is not verified, treat the connection as an invitation and auto-verify the account when the email targets match.
            if (doVerify) {
              update.$set = { state: 'verified' }
            }

            models.account.collection.updateOne({ _id: principal._id }, update, err => {

              if (err) {
                logger.error('Account activation flag removal on login failed for account: ', Object.assign(utils.toJSON(err, { stack: true }), { principal: principal._id }))
              } else {

                // cleanup verification tokens.
                if (doVerify) {
                  // noinspection JSValidateTypes,JSCheckFunctionSignatures
                  models.callback.deleteMany(
                    { handler: consts.callbacks.ver_acct, sender: principal._id },
                    err => {
                      if (err) logger.debug('error removing account verification callbacks', err.stack)
                    }
                  )

                }

                // remove activation emails.
                // noinspection JSValidateTypes,JSCheckFunctionSignatures
                models.callback.deleteMany(
                  { handler: consts.callbacks.act_acct, sender: principal._id, org: req.orgId },
                  err => {
                    if (err) logger.debug('error removing account activation callbacks', err.stack)
                  }
                )

              }

              account.activationRequired = false

              callback(null, tokenErr)
            })

          } else {
            callback(null, tokenErr)
          }
        })

      },

      (tokenFault, callback) => {

        if (tokenFault) {
          req.__tokenFault = tokenFault
        }

        callback(account.activationRequired ? Fault.create('cortex.accessDenied.accountActivationRequired') : null)
      }

    ], callback)

  }

}

module.exports = new AccountsModule()
