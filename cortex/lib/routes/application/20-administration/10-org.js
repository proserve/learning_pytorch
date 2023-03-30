'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      _ = require('underscore'),
      async = require('async'),
      request = require('request'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      consts = require('../../../consts'),
      acl = require('../../../acl')

module.exports = function(express, router) {

  // only support role is allowed here in production.

  /**
     * Deactivate Account
     */
  router.get('/org/accounts/deactivate/:accountId',
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'production' ? middleware.role_restricted.support_only : middleware.role_restricted.developer_and_support_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.update')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'admin.update' }))
      }

      modules.org.deactivateAccount(req.principal, req.params.accountId, { req }, (err, account) => {
        utils.outputResults(res, err, account)
      })

    }
  )

  /**
     * Delete Account
     */
  router.delete('/org/accounts/:accountId',
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'production' ? middleware.role_restricted.support_only : middleware.role_restricted.developer_and_support_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.update')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'admin.update' }))
      }

      modules.org.deleteAccount(req.principal, req.params.accountId, { req }, (err, account) => {
        utils.outputResults(res, err, account)
      })

    }
  )

  /**
     * Lookup NPI
     */
  router.get('/org/accounts/npilookup/:number',
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'production' ? middleware.role_restricted.support_only : middleware.role_restricted.developer_and_support_only,
    middleware.policy,
    function(req, res) {

      const number = utils.rInt(req.params.number),
            done = _.once((err, result) => {
              utils.outputResults(res, err, result)
            })

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.read')) {
        return done(Fault.create('cortex.accessDenied.scope', { path: 'admin.read' }))
      } else if (!number) {
        return done(Fault.create('cortex.invalidArgument.unspecified', { path: 'number' }))
      }

      try {
        const options = {
          strictSSL: true,
          method: 'get',
          url: 'https://npiregistry.cms.hhs.gov/api/?number=' + number,
          headers: {
            'user-agent': 'Cortex-API HTTP/' + utils.version()
          },
          timeout: 5000
        }
        request(options, function(err, response, body) {
          try {
            body = JSON.parse(body)
          } catch (e) {}
          done(err, body)
        })

      } catch (err) {
        done(err)
      }

    }
  )

  /**
     * List Account
     */
  router.get('/org/accounts/:accountId',
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'production' ? middleware.role_restricted.support_only : middleware.role_restricted.developer_and_support_only,
    middleware.policy,
    function(req, res, next) {

      const accountId = utils.getIdOrNull(req.params.accountId)
      if (!accountId) {
        return next()
      }

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.read')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'admin.read' }))
      }

      modules.org.readAccount(req.principal, accountId, (err, account) => utils.outputResults(res, err, account))
    }
  )

  /**
     * List Accounts
     */
  router.get('/org/accounts',
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'production' ? middleware.role_restricted.support_only : middleware.role_restricted.developer_and_support_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.read')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'admin.read' }))
      }

      modules.org.listAccounts(req.principal, { ...req.query, req }, (err, list) => utils.outputResults(res, err, list))
    }
  )

  /**
     * Provision Account
     */
  router.post('/org/accounts',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'production' ? middleware.role_restricted.support_only : middleware.role_restricted.developer_and_support_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.update')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'admin.update' }))
      }

      const accountState = utils.path(req.org, 'registration.bypassAccountVerification') ? 'verified' : 'unverified'

      modules.accounts.provisionAccount(req.principal, req.body, req.org, req.locale, accountState, req, { clientKey: req.orgClient.key }, function(err, account) {
        if (err) next(err)
        else {
          modules.org.readAccount(req.principal, account._id, function(err, account) {
            utils.outputResults(res, err, account)
          })
        }
      })
    }
  )

  /**
     * Update account
     */
  router.put('/org/accounts/:accountId',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'production' ? middleware.role_restricted.support_only : middleware.role_restricted.developer_and_support_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.update')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'admin.update' }))
      }

      modules.org.updateAccount(req.principal, req.params.accountId, req.body || {}, { req }, function(err, account) {
        utils.outputResults(res, err, account)
      })

    }
  )

  /**
     * Verify provider
     */
  router.post('/org/accounts/provider/verify/:accountId',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'production' ? middleware.role_restricted.support_only : middleware.role_restricted.developer_and_support_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.update')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'admin.update' }))
      }

      async.waterfall([

        callback => modules.db.models.org.aclReadOne(req.principal, req.org, { req: req, document: req.org }, (err, org) => callback(err, org)),

        (org, callback) => {

          modules.db.models.account.aclReadOne(req.principal, req.params.accountId, { req: req, override: acl.AccessLevels.System, json: false, paths: ['_id', 'locale', 'profile.provider.state'] }, function(err, account, ac) {

            if (err) {
              callback(err)
            } else {

              const state = utils.path(account, 'profile.provider.state')
              if (state === 'verified') {
                callback()
              } else if (state !== 'processing') {
                callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'State must be "processing".' }))
              } else {
                const payload = utils.path({}, 'profile.provider.state', 'verified', true)

                ac.method = 'put'
                account.aclWrite(ac, payload, function(err) {
                  if (err) {
                    callback(err)
                  } else {
                    ac.hook('save').after(function(vars) {
                      if (~vars.modified.indexOf('profile.provider.state')) {
                        req.org.sendNotification('ProviderVerificationComplete', {
                          account: account,
                          req: req
                        })
                      }
                    })
                    ac.save({ versioned: false, changedPaths: ['profile.provider.state'] }, function(err) {
                      callback(err)
                    })
                  }
                })
              }

            }
          })
        }

      ], err => utils.outputResults(res, err, true))

    }
  )

  /**
     * Trigger Activation/Verification
     */
  router.get('/org/accounts/activateOrVerify/:accountId',
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'production' ? middleware.role_restricted.support_only : middleware.role_restricted.developer_and_support_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.update')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'admin.update' }))
      }

      async.waterfall([

        function(callback) {

          const activationRequired = !!utils.path(req.org, 'registration.activationRequired'),
                orgName = req.org.name,
                orgRoles = req.org.roles

          modules.db.models.account.aclReadOne(req.principal, req.params['accountId'], { req: req, override: true, paths: ['_id', 'email', 'state', 'roles', 'locale', 'activationRequired'] }, function(err, account) {

            if (!err) {
              if (activationRequired) {
                if (!account.activationRequired) {
                  if (account.state === 'verified') {
                    err = Fault.create('cortex.conflict.accountAlreadyActivated')
                  } else if (account.locked) {
                    err = Fault.create('cortex.accessDenied.accountLocked')
                  }
                }
              } else {
                if (account.state === 'verified') {
                  err = Fault.create('cortex.conflict.accountAlreadyVerified')
                } else if (account.locked) {
                  err = Fault.create('cortex.accessDenied.accountLocked')
                }
              }
            }
            if (err) callback(err)
            else {
              const find = {
                handler: activationRequired ? consts.callbacks.act_acct : consts.callbacks.ver_acct,
                targetId: account._id
              }
              if (activationRequired) find.org = req.orgId
              modules.db.models.callback.findOne(find).lean(true).select({ targetId: 1 }).exec(function(err, cb) {
                callback(err, account, activationRequired, orgName, orgRoles, cb)
              })
            }
          })

        },

        function(account, activationRequired, orgName, orgRoles, cb, callback) {

          const force = utils.stringToBoolean(req.query.force)

          if (cb && !force) {

            callback(Fault.create('cortex.conflict.activationAlreadySent'))

          } else {

            const isProvider = utils.inIdArray(acl.expandRoles(req.principal.org.roles, account.roles), acl.OrgProviderRole)
            let notification
            if (isProvider) {
              if (activationRequired) {
                notification = 'AccountActivationProvider'
              } else {
                notification = 'AccountVerificationProvider'
              }
            } else {
              if (activationRequired) {
                notification = 'AccountActivation'
              } else {
                notification = 'AccountVerification'
              }
            }

            modules.accounts[activationRequired ? 'sendAccountActivation' : 'sendAccountVerification'](notification, req.org, account, { clientKey: req.orgClient.key }, function(err) {
              callback(err)
            })
          }
        }

      ], function(err) {
        utils.outputResults(res, err, true)
      })

    }
  )

  /**
     * Refresh Org
     */
  router.post('/org/refresh',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.org_admin_only,
    middleware.policy,
    utils.asyncHandler(async(req) => {

      // run the refresher.
      return modules.org.refreshOrg(
        new acl.AccessContext(req.principal, req.principal.org),
        utils.path(req, 'body.preserve'),
        (callback) => {

          modules.authentication.attemptAuth(req.org, req.principal.email || req.principal.username, utils.path(req, 'body.accountPassword'), { req, checkLock: true, checkExpired: true }, err => callback(err))

        }
      )

    })
  )

}
