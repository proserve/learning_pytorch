'use strict'

const async = require('async'),
      Fault = require('cortex-service/lib/fault'),
      acl = require('../../../../acl'),
      config = require('cortex-service/lib/config'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      utils = require('../../../../utils')

module.exports = {

  apply: function(script, message, token, options, callback) {

    options = utils.extend(script.allowedOptions(options, 'skipAcl'), {
      req: script.ac.req,
      script
    })

    options = {
      req: script.ac.req,
      script: script,
      skipAcl: utils.path(options, script.allowedOptions('skipAcl'))
    }

    modules.db.models.Connection.applyToken(script.ac.principal, token, options, function(err, json) {
      callback(err, json)

    })
  },

  linkTo: function(script, message, objects, _id, accessLevel, options, callback) {

    options = script.allowedOptions(options, 'skipAcl', 'forceAllowConnections',
      'connectionAppKey', 'expiresInMs', 'accessLevel', 'appClientId',
      'expiresAt', 'usesRemaining', 'roles'
    )

    const skipAccountTest = false

    if (!skipAccountTest && script.ac.principal.state !== consts.accountStates.verified) {
      return callback(Fault.create('cortex.accessDenied.connectionRequiresVerification'))
    }

    async.waterfall([

      // create the object and ensure connections are allowed.
      function(callback) {
        script.ac.org.createObject(objects, function(err, object) {
          if (!err) {
            const allowConnections = object.allowConnections || (object.allowConnectionsOverride && options.forceAllowConnections)
            if (!allowConnections || object.isUnmanaged) {
              err = Fault.create('cortex.accessDenied.connectionsDisabled', { path: object.objectLabel })
            }
          }
          callback(err, object)
        })
      },

      // validate access to the context
      function(object, callback) {

        object.getAccessContext(script.ac.principal, _id, { req: script.ac.req }, function(err, ac) {
          if (!err && !options.skipAcl && !ac.hasAccess(acl.AccessLevels.Share)) {
            err = Fault.create('cortex.accessDenied.shareAccess')
          }
          callback(err, ac)
        })
      },

      // create link
      function(ac, callback) {

        ac.script = script

        // attempt to get an app id.
        let appClientId, connectionAppKey = options.connectionAppKey
        if (!connectionAppKey) {
          connectionAppKey = utils.path(script.ac, 'req.orgClient.key')
        }
        if (connectionAppKey) {
          if (connectionAppKey === config('webApp.apiKey')) {
            appClientId = utils.getIdOrNull(config('webApp.clientId'))
          } else {
            appClientId = utils.array(script.ac.org.apps).reduce(function(_id, app) {
              if (!_id) {
                _id = utils.array(app.clients).reduce(function(_id, client) {
                  if (!_id && client && client.key === connectionAppKey) {
                    _id = client._id
                  }
                  return _id
                }, null)
              }
              return _id
            }, null)
          }
        }

        const connectionOptions = {
          skipAcl: options.skipAcl,
          appClientId: appClientId,
          expiresInMs: options.expiresInMs,
          expiresAt: options.expiresAt,
          usesRemaining: options.usesRemaining,
          roles: options.roles
        }

        modules.db.models.Connection.createLink(ac, accessLevel, connectionOptions, function(err, connection) {
          if (err) {
            callback(err)
          } else {
            connection.aclRead(new acl.AccessContext(script.ac.principal, null, { override: acl.AccessLevels.Read }), function(err, doc) {
              callback(err, doc)
            })
          }
        })

      }

    ], callback)

  },

  create: function(script, message, objects, _id, targets, options, callback) {

    options = script.allowedOptions(options, 'skipAcl', 'forceAllowConnections',
      'connectionAppKey', 'forceAuto', 'skipNotifications', 'skipNotification'
    )

    const skipAccountTest = false,
          skipTargetTest = false // options.skipTargetTest; - turn this off for now.

    if (!skipAccountTest && script.ac.principal.state !== consts.accountStates.verified) {
      return callback(Fault.create('cortex.accessDenied.connectionRequiresVerification'))
    }

    async.waterfall([

      // create the object and ensure connections are allowed.
      function(callback) {
        script.ac.org.createObject(objects, function(err, object) {
          if (!err) {
            const allowConnections = object.allowConnections || (object.allowConnectionsOverride && options.forceAllowConnections)
            if (!allowConnections || object.isUnmanaged) {
              err = Fault.create('cortex.accessDenied.connectionsDisabled', { path: object.objectLabel })
            }
          }
          callback(err, object)
        })
      },

      // validate access to the context
      function(object, callback) {

        object.getAccessContext(script.ac.principal, utils.getIdOrNull(_id), { req: script.ac.req }, function(err, ac) {
          if (!err && !options.skipAcl && !ac.hasAccess(acl.AccessLevels.Share)) {
            err = Fault.create('cortex.accessDenied.shareAccess')
          }
          callback(err, ac)
        })
      },

      // validate targets.
      function(ac, callback) {

        modules.connections.normalizeTargets(ac, targets || [], { skipAcl: options.skipAcl, forceAuto: options.forceAuto, skipTargetTest: skipTargetTest }, function(err, targets) {
          if (!err && targets.length === 0) {
            err = Fault.create('cortex.invalidArgument.noConnectionTargets')
          }
          callback(err, ac, targets)
        })
      },

      // create/upgrade individual connections
      function(ac, targets, callback) {

        ac.script = script

        // attempt to get an app id.
        let appClientId, connectionAppKey = options.connectionAppKey
        if (!connectionAppKey) {
          connectionAppKey = utils.path(script.ac, 'req.orgClient.key')
        }
        if (connectionAppKey) {
          appClientId = utils.array(script.ac.org.apps).reduce(function(_id, app) {
            if (!_id) {
              _id = utils.array(app.clients).reduce(function(_id, client) {
                if (!_id && client && client.key === connectionAppKey) {
                  _id = client._id
                }
                return _id
              }, null)
            }
            return _id
          }, null)
        }

        async.mapLimit(targets, 10, function(target, callback) {

          const connectionOptions = {
            sendConnectionNotification: !utils.rBool(options.skipNotifications, utils.rBool(options.skipNotification, false)),
            appClientId: appClientId,
            forceAuto: !!options.forceAuto
          }

          modules.connections.createConnection(ac, target, connectionOptions, function(err, connection) {
            if (err) {
              var fault = (Fault.from(err) || Fault.create('cortex.error.db', { reason: 'failed to create connection' })).toJSON()
              fault.target = target
              callback(null, fault)
            } else if (connection) {
              connection.aclRead(new acl.AccessContext(script.ac.principal, null, { override: acl.AccessLevels.Read }), function(err, doc) {
                if (err) {
                  const fault = (Fault.from(err) || Fault.create('cortex.error.db', { reason: 'failed to read connection' })).toJSON()
                  fault.target = target
                  fault.connection = connection._id
                  callback(null, fault)
                } else {
                  callback(null, doc)
                }
              })
            } else {
              // here, there was no connection made or found. probably already exists and was silently upgraded.
              callback(null, null)
            }

          })
        }, callback)

      }

    ], callback)

  },

  list: function(script, message, options, callback) {

    // @todo allow explicit from and to without the reader?
    options = utils.extend(script.allowedOptions(options, 'paths', 'include', 'expand', 'skip',
      'limit', 'where', 'map', 'sort', 'group', 'pipeline', 'show', 'state', 'objects', 'strict', 'unindexed', 'skipAcl'
    ), {
      req: script.ac.req,
      script
    })
    options.strict = !(options.strict === false && script.ac.org.configuration.queries.allowParserStrictOption)
    options.unindexed = options.unindexed === true && script.ac.org.configuration.queries.allowUnidexedMatchesOption

    modules.db.models.Connection.listConnections(script.ac.principal, options, function(err, result) {
      callback(err, result)
    })

  },

  getToken: function(script, message, token, callback) {

    modules.db.models.Connection.getConnectionToken(script.ac.principal, token, callback)

  },

  read: function(script, message, tokenOrId, options, callback) {

    options = utils.extend(script.allowedOptions(options, 'paths', 'include', 'expand',
      'includeUrl', 'includeToken', 'includeKey', 'skipAcl', 'skipAccountTest'
    ), {
      req: script.ac.req,
      script
    })

    let token, _id, path, parts

    parts = utils.normalizeObjectPath(String(tokenOrId).replace(/\//g, '.')).split('.')
    path = parts.slice(1).join('.')
    if (utils.couldBeId(parts[0])) {
      _id = utils.getIdOrNull(parts[0])
    } else if (modules.authentication.isCallbackToken(parts[0], config('connections.tokenLength'))) {
      token = parts[0]
    } else {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'ObjectID or Connection token expected' }))
    }

    if (path) {
      options.singlePath = options.paths = path
    }

    async.waterfall([

      function(callback) {
        if (_id) {
          modules.db.models.Connection.loadConnection(script.ac.principal, _id, options, function(err, result) {
            callback(err, result)
          })
        } else {
          modules.db.models.Connection.loadConnectionByToken(script.ac.principal, token, options, function(err, result) {
            callback(err, result)
          })
        }
      },

      function(result, callback) {

        if (path) {
          result = utils.digIntoResolved(result, path)
        }
        callback(null, result)

      }

    ], callback)

  },

  delete: function(script, message, tokenOrId, options, callback) {

    options = utils.extend(script.allowedOptions(options, 'skipAcl'), {
      json: false,
      skipAccountTest: true,
      req: script.ac.req,
      script
    })

    async.waterfall([

      function(callback) {
        if (utils.couldBeId(tokenOrId)) {
          modules.db.models.Connection.loadConnection(script.ac.principal, tokenOrId, options, function(err, result, ac) {
            callback(err, result, ac)
          })
        } else {
          modules.db.models.Connection.loadConnectionByToken(script.ac.principal, tokenOrId, options, function(err, result, ac) {
            callback(err, result, ac)
          })
        }
      },

      function(connection, ac, callback) {
        connection.removeConnection(ac, options, function(err) {
          if (!err) {
            modules.notifications.acknowledgeOnOrBefore(utils.path(connection, 'target.account._id'), consts.Notifications.Types.InviteExistingUser._id, utils.path(connection, 'context.object'), utils.path(connection, 'context._id'), new Date())
          }
          callback(err)
        })
      }

    ], function(err) {

      callback(err)

    })

  }

}
