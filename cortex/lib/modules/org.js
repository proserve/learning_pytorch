'use strict'

const utils = require('../utils'),
      { resolveOptionsCallback, stringToBoolean, createId } = utils,
      Fault = require('cortex-service/lib/fault'),
      _ = require('underscore'),
      async = require('async'),
      consts = require('../consts'),
      config = require('cortex-service/lib/config'),
      modules = require('../modules'),
      models = modules.db.models,
      acl = require('../acl'),
      ap = require('../access-principal'),
      limitedPaths = ['_id', 'name', 'email', 'username', 'loginMethods'],
      allowedPaths = ['_id', 'name', 'email', 'username', 'mobile', 'roles', 'activationRequired', 'state', 'locked', 'security', 'gender', 'dob', 'tz', 'profile.provider.specialty', 'profile.provider.affiliation', 'profile.provider.state', 'profile.provider.license', 'profile.provider.npi', 'loginMethods']

function getAccountModel(principal, callback) {
  principal.org.createObject('Account', (err, Account) => {
    void err
    callback(Account || modules.db.models.account)
  })
}

class OrgModule {

  constructor() {
    return OrgModule
  }

  static deactivateAccount(principal, accountId, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    accountId = utils.getIdOrNull(accountId)
    if (!accountId) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { path: 'accountId' }))
    } else if (!utils.path(principal, 'org.registration.activationRequired')) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'activationRequired' }))
    }

    async.waterfall(
      [

        // lookup the account
        callback => modules.org.readAccount(principal, accountId, (err, account) => callback(err, account)),

        (account, callback) => {
          if (account.activationRequired) {
            return callback(null, account)
          }
          const updateOptions = {
            req: options.req,
            method: 'put',
            override: acl.AccessLevels.System
          }
          getAccountModel(principal, Account => {
            Account.aclUpdatePath(principal, accountId, 'activationRequired', true, updateOptions, err => {
              if (!err) {
                account.activationRequired = true
              }
              callback(err, account)
            })
          })
        }

      ],
      callback
    )

  }

  static async refreshOrg(ac, preserve, authCallback) {

    const { org, principal } = ac,
          sourceId = createId(),
          fn = typeof authCallback === 'function' ? authCallback : cb => { cb() }

    if (org.code === 'medable') {
      throw Fault.create('cortex.accessDenied.unspecified', { reason: 'Org refresh is not enabled for this environment' })
    }
    if (!principal.isOrgAdmin()) {
      throw Fault.create('cortex.accessDenied.role')
    }
    if (!modules.authentication.authInScope(principal.scope, 'admin.update')) {
      throw Fault.create('cortex.accessDenied.scope', { path: 'admin.update' })
    }
    if (!org.configuration.allowOrgRefresh) {
      throw Fault.create('cortex.accessDenied.unspecified', { reason: 'Org refresh is not enabled for this environment' })
    }

    await utils.promised(null, fn)

    modules.deployment.log(new acl.AccessContext(principal, org), sourceId, 'Refresh Requested')

    modules.workers.send('work', 'org-refresher', {
      org: org._id,
      principal: principal._id,
      preserve: modules.workers.getWorker('org-refresher').resolvePreserveOptions(preserve),
      sourceId
    }, {
      reqId: ac.reqId,
      orgId: ac.orgId
    })

    return sourceId

  }

  /**
   *
   * @param principal
   * @param accountId
   * @param options
   *  req
   * @param callback
   * @returns {*}
   */
  static deleteAccount(principal, accountId, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    accountId = utils.getIdOrNull(accountId)
    if (!accountId) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { path: 'accountId' }))
    } else if (!utils.path(principal, 'org.configuration.allowAccountDeletion')) {
      return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Cannot remove accounts in this organization.' }))
    }

    async.waterfall(
      [

        callback => modules.org.readAccount(principal, accountId, (err, account) => callback(err, account)),

        (account, callback) => {

          if (utils.inIdArray(utils.array(account.roles), acl.OrgAdminRole)) {
            return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Cannot remove Administrator accounts' }))
          }

          const deleteOptions = {
            req: options.req,
            method: 'delete',
            override: acl.AccessLevels.System
          }
          getAccountModel(principal, Account => {
            Account.aclDelete(principal, accountId, deleteOptions, err => {
              callback(err, account)
            })
          })
        }

      ],

      callback

    )

  }

  static updateAccount(principal, accountId, input, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    // only allow certain properties to be updated.
    const props = [
            'name.first', 'name.last', 'email', 'mobile', 'roles', 'password', 'username', 'activationRequired', 'state', 'locked',
            'gender', 'dob', 'tz', 'loginMethods', 'profile.provider.specialty', 'profile.provider.affiliation',
            'profile.provider.state', 'profile.provider.license', 'profile.provider.npi',
            'stats.mustResetPassword', 'stats.passwordExpires'
          ],
          payload = {},
          writeOptions = {
            req: options.req,
            method: 'put',
            override: acl.AccessLevels.System,
            acOptions: {
              skipAccountProfileUpdateTrigger: true
            }
          }

    input = input || {}

    props.forEach(function(prop) {
      const value = utils.path(input, prop)
      if (value !== undefined) {
        utils.path(payload, prop, value)
      }
    })

    getAccountModel(principal, Account => {
      Account.aclUpdate(principal, accountId, payload, writeOptions, function(err) {
        if (err) callback(err)
        else {
          modules.org.readAccount(principal, accountId, function(err, account) {
            callback(err, account)
          })
        }
      })
    })

  }

  static readAccount(principal, accountId, callback) {
    OrgModule.listAccounts(principal, { accountId }, (err, list) => {
      let output = null
      if (!err) {
        if (list.data.length === 0) {
          err = Fault.create('cortex.notFound.account')
        } else {
          output = list.data[0]
        }
      }
      callback(err, output)
    })
  }

  /**
   *
   * @param principal
   * @param options
   *  accountId
   *  req
   *  skip (Number)
   *  limit (Number)
   *  total (Boolean)
   *  filterActivationsOrVerifications (Boolean)
   *  filterProviderVerifications (Boolean)
   *  filterLockedAccounts (Boolean)
   *  filterActive (Boolean)
   *  accountRoles (ObjectId[])
   *  search (String)
   *
   * @param callback
   */
  static listAccounts(principal, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    // allow more in dev environment.
    const isOnlyDeveloper = config('app.env') === 'production' && principal.hasRole(acl.OrgDeveloperRole) && !principal.hasRole(acl.OrgSupportRole),
          activationRequired = !isOnlyDeveloper && !!utils.path(principal.org, 'registration.activationRequired')

    async.waterfall([

      // get the list
      function(callback) {

        const listOptions = utils.extend(_.pick(options, 'skip', 'limit'), {
                req: options.req,
                skipAcl: true,
                override: true,
                resolveAccess: false,
                paths: isOnlyDeveloper ? limitedPaths : allowedPaths,
                fullSilence: true,
                total: stringToBoolean(options.total)
              }),
              // search and filter.
              conditions = [],
              search = options.search

        if (!isOnlyDeveloper) {
          if (stringToBoolean(options['filterActivationsOrVerifications'])) {
            if (activationRequired) {
              conditions.push({ activationRequired: true })
            } else {
              conditions.push({ state: 'unverified' })
            }
          }
          if (stringToBoolean(options['filterProviderVerifications'])) {
            conditions.push({ 'profile.provider.state': 'processing' })
          }
          if (stringToBoolean(options['filterLockedAccounts'])) {
            conditions.push({ 'locked': true })
          }

          if (stringToBoolean(options['filterActive'])) {
            conditions.push({ state: 'verified', $or: [{ activationRequired: false }, { activationRequired: { $exists: false } }] })
          }

          if (options['accountRoles']) {
            conditions.push({ roles: { $in: utils.getIdArray(options['accountRoles']) } })
          }
        }

        let accountIds = []
        if (search) {

          if (!options.accountId && (accountIds = utils.getIdArray(search)).length === 0) { // use account id if provided
            if (_.isString(search)) {
              if (search.length > 0) {
                if (modules.validation.isEmail(search)) {
                  conditions.push({ email: new RegExp('^' + utils.escapeRegex(search) + '$', 'i') })
                } else {
                  const parts = search.split(' '), first = parts[0], last = parts.slice(1).join(' ')
                  if (last.length > 0) {
                    conditions.push({ 'name.first': new RegExp('^' + utils.escapeRegex(first) + '$', 'i'), 'name.last': new RegExp('^' + utils.escapeRegex(last), 'i') })
                  } else {
                    conditions.push({ $or: [
                      { email: new RegExp('^' + utils.escapeRegex(first), 'i') },
                      { username: new RegExp('^' + utils.escapeRegex(first), 'i') },
                      { 'name.first': new RegExp('^' + utils.escapeRegex(first), 'i') },
                      { 'name.last': new RegExp('^' + utils.escapeRegex(first), 'i') }
                    ] })
                  }
                }
              }
            }
          }
        }

        if (options.accountId) {
          conditions.push({ _id: utils.getIdOrNull(options.accountId) })
        } else if (accountIds.length) {
          conditions.push({ _id: { $in: accountIds } })
        }

        if (conditions.length === 1) {
          listOptions.internalWhere = conditions[0]
        } else if (conditions.length > 1) {
          listOptions.internalWhere = { $and: conditions }
        }

        models.account.aclList(principal, listOptions, callback)

      },

      // add "verificationSent" property. applies to both activation and verification scenarios.
      function(list, callback) {

        const handler = activationRequired ? consts.callbacks.act_acct : consts.callbacks.ver_acct,
              ids = []

        list.data.forEach(function(doc) {
          if ((!activationRequired && doc.state === 'unverified') || (activationRequired && doc.activationRequired)) {
            ids.push(doc._id)
          }
        })

        if (ids.length > 0) {

          models.callback.find({ handler: handler, org: principal.orgId, targetId: { $in: ids } }).lean(true).select({ targetId: 1 }).exec(function(err, sent) {
            if (!err) {
              sent.forEach(function(item) {
                for (let i = 0, j = list.data.length; i < j; i++) {
                  if (utils.equalIds(item.targetId, list.data[i]._id)) {
                    list.data[i].verificationSent = true
                    break
                  }
                }
              })
            }
            callback(err, list)
          })

        } else {
          callback(null, list)
        }

      }

    ], callback)

  }

  /**
   * @param orgInput
   * @param accountInput
   * @param options
   *  validateOrgCode (string[null]) if passed, checks for availability of org code and calls back -> err, true;
   *  maxApps: 2
   *  validateOnly: false
   *  minPasswordScore: 2
   *  accountPassword: null
   *  requireMobile: true
   *
   * @param callback -> err, result
   */
  static provision(orgInput, accountInput, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    modules.db.models.org.loadOrg('medable', (err, medable) => {

      if (err) {
        return callback(err)
      }

      orgInput = orgInput || {}
      accountInput = accountInput || {}

      const Org = modules.db.models.org,
            Account = modules.db.models.Account,
            req = options.req || { _id: utils.createId() },
            orgCodeCheck = utils.rString(options.validateOrgCode, null),
            principal = ap.synthesizeOrgAdmin(medable),
            orgId = utils.createId(),
            creatorId = utils.createId(),
            accountPassword = utils.rString(options.accountPassword),
            requireMobile = utils.rBool(options.requireMobile, medable.configuration.accounts.requireMobile),
            requireEmail = utils.rBool(options.requireEmail, medable.configuration.accounts.requireEmail),
            requireUsername = utils.rBool(options.requireUsername, medable.configuration.accounts.requireUsername),
            orgPayload = {
              code: String(orgInput.code),
              name: orgInput.name,
              state: orgInput.state,
              configuration: {
                defaultIdentifierSortOrder: 0,
                legacyAuditHistoryValues: false,
                maxApps: utils.rInt(options.maxApps, 10),
                maxKeysPerApp: 1,
                minPasswordScore: utils.rInt(options.minPasswordScore, 2),
                allowSimultaneousLogins: false,
                email: {
                  locationBypass: [accountInput.email]
                }
              },
              registration: {
                allow: false
              }
            }, accountPayload = {
              name: {
                first: utils.path(accountInput, 'name.first'),
                last: utils.path(accountInput, 'name.last')
              },
              email: accountInput.email,
              mobile: accountInput.mobile,
              username: accountInput.username,
              password: utils.rString(accountPassword, modules.authentication.generatePassword(32)),
              roles: [acl.OrgAdminRole]
            }

      if (orgInput.ephemeral) {
        orgPayload.configuration.ephemeral = orgInput.ephemeral
        orgPayload.configuration.ephemeralExpireAt = orgInput.ephemeralExpireAt
      }

      if (_.isString(orgCodeCheck)) {
        return modules.db.models.org.schema.path('code').doAcValidate(
          new acl.AccessContext(principal, null),
          orgCodeCheck,
          err => callback(err, true),
          new Org({ code: orgCodeCheck })
        )
      }

      // first, validate the payload.
      async.parallel({
        org: function(callback) {
          const ac = new acl.AccessContext(principal, new Org(), { method: 'post', override: true })
          ac.option('provisioningOrg', true)
          ac.subject.creator._id = consts.principals.anonymous
          ac.subject.aclWrite(ac, orgPayload, function(err) {
            if (err) callback(err)
            else {
              ac.subject.validateWithAc(ac, function(err) {
                err = Fault.from(err)
                callback((err && err.errCode === 'cortex.invalidArgument.validation') ? null : err, err)
              })
            }
          })
        },
        account: function(callback) {
          const ac = new acl.AccessContext(principal, new Account(), { method: 'post', override: true })
          ac.option('provisioningOrg', true)
          ac.subject.aclWrite(ac, accountPayload, function(err) {
            if (err) callback(err)
            else {
              ac.subject.validateWithAc(ac, function(err) {
                err = Fault.from(err)
                if ((!err || err.errCode === 'cortex.invalidArgument.validation')) {
                  let code = 'cortex.invalidArgument.required', f
                  if (requireMobile && ac.subject.mobile === undefined) {
                    f = { reason: 'A mobile number is required.', path: 'account.mobile' }
                  }
                  if (requireEmail && ac.subject.email === undefined) {
                    f = { reason: 'A email is required.', path: 'account.email' }
                  }
                  if (requireUsername && ac.subject.username === undefined) {
                    f = { reason: 'A username is required.', path: 'account.username' }
                  }
                  if (f) {
                    if (err) {
                      err.add(Fault.create(code, f))
                    } else {
                      err = Fault.validationError(code, f)
                    }
                  }
                }
                callback((err && err.errCode === 'cortex.invalidArgument.validation') ? null : err, err)
              })
            }
          })
        }
      }, function(err, results) {

        // if there are validation errors, merge them all into a single  top level validation error and rename the faults to match the input paths.
        if (!err && (results.org || results.account)) {
          err = Fault.create('cortex.invalidArgument.validation')
          if (results.org) {
            results.org.faults.forEach(function(fault) {
              fault.path = fault.name = 'org.' + fault.path
              err.add(fault)
            })
          }
          if (results.account) {
            results.account.faults.forEach(function(fault) {
              fault.path = fault.name = 'account.' + fault.path
              err.add(fault)
            })
          }
        }

        if (err || utils.rBool(options.validateOnly, false)) {
          return callback(err, true)
        }

        // create the org and account as an org admin. yes, we are validating twice, but it reduces half-created org errors.
        async.waterfall([

          // create the org
          function(callback) {
            const options = {
              override: acl.AccessLevels.System,
              contextId: orgId,
              creatorId: creatorId,
              forceAllowCreate: true,
              req
            }
            modules.db.models.org.aclCreate(principal, orgPayload, options, function(err, { ac }) {
              callback(err, ac && ac.subject)
            })
          },

          // create the account
          function(org, callback) {

            modules.accounts.provisionAccount(null, accountPayload, org, 'en_US', 'unverified', req, {
              skipActivation: true,
              sendWelcomeEmail: false,
              requireMobile,
              requireUsername,
              requireEmail,
              accountObject: {
                _id: creatorId
              }
            }, function(err, account) {
              callback(err, org, account)
            })
          },

          // create a password reset for the org, if it's enabled.
          function(org, account, callback) {

            if (org.state === 'enabled' && !accountPassword) {
              modules.accounts.requestPasswordReset(org, account.email, account.username, account._id, 'en_US', { sendEmail: false, sendSms: false, activateOrVerify: true, skipAccountProfileUpdateTrigger: true }, function(err, token) {
                callback(err, org, account, token)
              })
            } else {
              callback(null, org, account, null)
            }
          },

          function(org, account, token, callback) {

            // the media pointers for the default logo and favicon must be written in the context of the new org.
            ap.create(org, account, function(err, principal) {
              if (err) {
                return callback(null, org, account, token)
              }

              // base org not have logo and favicon?
              let lp, ltp, fp
              try {
                const ac = new acl.AccessContext(principal, org)
                lp = modules.storage.accessPointer(medable, medable.constructor.schema.node.findNode('logo'), medable.logo, 'content', ac)
                ltp = modules.storage.accessPointer(medable, medable.constructor.schema.node.findNode('logo'), medable.logo, 'thumbnail', ac)
                fp = modules.storage.accessPointer(medable, medable.constructor.schema.node.findNode('favicon'), medable.favicon, 'content', ac)
              } catch (e) {
                return callback(null, org, account, token)
              }

              modules.db.models.org.aclUpdate(principal, org._id, {
                logo: {
                  content: lp,
                  thumbnail: ltp
                },
                favicon: {
                  content: fp
                }
              }, { req, method: 'put' }, function(err, { ac }) {

                if (!err) {
                  org.logo = ac.subject.logo
                  org.favicon = ac.subject.favicon
                }

                callback(null, org, account, token)
              })

            })
          }

        ], function(err, org, account, token) {
          if (err) callback(err)
          else {

            ap.create(org, account, function(err, principal) {
              if (err) callback(err)
              else {
                async.parallel({
                  medable: function(callback) {
                    modules.db.models.org.aclReadOne(ap.synthesizeAccount({ org: medable, accountId: acl.AnonymousIdentifier }), acl.BaseOrg, function(err, org) {
                      callback(err, org)
                    })
                  },
                  org: function(callback) {
                    modules.db.models.org.aclReadOne(principal, org._id, function(err, org) {
                      callback(err, org)
                    })
                  },
                  account: function(callback) {
                    modules.db.models.account.aclReadOne(principal, account._id, function(err, account) {
                      callback(err, account)
                    })
                  },
                  passwordUrl: function(callback) {
                    callback(null, token ? org.generateEmailUrl('createPassword', token) : undefined)
                  }
                }, callback)
              }
            })
          }
        })

      })

    })

  }

  static readOrg(ac, orgId, options, callback) {
    [options, callback] = utils.resolveOptionsCallback(options, callback)
    this.listOrgs(ac, orgId, options, function(err, list) {
      let output = null
      if (!err) {
        if (list.data.length === 0) {
          err = Fault.create('cortex.notFound.env')
        } else {
          output = list.data[0]
        }
      }
      callback(err, output)
    })
  }

  /**
   *
   * @param ac
   * @param orgCodeOrId
   * @param options
   * @param callback --> err, list, total
   */
  static listOrgs(ac, orgCodeOrId, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    async.waterfall([

      // get the list
      function(callback) {

        const readOptions = utils.extend(_.pick(options, 'paths', 'include', 'expand', 'skip', 'limit', 'search'), {
                req: ac.req,
                skipAcl: true,
                override: true,
                crossOrg: true,
                total: stringToBoolean(options.total)
              }),
              conditions = []

        if (orgCodeOrId) {
          const isId = utils.couldBeId(orgCodeOrId)
          conditions.push({ [isId ? '_id' : 'code']: isId ? utils.getIdOrNull(orgCodeOrId) : orgCodeOrId })
        } else {

          if (options['filterEnabled'] != null) {
            const filterEnabled = stringToBoolean(options['filterEnabled'])
            conditions.push({ state: filterEnabled ? 'enabled' : 'disabled' })
          }

          const search = options.search
          if (_.isString(search) && search.length > 0) {
            conditions.push({ $or: [{ name: new RegExp('^' + utils.escapeRegex(search), 'i') }, { code: new RegExp('^' + utils.escapeRegex(search), 'i') }] })
          }
        }

        if (conditions.length === 1) {
          readOptions.internalWhere = conditions[0]
        } else if (conditions.length > 1) {
          readOptions.internalWhere = { $and: conditions }
        }

        // select paths.
        readOptions.paths = modules.hub.readableEnvironmentPaths(ac.org, [acl.OrgAdminRole])

        modules.db.models.org.aclList(ac.principal, readOptions, callback)

      },

      // expand creators
      function(list, callback) {

        if (list.data.length === 0) {
          return callback(null, list)
        }

        const find = { $or: list.data.reduce((conditions, orgDoc) => {
          const creatorId = utils.path(orgDoc, 'creator._id')
          if (creatorId) {
            conditions.push({ org: orgDoc._id, object: 'account', reap: false, _id: creatorId })
          }
          return conditions
        }, []) }

        // add stubs
        list.data.forEach(function(org) {
          org.creator = org.creator || { _id: utils.createId(), object: 'account', email: '' }
        })

        if (find.$or.length === 0) {
          return callback(null, list)
        }

        modules.db.models.account.find(find).select('_id object email').lean().exec((err, accountDocs) => {
          if (!err) {
            list.data.forEach(function(org) {
              org.creator = utils.findIdInArray(accountDocs, '_id', utils.path(org, 'creator._id')) || org.creator
            })
          }
          callback(err, list)
        })

      }

    ], callback)

  }

  /**
   * Update Org
   * @param ac
   * @param orgCodeOrId
   * @param payload
   * @param options
   * @param callback --> err, result
   */
  static updateOrg(ac, orgCodeOrId, payload, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    if (!modules.authentication.authInScope(ac.principal.scope, 'admin.update')) {
      return callback(Fault.create('cortex.accessDenied.scope', { path: 'admin.update' }))
    }

    // only allow certain properties to be updated.
    payload = payload || {}

    const updateObject = {},
          isId = utils.couldBeId(orgCodeOrId),
          updateFilter = {
            [isId ? '_id' : 'code']: isId ? utils.getIdOrNull(orgCodeOrId) : orgCodeOrId
          },
          updateOptions = {
            req: ac.req,
            includeAccess: false,
            override: true,
            crossOrg: true,
            method: 'put'
          }

    modules.hub.updatableEnvironmentPaths(ac.org, [acl.OrgAdminRole]).forEach(function(prop) {
      const value = utils.path(payload, prop)
      if (value !== undefined) {
        utils.path(updateObject, prop, value)
      }
    })

    // app key manipulation
    utils.array(payload.apps).forEach(function(app) {
      const appId = utils.getIdOrNull(utils.path(app, '_id'))
      if (appId) {
        utils.array(app.clients).forEach(function(inClient) {
          const clientId = utils.getIdOrNull(utils.path(inClient, '_id'))
          if (clientId && inClient.key) {
            const apps = updateObject.apps || (updateObject.apps = [])
            let client,
                app = utils.findIdInArray(apps, '_id', appId)
            if (!app) {
              app = { _id: appId, clients: [] }
              apps.push(app)
            }
            client = utils.findIdInArray(app.clients, '_id', clientId)
            if (!client) {
              client = { _id: clientId }
              app.clients.push(client)
            }
            client.key = inClient.key
          }
        })
      }
    })

    modules.db.models.org.aclUpdate(ac.principal, updateFilter, updateObject, updateOptions, function(err) {
      if (err) callback(err)
      else {
        modules.org.readOrg(ac, orgCodeOrId, function(err, org) {
          callback(err, org)
        })
      }
    })
  }

}

module.exports = OrgModule
