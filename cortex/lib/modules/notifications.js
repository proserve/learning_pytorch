'use strict'

const Fault = require('cortex-service/lib/fault'),
      _ = require('underscore'),
      utils = require('../utils'),
      consts = require('../consts'),
      modules = require('../modules'),
      ap = require('../access-principal'),
      acl = require('../acl')

function isCustomPayload(name) {
  let allowed = utils.isPlainObject(name) || typeof name !== 'string' || (!utils.isId(name) && !utils.isCustomName(name))
  for (const internalNotification of Object.keys(consts.Notifications.Types)) {
    if (name === consts.Notifications.Types[internalNotification].name || name === internalNotification) {
      allowed = false
      break
    }
  }
  return allowed
}

class NotificationsModule {

  constructor() {
    return NotificationsModule
  }

  static send(ac, name, variables, options, callback) {

    options = _.pick(options || {}, 'number', 'recipient', 'context', 'locale', 'apiKey', 'count', 'sound', 'apnTopics', 'fcmTopic', 'pushType', 'endpoints', 'queue')

    if (isCustomPayload(name)) {
      options = Object.assign(options, variables || {})
      variables = name
      name = options.notification || consts.emptyId
    } else {
      name = String(name).trim()
    }

    variables = variables || {}
    options = options || {}

    // empty name means no use a user-defined notification
    if (!utils.isId(name) && name.indexOf('c_') !== 0 && !~name.indexOf('__')) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Only user-defined notifications can be sent via the scripting interface.' }))
    }

