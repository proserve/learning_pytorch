'use strict'

const util = require('util'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      modules = require('../../../../modules'),
      AccessPrincipal = require('../../../../access-principal'),
      utils = require('../../../../utils'),
      acl = require('../../../../acl'),
      async = require('async'),
      consts = require('../../../../consts'),
      config = require('cortex-service/lib/config'),
      ModelDefinition = require('../model-definition'),
      UnhandledResult = require('../classes/unhandled-result')

function ConnectionDefinition() {

  this._id = ConnectionDefinition.statics._id
  this.objectId = ConnectionDefinition.statics.objectId
  this.objectLabel = ConnectionDefinition.statics.objectLabel
  this.objectName = ConnectionDefinition.statics.objectName
  this.pluralName = ConnectionDefinition.statics.pluralName

  const options = {

    label: 'Connection',
    name: 'connection',
    _id: consts.NativeObjects.connection,
    pluralName: 'connections',
    properties: [
      {
        label: 'Id',
        name: '_id',
        type: 'ObjectId',
        auto: true,
        readable: true,
        nativeIndex: true
      },
      {
        label: 'Active',
        // description: 'True when active. Used for unique index. Not visible to the public.',
        name: 'active',
        type: 'Document',
        public: false,
        readable: false,
        properties: [{
          label: 'Context',
          name: 'context',
          type: 'ObjectId',
          public: false,
          readable: false
        }, {
          label: 'Account',
          name: 'account',
          type: 'ObjectId',
          public: false,
          readable: false
        }]
      },
      {
        label: 'Object',
        name: 'object',
        type: 'String',
        virtual: true,
        reader: function(ac, node) {
          return node.root.objectName
        }
      },
      {
        label: 'Org',
        name: 'org',
        type: 'ObjectId',
        public: false,
        readable: false,
        validators: [{
          name: 'required'
        }]
      },
      {
        label: 'Application Client',
        name: 'appClientId',
        type: 'ObjectId',
        // description: 'The application client used to create the connection.',
        public: false,
        readable: false
      },
      {
        label: 'Creator',
        // description: 'The account id of the connection creator. Expansion paths are fixed at name an image; The caller can only retrieve the ' +
        //    'connection creator\'s name and profile image.',
        name: 'creator',
        type: 'Reference',
        expandable: true,
        sourceObject: 'account',
        nativeIndex: true,
        grant: acl.AccessLevels.Read,
        paths: ['name', 'image']
      },
      {
        label: 'Created',
        // description: 'The date the connection was initiated',
        name: 'created',
        nativeIndex: true,
        type: 'Date'
      },
      {
        label: 'Target',
        name: 'target',
        // description: 'The connection target recipient. The email property will only be present if the connection was created using an email address. Conversely, ' +
        //    'the account property will only be present if the connection was created using an account id. The name property will only be present if the connection creator added one.',
        type: 'Document',
        properties: [
          {
            label: 'Email',
            name: 'email',
            type: 'String'
          },
          {
            label: 'Account',
            name: 'account',
            type: 'Reference',
            expandable: true,
            sourceObject: 'account',
            grant: acl.AccessLevels.Public,
            dependencies: ['target.email', 'target.account', 'state'],
            nativeIndex: true,
            readerSearchOverride: true,
            reader: function(ac) {

              // don't allow anything that started with an email to be read by anyone but the target.
              if (this.state !== consts.connectionStates.active) {
                let email = utils.path(this, 'target.email')
                if (email) {
                  if (ac.principal.email !== email && !utils.equalIds(ac.principalId, utils.path(this, 'target.account._id'))) {
                    return undefined
                  }
                }
              }

              // tell the default reader to continue as usual
              return new UnhandledResult(utils.path(this, 'target.account'))
            }
          },
          {
            label: 'Name',
            name: 'name',
            type: 'Document',
            properties: [
              {
                label: 'First',
                name: 'first',
                type: 'String'
              },
              {
                label: 'Last',
                name: 'last',
                type: 'String'
              }
            ]
          }
        ]
      },
      {
        label: 'State',
        // description: 'The connection state (Pending: 0, Active: 1).',
        name: 'state',
        type: 'Number',
        nativeIndex: true,
        validators: [{
          name: 'numberEnum',
          definition: {
            values: _.values(consts.connectionStates)
          }
        }]
      },
      {
        label: 'Context',
        name: 'context',
        // description: 'The connection context. When expanded, imparts the connection's access and roles to the caller.',
        type: 'Reference',
        expandable: true,
        nativeIndex: true,
        objectIndexed: true,
        dependencies: ['access', 'target', 'state', 'token', 'roles'],
        onCreateExpansion: function(ac, node, pointer) {

          if (
          // anonymous link
            this.isLink() ||

                        // caller is target
                        utils.equalIds(ac.principalId, utils.path(this, 'target.account._id')) ||

                        // using token (anonymously or otherwise)
                        (ac.req && ac.req.method === 'GET' && ~_.values(ac.req.params || {}).indexOf(this.token))
          ) {
            pointer.grant = Math.max(pointer.grant, this.access)
            pointer.roles = utils.idArrayUnion(pointer.roles, this.roles)
          }

          return pointer

        }
      },
      {
        label: 'Context source',
        name: 'contextSource',
        default: null,
        // description: 'A dot syntax property path context in the invitation context. For example, when the account property of the Patient File is set, the resulting Connection "contextSource" is set to "account". This enables clients to discern the nature of the Connection. In the case of Patient File, "account" means the target is being asked to act as the patient.',
        type: 'String'
      },
      {
        label: 'Token',
        name: 'token',
        // description: 'The connection token, only visible to the target.',
        type: 'String',
        dependencies: ['target', 'state'],
        reader: function(ac) {

          // anonymous link?
          if (this.isLink()) {
            return this.token
          }

          if (this.token && ((ac.principal.email === utils.path(this, 'target.email')) || (utils.equalIds(ac.principalId, utils.path(this, 'target.account._id'))))) {
            return this.token
          }
          return undefined
        }
      },
      {
        label: 'Expires At',
        name: 'expiresAt',
        // description: 'For pending/link connections. the time at which the connection request will expire.',
        type: 'Date'
      },
      {
        label: 'Access',
        name: 'access',
        // description: 'The access level granted by the connection.',
        type: 'Number',
        nativeIndex: true
      },
      {
        label: 'Roles',
        name: 'roles',
        // description: 'The instance roles granted by the connection.',
        type: 'ObjectId',
        array: true,
        nativeIndex: true
      },
      {
        label: 'Uses Remaining',
        name: 'usesRemaining',
        // description: 'the number of times the connection can be loaded via token before it expires. This is only really useful for links',
        type: 'Number'
      }
    ]

  }

  ModelDefinition.call(this, options)
}
util.inherits(ConnectionDefinition, ModelDefinition)

ConnectionDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = ConnectionDefinition.statics
  options.methods = ConnectionDefinition.methods
  options.indexes = ConnectionDefinition.indexes
  options.options = utils.extend({
    versionKey: 'sequence'
  }, options.options)

  return ModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

ConnectionDefinition.methods = {

  isLink: function() {

    const target = (this.target ? this.target.toObject() : null)
    return this.token && this.state === consts.connectionStates.active && (!target || (!target.email && Object.keys(target.account || {}).length === 0 && Object.keys(target.name || {}).length === 0))
  },

  /**
     *
     * @param ac
     * @param options
     *  forceAuto
     * @param callback
     */
  sendConnectionNotification: function(ac, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    const connection = this,
          Connection = this.constructor

    Connection._getTargetPrincipal(
      ac.org,
      Connection._createTarget(
        ac.org,
        null,
        ac.object,
        {
          access: connection.access,
          roles: connection.roles,
          _id: utils.path(connection, 'target.account._id'),
          email: utils.path(connection, 'target.email')
        },
        options.forceAuto
      ),
      function(err, targetPrincipal) {

        if (err) {
          return callback(err)
        }

        let notification,
            payload = {
              account: targetPrincipal || { email: utils.path(connection, 'target.email') },
              context: {
                object: utils.path(connection, 'context.object'),
                _id: utils.path(connection, 'context._id')
              },
              principal: targetPrincipal || ac.principal._id, // @todo. enough access to render names is required.
              variables: {
                connection: connection._id
              },
              access: connection.access,
              roles: connection.roles
            }

        if (connection.access === acl.AccessLevels.None && ac.objectName === 'org') {
          notification = 'OrgInvitation'
        } else if (options.auto) {
          notification = 'ConnectionCreated'
        } else if (targetPrincipal) {
          notification = 'InviteExistingUser'
        } else {
          notification = 'InviteNewUser'
        }

        ac.org.sendNotification(notification, payload)
        callback()

      })

  },

  /**
     *
     * @param ac
     * @param {object|function=} options
     *  skipAcl = false
     * @param {function=} callback
     * @returns {*}
     */
  removeConnection: function(ac, options, callback) {

    if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

    if (!ac.inAuthScope(`object.delete.connection.${this._id}`)) {
      return callback(Fault.create('cortex.accessDenied.scope', { path: `object.delete.connection.${this._id}` }))
    }

    if (!(this.isSelected('state') && this.isSelected('access') && this.isSelected('roles') && this.isSelected('context') && this.isSelected('target'))) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'cannot remove connection without state, access, roles, context and target' }))
    }

    const isTarget = utils.equalIds(ac.principalId, utils.path(this, 'target.account._id')),
          isCreator = utils.equalIds(ac.principalId, utils.path(this, 'creator._id')),
          canShare = ac.hasAccess(acl.AccessLevels.Share),
          isConnected = ac.hasAccess(acl.AccessLevels.Connected),
          isActive = this.state === consts.connectionStates.active,
          isLink = this.isLink(),
          skipAcl = utils.rBool(options.skipAcl, false) || ac.principal.skipAcl

    if (!skipAcl && !(canShare || isTarget || isCreator || (isActive && isConnected))) {
      return callback(Fault.create('cortex.accessDenied.connection', { reason: 'connection ' + this._id + ' is not accessible.' }))
    }
    if (!skipAcl && !canShare && isActive && !isTarget) {
      return callback(Fault.create('cortex.accessDenied.shareAccess'))
    }
    if (!!skipAcl && isLink && !isCreator) {
      return callback(Fault.create('cortex.accessDenied.connection', { reason: 'Only the link creator can remove the connection.' }))
    }

    if (isActive && !isLink) {

      const connection = this

      async.waterfall([

        // ensure the caller has enough access to remove the target
        function(callback) {
          AccessPrincipal.create(ac.org, utils.path(connection, 'target.account._id'), function(err, kicked) {
            if (!err && !isTarget && !skipAcl) {
              const kickedAccess = ac.resolveAccess({ principal: kicked })
              if (kickedAccess.resolved >= ac.resolved) {
                err = Fault.create('cortex.accessDenied.connection', { reason: 'not enough access to remove the connection.' })
              }
            }
            callback(err, kicked)
          })
        },

        // remove access.
        // @todo. we need some kind of transaction here. weird things can happen!
        function(kicked, callback) {

          connection.remove(function(err) {

            let fault
            if (err) {
              fault = Fault.create('cortex.error.unspecified', { reason: 'connection failed to delete.' })
              fault.add(Fault.from(err))
              return callback(fault)
            }

            function removeAccess(ac, connection, callback) {
              acl.AclOperation.setAccessLevel(ac.principal, ac.subject, acl.AccessLevels.None, [], function(err, updated, oldAccess, newAccess, oldRoles, newRoles) {
                let fault
                if (err) {
                  fault = Fault.create('cortex.error.unspecified', { reason: 'connection removal failed to update context acl.' })
                  fault.add(Fault.from(err))
                  return callback(fault)
                } else {
                  if (!err && updated && oldAccess !== newAccess) {
                    if (utils.path(ac, 'object.auditing.enabled')) {
                      modules.audit.recordEvent(ac, ac.object.auditing.category, 'access', { metadata: { principal: ac.principal._id, connection: connection && connection._id, oldAccess, newAccess, oldRoles, newRoles } })
                    }
                  }
                  const hookVars = {
                    ac: ac,
                    connection: connection
                  }
                  ac.object.fireHook('connection.removed.after', null, hookVars, function() {
                    // ignore errors in here.
                    connection.aclRead(new acl.AccessContext(ac.principal, ac.subject, { grant: acl.AccessLevels.Read }), function(err, json) {
                      if (err) return callback()
                      modules.sandbox.triggerScript('connection.removed.after', ac.script, ac, null, { connection: json }, function() {
                        callback()
                      })
                    })
                  })
                }
              })
            }

            // remove the kicked principal's access to the subject.
            removeAccess(new acl.AccessContext(kicked, ac.subject), connection, function(err) {

              if (err || ac.objectName !== 'account') {
                return callback(err)
              }

              // for accounts, remove the connection the other way. (the principal will be the context and the subject will be the target
              async.waterfall([
                function(callback) {
                  AccessPrincipal.create(ac.org, ac.subject, callback)
                },
                function(subjectPrincipal, callback) {
                  connection.constructor.findOneAndRemove({ 'active.context': connection.active.account, 'active.account': connection.active.context, 'context.object': ac.objectName }, function(err, subjectConnection) {
                    callback(err, subjectPrincipal, subjectConnection)
                  })
                },
                function(subjectPrincipal, subjectConnection) {
                  ac.object.getAccessContext(subjectPrincipal, kicked._id, function(err, subjectAc) {
                    if (err) callback(err)
                    else {
                      removeAccess(subjectAc, subjectConnection, callback)
                    }
                  })
                }
              ], callback)

            })

          })

        }

      ], callback)

    } else {

      this.remove(function(err) {
        let fault
        if (err) {
          fault = Fault.create('cortex.error.unspecified', { reason: 'connection failed to delete.' })
          fault.add(Fault.from(err))
        }
        callback(fault)
      })

    }

  }

}

