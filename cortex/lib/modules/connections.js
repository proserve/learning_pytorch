'use strict'

const Fault = require('cortex-service/lib/fault'),
      _ = require('underscore'),
      utils = require('../utils'),
      consts = require('../consts'),
      modules = require('./'),
      isEmail = modules.validation.isEmail,
      acl = require('../../lib/acl'),
      async = require('async')

class ConnectionsModule {

  /**
     *
     * @param ac
     * @param target
     * @param options
     *     sendConnectionNotification: true
     *     connectionId: force a connection id (if one is created)
     *     force: false. if true, always creates a new pending connection.
     *     skipShareChain: skips share chain or share acl.
     *     skipAcl: skips share chain or share acl.
     *     forceAuto: false. forces auto creation when require accept is true. target still need auto property set to true.
     *     contextSource: the property context.
     *     appClientId: app client id with which the connection was created.
     *
     * @param callback -> err, connection
     * @returns {*}
     */
  createConnection(ac, target, options, callback) {

    if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

    if (!ac.inAuthScope('object.create.connection')) {
      return callback(Fault.create('cortex.accessDenied.scope', { path: 'object.create.connection' }))
    }

    const Connection = modules.db.models.connection,
          appClientId = options.appClientId || utils.path(ac, 'req.clientId')

    try {
      target = Connection._createTarget(ac.org, (options.skipShareChain || options.skipAcl) ? null : ac, ac.object, target, options.forceAuto)
    } catch (err) {
      return callback(err)
    }

    if (!appClientId) {
      return callback(Fault.create('cortex.invalidArgument.noConnectionApp'))
    }

    if (target.auto) {
      Connection._createSilentConnection(ac, appClientId, target, options, callback)
    } else {
      Connection._createConnection(ac, appClientId, target, options, callback)
    }

  }

  static _getConnectionName(name) {
    const first = utils.rString(utils.path(name, 'first'), ''), last = utils.rString(utils.path(name, 'last'), '')
    if (first || last) {
      return {
        first: first,
        last: last
      }
    }
    return undefined
  }