    if (options.recipient) {
      const recipientId = utils.getIdOrNull(options.recipient, true),
            recipientEmail = (!recipientId && modules.validation.isEmail(options.recipient)) ? options.recipient : null

      if (!recipientId && !recipientEmail) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'The notification recipient must be an account _id or email address' }))
      }

      ap.create(ac.org, recipientEmail || recipientId, (err, principal) => {
        _send(err, principal, recipientEmail)
      })

    } else {
      _send(null, ac.principal, null)
    }

    function _send(err, principal, recipientEmail) {
      if (!err) {
        if (utils.inIdArray([acl.AnonymousIdentifier, acl.PublicIdentifier], principal._id)) {
          err = Fault.create('cortex.invalidArgument.unspecified', { reason: 'Anonymous and Org Member cannot receive notifications.' })
        }
      }

      let account = null

      if (err) {
        // allow notifications to non-accounts?
        if (recipientEmail && err.errCode === 'cortex.notFound.account') {
          if (utils.path(ac.org.configuration, 'scripting.enableNonAccountNotifications')) {
            principal = ac.principal
            account = recipientEmail
            err = null
          } else {
            err.reason = 'Notifications can only be sent to account holders.'
          }
        }
      }
      if (err) {
        return callback(err)
      }
      ac.org.sendNotification(name, {
        req: ac.req,
        sender: ac.principal._id,
        principal: principal,
        account: account,
        variables: variables,
        ...options
      }, callback)
    }

  }

  /**
     * notifications
     *
     * @param type
     * @param orgId
     * @param accountId
     * @param objectName
     * @param contextId
     * @param {(object|function)=} options created: an optional created date, duplicate: allow duplicates, meta: metadata
     * @param {function=} callback
     */
  static persist(type, accountId, orgId, objectName, contextId, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    }

    type = utils.getIdOrNull(type)
    if (!type) {
      callback(Fault.create('cortex.invalidArgument.unspecified'), { reason: 'Invalid notification type' })
      return
    }

    orgId = utils.getIdOrNull(orgId)

    const Notification = modules.db.models.notification,
          set = { account: accountId, org: orgId, context: { object: objectName, _id: contextId }, type: type, created: utils.getValidDate(options.created, new Date()) }

    if (options['meta'] != null) {
      set.meta = options['meta']
    }

    if (options['duplicate']) {

      Notification.create(set, callback)
    } else {

      const find = { account: accountId, 'context.object': objectName, 'context._id': contextId, type: type }
      if (options['meta'] != null) find.meta = options['meta']

      Notification.findOneAndUpdate(
        find,
        { $set: set },
        { upsert: true, returnDocument: 'after' },
        callback)
    }
  }

  /**
     *
     * @param accountId
     * @param type
     * @param objectName
     * @param contextId
     * @param created
     * @param {function=} callback
     */
  static acknowledgeOnOrBefore(accountId, type, objectName, contextId, created, callback) {

    const Notification = modules.db.models.notification

    accountId = utils.getIdOrNull(accountId)
    contextId = utils.getIdOrNull(contextId)
    objectName = utils.rString(objectName)

    callback = utils.ensureCallback(callback)
    created = utils.getValidDate(created, new Date())

    let query, ok = accountId && contextId && objectName

    if (ok) {
      query = { account: accountId, 'context.object': objectName, 'context._id': contextId, created: { $lte: created } }
      if (type) {
        type = utils.getIdOrNull(type)
        ok = !!type
        query.type = type
      }
    }
    if (ok) {
      Notification.collection.deleteMany(query, { writeConcern: { w: 'majority' } }, (err, result) => {
        if (err) return callback(err)
        result = result ? result.result : result
        callback(null, result ? result.n : 0)
      })
    } else {
      setImmediate(function() {
        callback(null, 0)
      })
    }

  }

  static acknowledgePostOnOrBefore(principal, postIds, postTypes, created, callback) {

    const Notification = modules.db.models.notification

    let ok = ap.is(principal)

    created = utils.getValidDate(created, new Date())
    callback = utils.ensureCallback(callback)

    if (postIds != null) {
      postIds = utils.getIdArray(postIds)
      ok = postIds.length > 0
    }

    if (ok && postTypes != null) {
      postTypes = utils.array(postTypes, true).filter(function(v) { return _.isString(v) && v.length > 0 })
      ok = postTypes.length > 0
    }

    if (ok) {
      const query = {
        account: principal._id,
        type: consts.Notifications.Types.FeedPostUpdate._id,
        created: { $lte: created }
      }
      if (postTypes || postIds) {
        if (postTypes) query['meta.type'] = { $in: postTypes }
        if (postIds) query['meta.postId'] = { $in: postIds }
      }
      Notification.collection.deleteMany(query, { writeConcern: { w: 'majority' } }, (err, result) => {
        if (err) return callback(err)
        result = result ? result.result : result
        callback(null, result ? result.n : 0)
      })
    } else {
      setImmediate(function() {
        callback(null, 0)
      })
    }
  }

  static acknowledgeCommentOnOrBefore(principal, commentIds, created, callback) {

    const Notification = modules.db.models.notification

    let ok = ap.is(principal)

    created = utils.getValidDate(created, new Date())
    callback = utils.ensureCallback(callback)

    if (ok) {
      commentIds = utils.getIdArray(commentIds)
      ok = commentIds.length > 0
    }

    if (ok) {
      const query = {
        account: principal._id,
        type: consts.Notifications.Types.FeedCommentUpdate._id,
        created: { $lte: created },
        'meta.commentId': { $in: commentIds }
      }
      Notification.collection.deleteMany(query, { writeConcern: { w: 'majority' } }, (err, result) => {
        if (err) return callback(err)
        result = result ? result.result : result
        callback(null, result ? result.n : 0)
      })
    } else {
      setImmediate(function() {
        callback(null, 0)
      })
    }
  }

  /**
     *
     * @param accountId
     * @param type type can be null
     * @param objectName context can be null
     * @param created
     * @param callback
     */
  static acknowledgeAllOnOrBefore(accountId, type, objectName, created, callback) {

    const Notification = modules.db.models.notification

    accountId = utils.getIdOrNull(accountId)
    callback = utils.ensureCallback(callback)

    if (objectName && !(objectName = utils.rString(objectName))) {
      setImmediate(callback, Fault.create('cortex.invalidArgument.unspecified', { path: 'objectName' }))
      return
    }

    let query, ok = !!accountId

    if (ok) {

      created = utils.getValidDate(created, new Date())

      query = { account: accountId, created: { $lte: created } }
      if (objectName) query['context.object'] = objectName
      if (type != null) {
        type = utils.getIdOrNull(type)
        ok = !!type
        query.type = type
      }
    }

    if (ok) {
      Notification.collection.deleteMany(query, { writeConcern: { w: 'majority' } }, (err, result) => {
        if (err) return callback(err)
        result = result ? result.result : result
        callback(null, result ? result.n : 0)
      })
    } else {
      setImmediate(callback, null, 0)
    }

  }

  /**
     * acknowledges a notification by id
     * @param accountId
     * @param notificationId
     * @param callback
     */
  static acknowledgeId(accountId, notificationId, callback) {

    const Notification = modules.db.models.notification,
          _id = utils.getIdOrNull(notificationId),
          account = utils.getIdOrNull(accountId)

    callback = utils.ensureCallback(callback)

    if (_id && account) {
      Notification.collection.deleteMany({ _id: _id, account: account }, { writeConcern: { w: 'majority' } }, (err, result) => {
        if (err) return callback(err)
        result = result ? result.result : result
        callback(null, result ? result.n : 0)
      })
    } else {
      setImmediate(function() {
        callback(null, 0)
      })
    }
  }

}

module.exports = NotificationsModule