ConnectionDefinition.statics = {

  _id: consts.NativeObjects.connection,
  objectId: consts.NativeObjects.connection,
  objectLabel: 'Connection',
  objectName: 'connection',
  pluralName: 'connections',
  requiredAclPaths: ['_id', 'org', 'object', 'sequence', 'access', 'state', 'roles'],

  _createTarget: function(org, callerAc, object, input, forceAuto) {

    const computed = object.computeShareAccessLevel(org, callerAc, utils.path(input, 'access'), utils.path(input, 'roles')),
          access = computed[0],
          roles = computed[1],
          target = {
            access: access,
            roles: roles,
            name: {
              first: utils.rString(utils.path(input, 'name.first'), ''),
              last: utils.rString(utils.path(input, 'name.last'), '')
            }
          }

    let email, _id = utils.getIdOrNull(utils.path(input, '_id'))
    if (utils.path(input, '_id') && !_id) {
      throw Fault.create('cortex.invalidArgument.connectionTarget', { reason: 'target _id must be a valid ObjectId. "' + utils.path(input, '_id') + '" is invalid' })
    }

    if (_id) {
      target._id = _id
    } else {
      email = utils.rString(utils.path(input, 'email'), '').trim().toLowerCase()
      if (!modules.validation.isEmail(email)) {
        throw Fault.create('cortex.invalidArgument.connectionTarget', { reason: 'if no _id is used, the target account must contain a valid email address. "' + email + '" is invalid' })
      }
      target.email = email
    }

    target.auto = !!(utils.path(input, 'auto') && (forceAuto || !object.connectionOptions.requireAccept)) // safety check.

    return target

  },

  // @todo here's where we need that transaction.
  // @todo how do we guarantee we got the latest?
  _syncAcl: function(ac, connection, targetPrincipal, callback) {

    callback = utils.ensureCallback(callback)
    this.findOne({ 'active.context': ac.subjectId, 'active.account': targetPrincipal._id, 'context.object': ac.objectName }).select(this.requiredAclPaths.join(' ')).exec(function(err, doc) {
      if (!err && !doc) {
        err = Fault.create('cortex.notFound.unspecified', { reason: 'active connection for ' + targetPrincipal._id + ' -> ' + ac.subjectId + ' (' + ac.objectName + ') is missing' })
      }
      if (err) {
        return callback(err)
      }
      acl.AclOperation.setAccessLevel(targetPrincipal, ac.subject, doc.access, doc.roles, function(err, updated, oldAccess, newAccess, oldRoles, newRoles) {
        if (!err && updated && oldAccess !== newAccess) {
          if (utils.path(ac, 'object.auditing.enabled')) {
            modules.audit.recordEvent(ac, ac.object.auditing.category, 'access', { metadata: { principal: targetPrincipal._id, connection: connection && connection._id, oldAccess, newAccess, oldRoles, newRoles } })
          }
        }
        callback(err)
      })
    })

  },

  _createExpiry: function(ac) {

    // days between 1 and 90. default 7
    const days = Math.max(Math.min(utils.rInt(utils.path(ac, 'org.configuration.pendingConnectionExpiry'), 7), 90), 1)
    return new Date(Date.now() + (days * 86400 * 1000))

  },

  _getTargetPrincipal: function(org, target, callback) {

    const Account = modules.db.models.Account,
          find = { org: org._id, object: 'account', [target.email ? 'email' : '_id']: target.email || target._id }

    Account.findOne(find).select(Account.requiredAclPaths.join(' ')).exec(function(err, account) {
      if (!err && !account && target._id) {
        err = Fault.create('cortex.notFound.unspecified', { reason: 'account target not found. _id: ' + target._id })
      }
      callback(err, (err || !account) ? null : new AccessPrincipal(org, account))
    })

  },

  _doApply: function(targetPrincipal, originalConnection, ac, callback) {

    const Connection = this

    if (originalConnection.isLink()) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'links cannot be applied' }))
    }

    // attempt to the set the pending connection to be active. if it fails with duplicate key, it means there's already an active connection. in that case,
    // attempt to upgrade an existing connection.
    originalConnection.increment()
    originalConnection.active = {
      context: ac.subjectId,
      account: targetPrincipal._id
    }
    originalConnection.state = consts.connectionStates.active
    originalConnection.token = undefined
    originalConnection.expiresAt = undefined

    modules.db.sequencedFunction(function(callback) {
      ac.lowLevelUpdate({ subject: originalConnection }, callback)
    }, 10, function(err) {
      err = Fault.from(err)
      if (err && err.errCode === 'cortex.conflict.duplicateKey') {

        const find = {
                'active.account': targetPrincipal._id,
                'active.context': ac.subjectId
              },
              update = {
                $max: {
                  access: originalConnection.access
                },
                $addToSet: {
                  roles: originalConnection.roles
                }
              }

        Connection.findOneAndUpdate(find, update, { returnDocument: 'after' }, function(err, activeConnection) {
          if (!err) {
            if (activeConnection) {
              Connection._syncAcl(ac, activeConnection, targetPrincipal, function(err) {
                if (err) logger.error('Connection._syncAcl', utils.toJSON(err, { stack: true }))
                return callback(null, activeConnection)
              })
            } else {
              err = Fault.create('cortex.error.unspecified', { reason: 'failed to create connection' })
            }
          }
          callback(err, activeConnection)

        })
      } else {

        Connection._syncAcl(ac, originalConnection, targetPrincipal, function(err) {
          if (err) logger.error('Connection._syncAcl', utils.toJSON(err, { stack: true }))
          callback(err, originalConnection)
        })

      }

    })

  },

  _applyReverseAccountConnection: function(targetPrincipal, originalConnection, activeConnection, ac, callback) {

    const Connection = this

    async.waterfall([
      function(callback) {
        AccessPrincipal.create(ac.org, ac.subject, callback)
      },
      function(subjectPrincipal, callback) {

        // already active?
        const find = {
                'active.account': subjectPrincipal._id,
                'active.context': targetPrincipal._id,
                'context.object': 'account'
              },
              update = {
                $max: {
                  access: originalConnection.access
                },
                $addToSet: {
                  roles: originalConnection.roles
                },
                $setOnInsert: {
                  org: ac.orgId,
                  active: {
                    context: targetPrincipal._id,
                    account: subjectPrincipal._id
                  },
                  created: new Date(),
                  state: consts.connectionStates.active,
                  context: {
                    _id: targetPrincipal._id,
                    object: 'account'
                  },
                  creator: { _id: targetPrincipal._id },
                  target: {
                    account: {
                      _id: subjectPrincipal._id
                    }
                  }
                }
              }

        Connection.findOneAndUpdate(find, update, { upsert: true, returnDocument: 'after' }, function(err, activeSubjectConnection) {
          if (!err) {
            if (!activeSubjectConnection) {
              let fault
              if (err) {
                fault = Fault.create('cortex.error.unspecified', { reason: 'failed to create subject account connection.' })
                fault.add(Fault.from(err))
              }
              err = fault
            }
          }
          if (err) {
            return callback(err)
          }
          ac.object.getAccessContext(subjectPrincipal, targetPrincipal._id, function(err, subjectAc) {
            if (err) {
              const fault = Fault.create('cortex.error.unspecified', { reason: 'failed to create subject account connection.' })
              fault.add(Fault.from(err))
              logger.error('Connection.applyToken', utils.toJSON(fault, { stack: true }))
            }
            Connection._syncAcl(subjectAc, activeSubjectConnection, subjectPrincipal, function(err) {
              if (err) logger.error('Connection.applyToken', utils.toJSON(err, { stack: true }))
              // cleanup any reverse pending connections
              // @todo implement for roles.
              if (ac.objectName === 'account') {
                Connection.deleteMany({
                  org: targetPrincipal.orgId,
                  state: consts.connectionStates.pending,
                  $or: [
                    { 'target.email': subjectPrincipal.email },
                    { 'target.account._id': subjectPrincipal._id }
                  ],
                  'context._id': targetPrincipal._id,
                  access: { $lte: activeConnection.access }
                }, function(err) {
                  if (err) logger.error('error cleaning up reverse account invitation', utils.toJSON(err, { stack: true }))
                })
              }
              callback(null, originalConnection, activeSubjectConnection, ac)
            })

          })
        })
      }
    ], callback)

  },

  /**
     *
     * @param targetPrincipal
     * @param token
     * @param {(object|function)=} options
     *      skipAccountTest: load the account and check for existence and state
     *      req: null
     * @param {function=} callback err, activeConnection, ac
     */
  applyToken: function(targetPrincipal, token, options, callback) {

    if (!targetPrincipal.isAuthenticated()) {
      return callback(Fault.create('cortex.accessDenied.notLoggedIn', { reason: 'cannot apply connection token without an authenticated targetPrincipal.' }))
    }

    if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

    options = utils.extend({
      skipAccountTest: false,
      org: null,
      req: null,
      script: null,
      json: false
    }, options)

    const Connection = this

    async.waterfall([

      // load
      function(callback) {
        Connection.loadConnectionByToken(targetPrincipal, token, options, callback)
      },

      // apply connection
      function(connection, ac, callback) {

        if (!ac.inAuthScope(`object.update.connection.${connection._id}`)) {
          return callback(Fault.create('cortex.accessDenied.scope', { path: `object.update.connection.${connection._id}` }))
        }

        Connection._doApply(targetPrincipal, connection, ac, function(err, activeConnection) {
          callback(err, connection, activeConnection, ac)
        })

      },

      // apply to account in the other direction.
      function(originalConnection, activeConnection, ac, callback) {

        if (ac.objectName !== 'account') {
          return callback(null, originalConnection, activeConnection, ac)
        }

        Connection._applyReverseAccountConnection(targetPrincipal, originalConnection, activeConnection, ac, callback)

      },

      // fire hooks.
      function(originalConnection, activeConnection, ac, callback) {
        ac.object.fireHook('connection.after', null, { ac: ac, original: originalConnection, connection: activeConnection }, function(err) {
          callback(err, activeConnection, ac)
        })
      },

      function(activeConnection, ac, callback) {
        activeConnection.aclRead(new acl.AccessContext(ac.principal, ac.subject, { grant: acl.AccessLevels.Read }), function(err, json) {
          callback(err, activeConnection, json, ac)
        })
      },

      function(activeConnection, json, ac, callback) {
        modules.sandbox.triggerScript('connection.after', ac.script, ac, null, { connection: json }, function(err) {
          callback(err, activeConnection, json, ac)
        })
      },

      // clear up pending invitations with <= access to the same context.
      // @todo apply for roles.
      function(activeConnection, json, ac, callback) {

        Connection.deleteMany({
          org: targetPrincipal.orgId,
          state: consts.connectionStates.pending,
          $or: [
            { 'target.email': targetPrincipal.email },
            { token: token },
            { 'target.account._id': targetPrincipal._id }
          ],
          'context._id': ac.subjectId,
          access: { $lte: activeConnection.access }
        }, function(err) {
          if (err) logger.error('error cleaning up invitations', utils.toJSON(err, { stack: true }))
        })

        callback(null, json, ac)

      }

    ], callback)

  },

  listConnections: function(principal, options, callback) {

    options = {
      req: utils.path(options, 'req'),
      startingAfter: utils.path(options, 'startingAfter'),
      endingBefore: utils.path(options, 'endingBefore'),
      limit: utils.queryLimit(utils.path(options, 'limit'), utils.path(options, 'script')),
      paths: utils.path(options, 'paths'),
      include: utils.path(options, 'include'),
      expand: utils.path(options, 'expand'),
      where: utils.path(options, 'where'),
      map: utils.path(options, 'map'),
      group: utils.path(options, 'group'),
      sort: utils.path(options, 'sort'),
      skip: utils.path(options, 'skip'),
      show: utils.path(options, 'show'),
      skipAcl: utils.path(options, 'skipAcl'),
      state: utils.path(options, 'state'),
      objects: utils.path(options, 'objects'),
      pipeline: utils.path(options, 'pipeline'),
      script: utils.path(options, 'script'),
      strict: utils.path(options, 'strict'),
      unindexed: utils.path(options, 'unindexed'),
      passive: utils.path(options, 'passive')
    }

    const find = {
            org: principal.orgId
          },
          showable = ['creator', 'target'],
          states = [consts.connectionStates.pending, consts.connectionStates.active]

    if (options.show) {
      if (!~showable.indexOf(options.show)) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'show must be one of ' + showable }))
      }
      switch (options.show) {
        case 'creator':
          find['creator._id'] = principal._id
          break
        case 'target':
          find['target.account._id'] = principal._id
          break
      }
    } else {
      if (!options.skipAcl) {
        find.$or = [{
          'target.account._id': principal._id
        }, {
          'creator._id': principal._id
        }]
      }
    }

    if (options.state !== null && options.state !== undefined) {
      const state = utils.rInt(options.state, -1)
      if (!~states.indexOf(state)) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'state must be one of ' + states }))
      }
      find.state = state
    }

    if (options.objects) {
      const objects = utils.array(options.objects, true)
      for (let i = 0; i < objects.length; i++) {
        let objectName = utils.path(principal.org.findObjectInfo(objects[i]), 'name')
        if (!objectName) {
          objectName = utils.path(modules.db.definitions.getBuiltInObjectDefinition(objects[i]), 'objectName')
        }
        if (!objectName) {
          return callback(Fault.create('cortex.notFound.unspecified', { reason: 'object (' + objects[i] + ') not found for objects argument' }))
        }
        objects[i] = objectName
      }
      find['context.object'] = { $in: objects }
    }

    // if there is any matching occurring against (target.account or targets.account._id), ensure the connection state is active.
    options.parserCreateHook = parser => {
      let added = false
      parser.watchProperties(['target.account', 'target.account._id'], parser => {
        if (!added) {
          added = true
          parser.addRawMatch({
            state: consts.connectionStates.active
          })
        }
      })
    }

    this.nodeList(principal, find, options, callback)

  },

  /**
     * @param principal can be null or anonymous.
     * @param token
     * @param {(object|function)=} options
     *      skipAccountTest load the account and check for existence and state
     *      req: req
     *      script: script
     *      hooks: true connection.before
     * @param {function=} callback err, connection, ac (with granted access)
     */
  loadConnectionByToken: function(principal, token, options, callback) {

    if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

    if (!modules.authentication.isCallbackToken(token, config('connections.tokenLength'))) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid connection token format' }))
    }

    const Connection = this,
          skipAcl = utils.rBool(options.skipAcl, false) || principal.skipAcl,
          skipAccountTest = utils.rBool(options.skipAccountTest, false),
          authenticated = principal.isAuthenticated()

    let isLink = false

    async.waterfall([

      // find the token
      function(callback) {

        Connection.findOne({ org: principal.orgId, token: token }).exec(function(err, connection) {
          let fault
          if (err) {
            fault = Fault.create('cortex.error.unspecified', { reason: 'connection failed to load.' })
            fault.add(Fault.from(err))
            callback(fault)

          } else {

            // link connection?
            isLink = (connection && connection.isLink())
            if (isLink) {
              callback(err, connection)
              return
            }

            if (!connection || connection.state !== consts.connectionStates.pending) {
              callback(Fault.create('cortex.invalidArgument.connectionToken'))
            } else if (!skipAcl && authenticated && (!utils.equalIds(principal._id, utils.path(connection, 'target.account._id')))) {
              callback(Fault.create('cortex.invalidArgument.connectionToken'))
            } else if (!skipAccountTest && authenticated && principal.state !== 'verified') {
              callback(Fault.create('cortex.accessDenied.connectionRequiresVerification'))
            } else {
              callback(err, connection)
            }

          }
        })
      },

      // load object, and load access context
      function(connection, callback) {

        const objectName = utils.path(connection, 'context.object')
        principal.org.createObject(objectName, function(err, object) {
          if (err) {
            return callback(err)
          }
          if (!object.allowConnections) {
            return callback(Fault.create('cortex.accessDenied.connectionsDisabled', { path: object.objectLabel }))
          }
          const contextId = utils.path(connection, 'context._id')
          object.getAccessContext(principal, contextId, { req: options.req }, function(err, ac) {
            if (err && err.code === 'kNotFound') {
              // don't leak the object id!.
              err = Fault.create('cortex.notFound.unspecified', { reason: 'connection ' + token + ' context not found' })
            }
            if (!err) {
              // @test @todo @critical @danger is this dangerous and is it even needed?
              ac.grant = connection.access
            }
            callback(err, connection, ac)
          })

        })
      },

      function(connection, ac, callback) {

        ac.script = options.script

        if (!utils.rBool(options.hooks, true)) {
          return callback(null, connection, ac)
        }

        AccessPrincipal.create(ac.org, utils.path(connection, 'creator._id'), function(err, creator) {

          // a link doesn't fire hooks or care too much about the creator.
          if (isLink) {
            return callback(err, connection, ac)
          }

          if (err) {

            const fault = Fault.create('cortex.error.unspecified', { reason: 'connection creator unavailable.' })
            fault.add(Fault.from(err))
            return callback(fault)
          }

          const hookVars = {
            ac: ac,
            creator: creator,
            connection: connection
          }

          ac.object.fireHook('connection.before', null, hookVars, function(err) {
            callback(err, connection, ac)
          })

        })

      },

      function(connection, ac, callback) {

        connection.aclRead(new acl.AccessContext(ac.principal, ac.subject, { grant: acl.AccessLevels.Read }), function(err, json) {
          if (err) {
            return callback(err)
          }
          modules.sandbox.triggerScript('connection.before', ac.script, ac, null, { connection: json }, function(err) {
            callback(err, connection, ac)
          })
        })

      },

      function(connection, ac, callback) {

        if (!utils.rBool(options.json, true)) {
          return callback(null, connection, connection, ac)
        }

        const listOpts = {
          req: options.req,
          paths: options.paths,
          singlePath: options.singlePath,
          include: options.include,
          expand: options.expand,
          passive: options.passive,
          document: connection
        }
        Connection.nodeList(principal, {}, listOpts, function(err, doc) {
          callback(err, connection, doc, ac)
        })
      },

      function(connection, doc, ac, callback) {

        if (connection.isLink() && utils.isInt(connection.usesRemaining)) {
          doc.usesRemaining = connection.usesRemaining = Math.max(connection.usesRemaining - 1, 0)
          if (connection.usesRemaining === 0) {
            connection.remove(() => {})
          } else {
            Connection.findOneAndUpdate({ _id: connection._id }, { $inc: { usesRemaining: -1 } }, { writeConcern: { w: 'majority' } }, () => {})
          }
        }
        callback(null, doc, ac)

      }

    ], callback)

  },

  getConnectionToken: function(principal, connectionId, callback) {

    connectionId = utils.getIdOrNull(connectionId)
    if (!connectionId) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'incorrect connectionId format' }))
    }

    if (!modules.authentication.authInScope(principal.scope, `object.read.connection.${connectionId}`)) {
      return callback(Fault.create('cortex.accessDenied.scope', { path: `object.read.connection.${connectionId}` }))
    }

    this.findOne({ _id: connectionId, org: principal.orgId }).lean().select('token').exec(function(err, connection) {
      if (!err && !connection) {
        err = Fault.create('cortex.notFound.unspecified', { reason: 'connection ' + connectionId + ' not found.' })
      }
      callback(err, connection.token)
    })

  },

  /**
     *
     * the connection is viewable when:
     *  the caller is the target (in either state)
     *  the caller is the creator (in either state)
     *  the caller has share access (in either state)
     *  the caller has connected access and the state is active
     *
     * @param principal
     * @param connectionId
     * @param options
     req: null
     script: null
     paths: null
     singlePath: null
     include: null
     expand: null
     skipAcl: false.
     includeKey: false. if true, includes the app client key used to create the connection.
     includeUrl: false, if true, includes a url to the connection processor.
     includeToken: false. if true, includes the token.
     json: true
     * @param callback
     * @returns {*}
     */
  loadConnection: function(principal, connectionId, options, callback) {

    connectionId = utils.getIdOrNull(connectionId)
    if (!connectionId) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'incorrect connectionId format' }))
    }

    if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

    const Connection = this

    async.waterfall([

      // load connection
      function(callback) {
        Connection.findOne({ _id: connectionId, org: principal.orgId }).exec(function(err, connection) {
          if (!err && !connection) {
            err = Fault.create('cortex.notFound.unspecified', { reason: 'connection ' + connectionId + ' not found.' })
          }
          callback(err, connection)
        })
      },

      // load object, and load access context
      function(connection, callback) {

        const objectName = utils.path(connection, 'context.object')
        principal.org.createObject(objectName, function(err, object) {
          if (err) {
            return callback(err)
          }
          if (!object.allowConnections) {
            return callback(Fault.create('cortex.accessDenied.connectionsDisabled', { path: object.objectLabel }))
          }
          const contextId = utils.path(connection, 'context._id')
          object.getAccessContext(principal, contextId, function(err, ac) {
            if (err && err.code === 'kNotFound') {
              // don't leak the object id!.
              err = Fault.create('cortex.notFound.unspecified', { reason: 'connection ' + connectionId + ' context not found' })
            }
            callback(err, connection, ac)
          })
        })
      },

      // ensure the caller has the correct level of access.
      function(connection, ac, callback) {

        ac.script = options.script

        const skipAcl = utils.rBool(options.skipAcl, false) || ac.principal.skipAcl,
              isTarget = utils.equalIds(ac.principalId, utils.path(connection, 'target.account._id')),
              isCreator = utils.equalIds(ac.principalId, utils.path(connection, 'creator._id')),
              canShare = ac.hasAccess(acl.AccessLevels.Share),
              isConnected = ac.hasAccess(acl.AccessLevels.Connected),
              isActive = connection.state === consts.connectionStates.active,
              listOpts = {
                req: options.req,
                paths: options.paths,
                singlePath: options.singlePath,
                include: options.include,
                expand: options.expand,
                passive: options.passive,
                document: connection
              }

        if (!skipAcl && !(canShare || isTarget || isCreator || (isActive && isConnected))) {
          return callback(Fault.create('cortex.accessDenied.connection', { reason: 'connection ' + connectionId + ' is not accessible.' }))
        }

        if (!utils.rBool(options.json, true)) {
          return callback(null, connection, ac)
        }

        Connection.nodeList(principal, {}, listOpts, function(err, doc) {

          if (!err && doc && connection.appClientId && (options.includeKey || options.includeUrl || options.includeToken)) {

            let appKey
            utils.array(ac.org.apps).forEach(function(app) {
              utils.array(app.clients).forEach(function(client) {
                if (utils.equalIds(connection.appClientId, client._id)) {
                  appKey = client.key
                }
              })
            })

            if (options.includeKey && appKey) {
              doc.appKey = appKey
            }

            if (options.includeUrl && connection.token) {
              doc.url = ac.org.generateEmailUrl('connection', connection.token, appKey)
            }

            if (options.includeToken && connection.token) {
              doc.token = connection.token
            }
          }

          callback(err, doc, ac)
        })

      }

    ], function(err, doc, ac) {
      callback(err, doc, ac)
    })

  },

  _createSilentConnection: function(ac, appClientId, target, options, callback) {

    const Connection = this

    Connection._getTargetPrincipal(ac.org, target, function(err, targetPrincipal) {
      if (!err && !targetPrincipal) {
        err = Fault.create('cortex.notFound.unspecified', { reason: 'Missing connection target account' })
      }
      if (err) {
        return callback(err)
      }

      async.waterfall([

        // if an already active connection exists, silently upgrade the connection, or complain about kConnectionExists.
        function(callback) {

          const find = {
                  'active.account': targetPrincipal._id,
                  'active.context': ac.subjectId
                },
                update = {
                  $max: {
                    access: target.access
                  },
                  $addToSet: {
                    roles: target.roles
                  },
                  $setOnInsert: {
                    org: ac.orgId,
                    created: new Date(),
                    creator: {
                      _id: ac.principalId
                    },
                    target: {
                      account: {
                        _id: targetPrincipal._id
                      },
                      name: target.name
                    },
                    state: consts.connectionStates.active,
                    context: {
                      _id: ac.subjectId,
                      object: ac.objectName
                    },
                    active: {
                      context: ac.subjectId,
                      account: targetPrincipal._id
                    },
                    contextSource: options.contextSource || null
                  }
                }

          if (appClientId) {
            update.$setOnInsert.appClientId = appClientId
          }

          Connection.findOneAndUpdate(find, update, { returnDocument: 'after', upsert: true }, function(err, connection) {

            if (!err) {
              // increased access. sync up the acl and we're done.
              Connection._syncAcl(ac, connection, targetPrincipal, function(err) {
                if (err) logger.error('Connection._syncAcl', utils.toJSON(err, { stack: true }))
                connection.access = target.access
                connection.roles = utils.idArrayUnion(connection.roles, target.roles)
                callback(null, connection, targetPrincipal)
              })
              return
            }
            callback(err, connection, targetPrincipal)

          })

        },

        // unhandled by upgrade. create/update pending connection.
        // if an existing pending connection exists, update it with the new access level. atomicity is not super important here.
        function(connection, targetPrincipal, callback) {

          // apply to account in the other direction.
          if (ac.objectName !== 'account') {
            return callback(null, connection, connection, ac)
          }
          Connection._applyReverseAccountConnection(targetPrincipal, connection, connection, ac, callback)
        },

        // fire hooks.
        function(originalConnection, activeConnection, ac, callback) {
          ac.object.fireHook('connection.after', null, { ac: ac, original: originalConnection, connection: activeConnection }, function(err) {
            callback(err, activeConnection, ac)
          })
        },

        function(activeConnection, ac, callback) {
          activeConnection.aclRead(new acl.AccessContext(ac.principal, ac.subject, { grant: acl.AccessLevels.Read }), function(err, json) {
            callback(err, activeConnection, json, ac)
          })
        },

        function(activeConnection, json, ac, callback) {
          modules.sandbox.triggerScript('connection.after', ac.script, ac, null, { connection: json }, function(err) {
            callback(err, activeConnection, ac)
          })
        },

        // clear up pending invitations with <= access to the same context, and send notifications.
        // @todo: implement for roles.
        function(connection, ac, callback) {

          Connection.deleteMany({
            org: targetPrincipal.orgId,
            state: consts.connectionStates.pending,
            $or: [
              { 'target.email': targetPrincipal.email },
              { 'target.account._id': targetPrincipal._id }
            ],
            'context._id': ac.subjectId,
            access: { $lte: connection.access }
          }, function(err) {
            if (err) logger.error('error cleaning up invitations', utils.toJSON(err, { stack: true }))
          })

          if (utils.rBool(options['sendConnectionNotification'], true) && ac.object.connectionOptions.sendNotifications) {
            try {
              connection.sendConnectionNotification(ac, { auto: true, forceAuto: options.forceAuto })
            } catch (e) {

            }
          }
          callback(null, connection)

        }

      ], function(err, connection) {

        if (err === true) {
          err = null
        }
        callback(err, connection)

      })

    })

  },

  _createConnection: function(ac, appClientId, target, options, callback) {

    const Connection = this

    async.waterfall([

      // load the target principal. if it does not exist, we might still be ok.
      function(callback) {
        Connection._getTargetPrincipal(ac.org, target, callback)
      },

      // if an already active connection exists, silently upgrade the connection, or complain about kConnectionExists.
      function(targetPrincipal, callback) {

        if (!targetPrincipal || utils.rBool(options.force, false)) {
          return callback(null, targetPrincipal)
        }

        const find = {
                'active.account': targetPrincipal._id,
                'active.context': ac.subjectId
              },
              update = {
                $max: {
                  access: target.access
                },
                $addToSet: {
                  roles: target.roles
                }
              }

        Connection.findOneAndUpdate(find, update, { new: false }, function(err, old) {

          if (!err) {
            if (old) { // no doc found is fine. we'll send an invite.
              // no changes? same access?
              if (old.access >= target.access && utils.intersectIdArrays(target.roles, old.roles).length === target.roles.length) {
                return callback(Fault.create('cortex.conflict.connectionExists'))
              } else {
                // increased access. sync up the acl and we're done.
                Connection._syncAcl(ac, old, targetPrincipal, function(err) {
                  if (err) {
                    logger.error('Connection._syncAcl', utils.toJSON(err, { stack: true }))
                  }
                  old.access = target.access
                  old.roles = utils.idArrayUnion(old.roles, target.roles)
                  callback(true, old) // eslint-disable-line standard/no-callback-literal
                })
                return
              }
            }
          }
          callback(err, targetPrincipal)

        })

      },

      // unhandled by upgrade. create/update pending connection.
      // if an existing pending connection exists, update it with the new access level. atomicity is not super important here.
      function(targetPrincipal, callback) {

        const find = {
          org: ac.orgId,
          state: consts.connectionStates.pending,
          'context._id': ac.subjectId,
          'creator._id': ac.principalId
        }
        if (targetPrincipal) {
          find['target.account._id'] = targetPrincipal._id
        } else {
          find['target.email'] = target.email
        }
        Connection.findOne(find).exec(function(err, connection) {
          if (err) {
            return callback(err)
          }
          if (connection && !utils.rBool(options.force, false)) {

            // existing invitation from creator. silently increase access level and bump expiry.
            connection.increment()
            connection.access = Math.max(target.access, connection.access)
            connection.roles = utils.idArrayUnion(connection.roles, target.roles)
            connection.expiresAt = Connection._createExpiry(ac)
            if (target.name.first || target.name.last) {
              utils.path(connection, 'target.name', target.name)
            }
            modules.db.sequencedFunction(function(callback) {
              ac.lowLevelUpdate({ subject: connection }, callback)
            }, 10, function(err) {
              callback(err, targetPrincipal, connection, true)
            })

          } else {

            // create pending connection.
            connection = new Connection()

            if (utils.isId(options.connectionId)) {
              connection._id = options.connectionId
            }

            connection.org = ac.orgId
            connection.created = new Date()
            utils.path(connection, 'creator._id', ac.principalId)
            if (targetPrincipal) {
              utils.path(connection, 'target.account._id', targetPrincipal._id)
            }
            if (target.email) {
              utils.path(connection, 'target.email', target.email)
            }
            utils.path(connection, 'target.name', target.name)
            connection.state = consts.connectionStates.pending
            connection.context = {
              _id: ac.subjectId,
              object: ac.objectName
            }
            connection.expiresAt = Connection._createExpiry(ac)
            connection.access = target.access
            connection.roles = target.roles
            connection.contextSource = options.contextSource || null
            if (appClientId) {
              connection.appClientId = appClientId
            }

            // allow some token retries. it's possible to have duplicates.
            let saveErr, tries = 100
            async.doWhilst(
              function(callback) {
                connection.token = modules.authentication.genAlphaNumString(config('connections.tokenLength'))
                connection.nodeSave(ac, function(err) {
                  saveErr = Fault.from(err)
                  if (saveErr && saveErr.errCode === 'cortex.conflict.duplicateKey') {
                    err = null
                  }
                  callback(err)
                })
              },
              function() {
                return saveErr && (--tries > 0)
              },
              function() {
                callback(saveErr, targetPrincipal, connection, false)
              }
            )
          }
        })

      },

      // send notification.
      function(targetPrincipal, connection, duplicate, callback) {

        // @todo only send duplicate invites after a cooldown?
        if (utils.rBool(options['sendConnectionNotification'], true)) {
          connection.sendConnectionNotification(ac)
        }
        callback(null, connection)

      }

    ], function(err, connection) {

      if (err === true) {
        err = null
      }
      callback(err, connection)

    })

  },

  /**
     *
     * @param ac
     * @param accessLevel
     * @param options
     *  skipShareChain: skips share chain or share acl.
     *  skipAcl: skips share chain or share acl.
     *  expiresInMs
     *  expiresAt
     *  usesRemaining null
     *  roles: roles to assign the target on the instance
     *
     * @param callback -> err, connection
     */
  createLink: function(ac, accessLevel, options, callback) {

    if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

    if (!ac.inAuthScope('object.create.connection')) {
      return callback(Fault.create('cortex.accessDenied.scope', { path: 'object.create.connection' }))
    }

    const computed = ac.object.computeShareAccessLevel(ac.org, (options.skipShareChain || options.skipAcl) ? null : ac, accessLevel, options.roles),
          targetAccess = computed[0],
          targetRoles = computed[1],
          canShare = ac.hasAccess(acl.AccessLevels.Share),
          skipAcl = utils.rBool(options.skipAcl, false) || ac.principal.skipAcl,
          appClientId = options.appClientId || utils.path(ac, 'req.clientId'),
          Connection = this

    if (!skipAcl && !canShare) {
      return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'not enough access to create link.' }))
    } else if (!appClientId) {
      return callback(Fault.create('cortex.invalidArgument.noConnectionApp'))
    }

    let expiresAt,
        usesRemaining,
        connection,
        saveErr,
        tries = 100

    if (!(options.expiresInMs === null || options.expiresInMs === undefined) || !(options.expiresAt === null || options.expiresAt === undefined)) {
      if (utils.isInteger(options.expiresInMs)) {
        expiresAt = new Date(Date.now() + Math.max(utils.rInt(options.expiresInMs, 0), 0))
      } else if (utils.isInteger(options.expiresAt)) {
        expiresAt = new Date(Math.max(utils.rInt(options.expiresAt, Date.now()), Date.now()))
      } else {
        expiresAt = utils.getValidDate(options.expiresAt)
      }
      if (!utils.isValidDate(expiresAt)) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid expiresInMs/expiresAt argument.' }))
      }
    }

    usesRemaining = utils.isInteger(options.usesRemaining) ? Math.max(Math.min(parseInt(options.usesRemaining), 1000000), 1) : undefined // cap at a reasonable number.

    connection = new Connection({
      org: ac.orgId,
      created: new Date(),
      access: targetAccess,
      roles: targetRoles,
      creator: {
        _id: ac.principalId
      },
      state: consts.connectionStates.active,
      context: {
        _id: ac.subjectId,
        object: ac.objectName
      },
      contextSource: options.contextSource || null,
      appClientId: appClientId || null,
      expiresAt: expiresAt,
      usesRemaining: usesRemaining
    })

    // allow some token retries. it's possible to have duplicates.
    async.doWhilst(
      function(callback) {
        connection.token = modules.authentication.genAlphaNumString(config('connections.tokenLength'))
        connection.nodeSave(ac, function(err) {
          saveErr = Fault.from(err)
          if (saveErr && saveErr.errCode === 'cortex.conflict.duplicateKey') {
            err = null
          }
          callback(err)
        })
      },
      function() {
        return saveErr && (--tries > 0)
      },
      function() {
        callback(saveErr, connection)
      }
    )

  }

}

ConnectionDefinition.indexes = [

  // @HERE modify reads to use org and object.
  // @HERE this is also the shard key for connections.
  [{ org: 1, 'context.object': 1, 'context._id': 1, _id: 1 }, { name: 'idxContext' }],

  [{ 'target.account._id': 1 }, { partialFilterExpression: { 'target.account._id': { $exists: true } }, name: 'idxTargetAccountId' }],

  [{ 'target.email': 1 }, { partialFilterExpression: { 'target.email': { $exists: true } }, name: 'idxTargetEmail' }],

  [{ org: 1, token: 1 }, { unique: true, partialFilterExpression: { 'token': { $exists: true } }, name: 'idxToken' }],

  [{ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'idxExpires' }],

  [{ active: 1 }, { unique: true, partialFilterExpression: { 'active': { $exists: true } }, name: 'idxActive' }]

]

module.exports = ConnectionDefinition
