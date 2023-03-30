'use strict'

const Worker = require('../worker'),
      util = require('util'),
      async = require('async'),
      acl = require('../../../acl'),
      logger = require('cortex-service/lib/logger'),
      Fault = require('cortex-service/lib/fault'),
      _ = require('underscore'),
      config = require('cortex-service/lib/config'),
      consts = require('../../../consts'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      ap = require('../../../access-principal'),
      Account = modules.db.models.Account,
      Notification = modules.db.models.Notification,
      Org = modules.db.models.org,
      nextSmsFrom = (() => {
        const array = utils.array(config('sms.from'), true)
        let index = 0
        return function() {
          if (index >= array.length) index = 0
          return array[index++]
        }
      })()

function NotificationWorker() {

  Worker.call(this)

  this.workers = {
    email: modules.workers.createWorker('emailer'),
    push: modules.workers.createWorker('push'),
    sms: modules.workers.createWorker('sms')
  }

  this.requiredPrincipalPaths = _.uniq(['preferences.notifications', 'locale', 'name'].concat(Object.keys(this.workers).reduce(function(paths, key) {
    return paths.concat(this.workers[key].getRequiredRecipientPrincipalPaths())
  }.bind(this), [])))

}

util.inherits(NotificationWorker, Worker)

/**
 * @param message
 * @param payload a string that revives to the following (see org.sendNotification)
 *      org                         // the org or org id
 *      type                        // the notification type
 *      account                   // an account access subject, principal, accountId, email address, or object containing either an _id or email property. if missing, the principal option is used as the recipient as well as the render target.
 *          _id/email [, [name]
 *      principal                   // id or principal. templates will be rendered using the passed in principal. if missing, uses the account._id. required if account.email is used.
 *      locale                      // the desired notification locale. if not passed, attempts are made to select it from req, then from account, then default to en_US
 *      context                     // an access subject or plain object containing _id and object properties. required for persistent notifications.
 *      meta                        // arbitrary metadata, saved to persistent notifications. be careful to pass only small, plain objects (this is stringified).
 *      req                         // the request or request id. converted to a request id.
 *      created                     // optional created date for persistent notifications.
 *      message                     // optional message. only for endpoints without templates
 * @param options
 *  raiseEndpointErrors: false. if true, raises endpoint errors.
 * @param callback
 * @private
 */
NotificationWorker.prototype._process = function(message, payload, options, callback) {

  const requiredPrincipalPaths = this.requiredPrincipalPaths
  let endpointErrs = []

  async.waterfall([

    // load the org.
    function(callback) {

      Org.loadOrg(payload.org, callback)
    },

    // load the recipient principal.
    function(orgContext, callback) {

      ap.create(orgContext, utils.path(payload, 'account._id') || utils.path(payload, 'account.email'), { include: requiredPrincipalPaths }, function(err, principal) {

        // could be a new user. in this case, allow a null principal.
        if (err && !utils.path(payload, 'account._id') && utils.path(payload, 'account.email')) {
          err = principal = null
        }
        callback(err, orgContext, principal)

      })
    },
    // Load sender principal
    function(orgContext, recpientPrincipal, callback) {
      const sender = utils.path(payload, 'sender')
      if (sender) {
        ap.create(orgContext, sender, { include: requiredPrincipalPaths }, (err, principal) => {
          payload.sender = principal
          if (err) {
            modules.db.models.Log.createLogEntry(new acl.AccessContext(ap.synthesizeOrgAdmin(orgContext)),
              'notification',
              err
            )
            payload.sender = null
          }
          callback(null, orgContext, recpientPrincipal)
        })
      } else {
        callback(null, orgContext, recpientPrincipal)
      }
    },
    // load notification type and active endpoints.
    function(orgContext, recipientPrincipal, callback) {

      let err, notificationType
      try {
        if (utils.equalIds(payload.type, consts.emptyId)) {
          const endpoints = []
          for (const key of Object.keys(consts.Notifications.Endpoints)) {
            const endpoint = utils.path(payload, `endpoints.${key.toLowerCase()}`)
            if (endpoint) {
              endpoints.push(consts.Notifications.Endpoints[key])
            }
          }
          notificationType = {
            endpoints,
            persists: false,
            _id: payload.type
          }
        } else {
          notificationType = Account.schema.node.findNode('preferences.notifications').loadNotification(orgContext, recipientPrincipal ? recipientPrincipal.account : null, payload.type)
        }
      } catch (e) {
        err = e
      }

      // determine which sms number to use, if any, for sms endpoints.
      if (!err) {

        let endpoint,
            len = notificationType.endpoints.length,
            isInternal = !!consts.Notifications.TypeMap[notificationType._id],
            allowInternalOverCustom = orgContext.configuration.sms.internalOverCustom,
            allowCustomOverInternal = orgContext.configuration.sms.customOverInternal,
            selectedNumber

        if (utils.path(payload, 'endpoints.sms.number')) {
          selectedNumber = orgContext.configuration.sms.numbers.find(function(n) {
            return n.number === utils.path(payload, 'endpoints.sms.number') || utils.equalIds(n._id, utils.path(payload, 'endpoints.sms.number'))
          })
        }
        selectedNumber = selectedNumber || orgContext.configuration.sms.numbers.find(function(n) { return !!n.isDefault })

        if (selectedNumber && selectedNumber.toObject) {
          selectedNumber = selectedNumber.toObject()
        }

        if (isInternal) {
          if (allowInternalOverCustom && selectedNumber) {
            utils.path(payload, 'endpoints.sms.number', selectedNumber)
          }
        } else {
          if (!selectedNumber) {
            // remove all sms endpoints if no number is available. the internal number cannot
            // be used for custom notifications.
            while (len--) {
              endpoint = notificationType.endpoints[len]
              if (!allowCustomOverInternal && utils.equalIds(endpoint._id, consts.Notifications.Endpoints.Sms._id)) {
                notificationType.endpoints.splice(len, 1)
              }
            }
          } else {
            utils.path(payload, 'endpoints.sms.number', selectedNumber)
          }
        }
        if (!payload.number) {
          utils.path(payload, 'endpoints.sms.number', {
            provider: 'twilio',
            number: nextSmsFrom(), // round-robin sms numbers.
            accountSid: config('sms.id'),
            authToken: config('sms.auth')
          })
        }
      }

      if (err) {
        callback(err)
      } else if (!notificationType || (notificationType.endpoints.length === 0 && !notificationType.persists)) {
        callback('kDone') // eslint-disable-line standard/no-callback-literal
      } else {
        callback(null, orgContext, recipientPrincipal, notificationType)
      }

    },

    // persist the notification?
    function(orgContext, recipientPrincipal, notificationType, callback) {

      if (!notificationType.persists || !recipientPrincipal || !payload.context) {
        return callback(null, orgContext, recipientPrincipal, notificationType, null)
      }

      var noteOps = {
        created: utils.getValidDate(payload.created, new Date()),
        meta: payload.meta,
        duplicate: notificationType.duplicates // allow duplicate notifications (if false, the created date is updated)
      }

      modules.notifications.persist(notificationType._id, recipientPrincipal._id, orgContext._id, payload.context.object, payload.context._id, noteOps, function(err, notification) {
        if (err || !notification) {
          logger.error('could not persist notification.', err.toJSON({ stack: true }))
        }
        callback(null, orgContext, recipientPrincipal, notificationType, notification)
      })

    },

    // ensure a notification context object exists for the endpoints, and read it.
    function(orgContext, recipientPrincipal, notificationType, notification, callback) {

      // now that we've persisted the notification, if there are no endpoints, get out.
      if (notificationType.endpoints.length === 0) {
        return callback('kDone') // eslint-disable-line standard/no-callback-literal
      }

      if (!notification) {
        notification = new Notification()
        notification.created = new Date()
        notification.type = notificationType._id
        if (payload.context) {
          notification.context = payload.context
        }
        if (payload.meta != null) {
          notification.meta = payload.meta
        }
      }
      Notification.nodeList(recipientPrincipal || ap.synthesizeAnonymous(orgContext), null, { document: notification }, function(err, doc) {
        if (!err && doc) {
          payload.notification = doc
        }
        callback(null, orgContext, recipientPrincipal, notificationType)
      })

    },

    // count notifications, if possible.
    function(orgContext, recipientPrincipal, notificationType, callback) {

      if (utils.isInt(payload.count)) {
        return callback(null, orgContext, recipientPrincipal, notificationType)
      }
      payload.count = null // prevent notification workers from trying to load a count.

      if (!recipientPrincipal) {
        return callback(null, orgContext, recipientPrincipal, notificationType)
      }

      Notification.countDocuments({ account: recipientPrincipal._id }, function(err, count) {
        if (err) {
          logger.error('could not count notifications.', err.toJSON({ stack: true }))
        } else {
          payload.count = count
        }
        callback(null, orgContext, recipientPrincipal, notificationType)
      })

    },

    // resolve the payload render principal.
    function(orgContext, recipientPrincipal, notificationType, callback) {

      if (recipientPrincipal && utils.equalIds(recipientPrincipal._id, payload.principal)) {
        payload.principal = recipientPrincipal
        return callback(null, orgContext, recipientPrincipal, notificationType)
      }

      // if we don't have a render principal, fail miserably!
      ap.create(orgContext, payload.principal, { include: requiredPrincipalPaths }, function(err, principal) {
        if (err) {
          callback('kDone') // eslint-disable-line standard/no-callback-literal
        } else {
          payload.principal = principal
          callback(null, orgContext, recipientPrincipal, notificationType)
        }
      })

    },

    // run endpoints.
    function(workers, orgContext, recipientPrincipal, notificationType, callback) {

      const tasks = []

      notificationType.endpoints.forEach(function(endpoint) {

        let workerName,
            worker

        for (var key in consts.Notifications.Endpoints) {
          if (consts.Notifications.Endpoints.hasOwnProperty(key) && utils.equalIds(consts.Notifications.Endpoints[key]._id, endpoint._id)) {
            workerName = consts.Notifications.Endpoints[key].name
          }
        }

        worker = workers[workerName]
        if (worker) {

          const customEndpoint = utils.path(payload, `endpoints.${workerName}`),
                customTemplateEndpoint = utils.path(payload, `endpoints.${workerName}.template`),
                customMessageEndpoint = utils.path(payload, `endpoints.${workerName}.message`)

          let workerPayload = {
            notification: payload.notification,
            count: payload.count,
            org: orgContext,
            template: customTemplateEndpoint !== null ? (customTemplateEndpoint || endpoint.template) : null,
            message: (customTemplateEndpoint || endpoint.template) ? undefined : (customMessageEndpoint || payload.message || undefined),
            account: recipientPrincipal || payload.account,
            principal: payload.principal,
            locale: payload.locale,
            context: payload.context,
            apiKey: payload.apiKey,
            sound: payload.sound,
            variables: payload.variables,
            endpoints: payload.endpoints
          }

          worker.getPayloadOptions().forEach(function(option) {
            utils.path(workerPayload, option, utils.path(customEndpoint || endpoint, option))
          })

          tasks.push(function(callback) {
            worker.process(message, workerPayload, function(err) {

              if (err) {
                endpointErrs.push(err)
              }

              const startingPeriod = new Date(),
                    endingPeriod = new Date(startingPeriod.getTime()),
                    recipientId = recipientPrincipal ? utils.path(_.pick(recipientPrincipal.toObject(), '_id'), '_id') : utils.path(payload, 'account._id'),
                    principal = payload.sender || ap.synthesizeAnonymous(orgContext),
                    ac = new acl.AccessContext(principal, null, { req: message.req })

              startingPeriod.setMinutes(0, 0, 0)
              endingPeriod.setMinutes(59, 59, 999)

              let find = {
                    org: orgContext._id,
                    code: consts.stats.sources.notifications,
                    starting: startingPeriod,
                    ending: endingPeriod,
                    notifType: notificationType._id,
                    notifEndpoint: endpoint._id
                  },
                  update = {
                    $setOnInsert: {
                      org: orgContext._id,
                      starting: startingPeriod,
                      ending: endingPeriod,
                      code: consts.stats.sources.notifications,
                      notifType: notificationType._id,
                      notifEndpoint: endpoint._id
                    },
                    $inc: {
                      count: 1
                    }
                  },
                  testId

              if (err) {
                update.$inc.errs = 1
              }

              modules.db.models.Stat.collection.updateOne(find, update, { upsert: true }, function(err) {
                if (err) logger.error('failed to update notification stat', update)
              })

              modules.db.models.Log.createLogEntry(ac,
                'notification',
                err,
                {
                  statusCode: err ? err.statusCode : 200,
                  notification: notificationType.name,
                  endpoint: workerName,
                  template: customTemplateEndpoint || endpoint.template,
                  recipientId
                }
              )

              // adding audit log
              if (config('__is_mocha_test__')) {
                testId = require('../../../../test/lib/server').__mocha_test_uuid__
              }
              modules.audit.recordEvent(ac, 'notifications', 'send', {
                context: _.pick(workerPayload.notification, '_id', 'object'),
                err,
                metadata: {
                  template: workerPayload.template,
                  type: workerName,
                  recipientId,
                  testId
                }
              }, () => {
                callback(null, {})
              })
            })
          })
        }

      })

      async.parallel(tasks, callback)

    }.bind(null, this.workers)

  ], function(err) {

    if (err === 'kDone') err = null

    if (endpointErrs.length && utils.path(options, 'raiseEndpointErrors')) {

      if (!err) {
        err = Fault.from(endpointErrs.shift(), false, true)
      }
      endpointErrs.forEach(f => err.add(f))

    }

    callback(err)

  })

}

module.exports = NotificationWorker