  /**
     * normalize targets to accounts.
     *
     * @param ac
     * @param targets
     * @param options
     *  forceAuto
     *  skipTargetTest
     *  skipAcl
     * @param callback
     */
  normalizeTargets(ac, targets, options, callback) {

    const principal = ac.principal,
          forceAuto = utils.rBool(utils.path(options, 'forceAuto'), false),
          skipTargetTest = utils.rBool(utils.path(options, 'skipTargetTest'), false),
          skipAcl = utils.rBool(utils.path(options, 'skipAcl'), false) || ac.principal.skipAcl

    targets = utils.array(targets, true)

    ac.org.createObject('Account', function(err, Account) {

      if (err) {
        Account = modules.db.models.account
      }

      async.reduce(targets, [], function(normalized, target, callback) {

        if (!target) {
          return callback(Fault.create('cortex.invalidArgument.connectionTarget'))
        }

        const computed = ac.object.computeShareAccessLevel(ac.org, ac, target.access, target.roles), // reduce access by 1, then follow the chain.
              access = computed[0],
              roles = computed[1],
              _id = utils.getIdOrNull(target._id)

        if (target._id && !_id) {
          return callback(Fault.create('cortex.invalidArgument.connectionTarget', { path: target._id, reason: 'target _id must be a valid ObjectId. "' + target._id + '" is invalid' }))
        }

        // by email or _id?
        let email

        switch (target.object) {

          case null:
          case undefined:
          case 'account':

            if (!_id) {
              email = utils.rString(target.email, '').trim().toLowerCase()
              if (!isEmail(email)) {
                return callback(Fault.create('cortex.invalidArgument.connectionTarget', { path: email, reason: 'if no _id is used, the target account must contain a valid email address. "' + email + '" is invalid' }))
              }
            }

            // self connection?
            if (utils.equalIds(_id, principal._id) || email === principal.email) {
              return callback(Fault.create('cortex.invalidArgument.connectionTarget', { path: 'self', reason: 'You cannot manage connections with yourself.' }))
            }

            // auto? these can only be processed for account _ids
            const auto = utils.rBool(target.auto, false),
                  entry = _.find(normalized, function(entry) {
                    return entry && (utils.equalIds(_id, entry._id) || (isEmail(entry.email) && email === entry.email))
                  })

            if (auto) {
              if (email) {
                return callback(Fault.create('cortex.invalidArgument.autoConnectionRequiresId'))
              }
              if (!forceAuto && ac.object.connectionOptions.requireAccept) {
                return callback(Fault.create('cortex.invalidArgument.requireConnectionAccept'))
              }
            }

            // merge existing valid entry?
            if (entry) {
              entry.access = Math.max(entry.access, access)
              if (!entry.name) {
                entry.name = ConnectionsModule._getConnectionName(target.name)
              }
              if (roles.length) {
                entry.roles = utils.uniqueIdArray([...entry.roles, ...roles])
              }
              entry.auto = entry.auto && auto // pessimistic. this means anything auto has to run through the check below.
              return callback(null, normalized)
            }

            // simple resolve using email?
            if (email) {

              normalized.push({
                validated: true,
                email: email,
                name: ConnectionsModule._getConnectionName(target.name),
                access: access,
                roles: roles,
                auto: false
              })
              callback(null, normalized)

            } else if (!auto) {

              normalized.push({
                validated: false,
                _id: _id,
                name: ConnectionsModule._getConnectionName(target.name),
                access: access,
                roles: roles,
                auto: false
              })
              callback(null, normalized)

            } else {

              // validate access for auto target.
              Account.getAccessContext(principal, _id, function(err, accountAc) {
                if (err) {
                  return callback(Fault.from(err))
                }
                const requiredAccess = Math.max(acl.AccessLevels.Share, acl.fixAllowLevel(ac.object.connectionOptions.requiredAccess)) // sanity/security check. min share required.
                if (!skipAcl && !accountAc.hasAccess(requiredAccess)) {
                  return callback(Fault.create('cortex.accessDenied.autoConnectionRequiresAccess', { path: _id + '.' + requiredAccess }))
                }

                if (!skipTargetTest && accountAc.subject.state !== consts.accountStates.verified) {
                  return callback(Fault.create('cortex.accessDenied.connectionRequiresVerification'))
                }

                normalized.push({
                  validated: false,
                  _id: _id,
                  name: ConnectionsModule._getConnectionName(target.name),
                  access: access,
                  roles: roles,
                  auto: true
                })
                callback(null, normalized)
              })

            }

            break

          default:
            return callback(Fault.create('cortex.invalidArgument.connectionTarget', { path: target.object + '', reason: 'only accounts are valid connection target objects. "' + target.object + '" is invalid' }))

        }

      }, function(err, normalized) {

        if (err) {
          return callback(err)
        }

        // validate remaining account entries.
        const ids = normalized.filter(v => !v.validated && v._id).map(v => v._id),
              opts = {
                skipAcl: true,
                limit: 100,
                paths: ['_id', 'name'],
                hooks: false,
                internalWhere: { _id: { $in: ids } }
              }

        if (ids.length === 0) {
          return callback(null, normalized)
        }

        Account.aclLoad(principal, opts, function(err, list) {

          if (err) {
            const fault = Fault.create('cortex.error.unspecified', { reason: 'accounts could not be loaded for validation' })
            fault.add(Fault.from(err))
            return callback(fault)
          }
          if (list.hasMore) {
            return callback(Fault.create('cortex.tooLarge.connectionTargets'))
          }

          const nameAccessRequired = Account.schema.node.properties.name.readAccess || acl.AccessLevels.Connected,
                bad = []

          list.data.forEach(function(account) {

            const entry = _.find(normalized, function(entry) {
              return entry && utils.equalIds(account._id, entry._id)
            })
            if (entry) {
              entry.validated = true
              // add the real account name if the principal has enough access to those properties.
              if (!entry.name) {
                const ac = new acl.AccessContext(principal, account)
                if (!skipAcl && ac.hasAccess(nameAccessRequired)) {
                  entry.name = ConnectionsModule._getConnectionName(account.name)
                }
              }
            }
          })

          // cleanup. if any entries still are not validated, error out.
          for (let i = 0; i < normalized.length; i++) {
            if (!normalized[i].validated) {
              bad.push(normalized[i]._id)
            }
            delete normalized[i].validated
          }
          if (bad.length > 0) {
            return callback(Fault.create('cortex.notFound.account', { path: bad.join(', ') }))
          }
          callback(null, normalized)

        })

      })

    })

  }

}

module.exports = new ConnectionsModule()
