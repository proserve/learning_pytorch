'use strict'

const NotificationBaseWorker = require('../notification-base-worker'),
      util = require('util'),
      _ = require('underscore'),
      crypto = require('crypto'),
      { extend, path: pathTo, array: toArray, equalIds, isPlainObject, isSet, promised, isId, roughSizeOfObjectAsync } = require('../../../utils'),
      config = require('cortex-service/lib/config'),
      modules = require('../../../modules'),
      Fault = require('cortex-service/lib/fault'),
      ap = require('../../../access-principal'),
      acl = require('../../../acl'),
      async = require('async'),
      https = require('https'),
      retry = require('retry'),
      apn = require('@parse/node-apn'),
      gcm = require('node-gcm'),
      { pki, asn1 } = require('node-forge'),
      consts = require('../../../consts'),
      hasher = require('object-hash'),
      clone = require('clone'),
      tencentPushHost = config('integrations.tencent.push.host') || 'api.tpns.tencent.com'

function replacer(value) {

  if (value && isId(value)) {
    return value.toString()
  }
  return value

}

/**
 * @param cert
 * @returns {
 *   "app": "com.medable.xyz",
 *   "voip": "com.medable.xyz.voip",
 *   "complication": "com.medable.xyz.complication"
 * }
 */
function getTopics(cert) {

  try {

    const obj = pki.certificateFromPem(cert),
          uid = obj.subject.getField({ type: '0.9.2342.19200300.100.1.1' }).value,
          ext = obj.getExtension({ id: '1.2.840.113635.100.6.3.6' }).value

    try {
      return _.chunk(asn1.fromDer(ext).value.map(v => v.value), 2)
        .map(arr => {
          return {
            name: arr[0],
            destinations: arr[1].map(v => v.value)
          }
        })
        .reduce((topics, { name, destinations }) => {

          return destinations.reduce((topics, dest) => {
            topics[dest] = name
            return topics
          }, topics)

        }, {})
    } catch (err) {
      return {
        app: uid
      }
    }

  } catch (err) {
    return {}
  }

}

class Provider {

  static #providers = new Map()

  static async send(cfg, notification, destination) {

    const hash = hasher(cfg, { replacer, algorithm: 'sha1', encoding: 'hex' })

    let err, entry = this.#providers.get(hash) || {}

    if (!entry.provider) {
      entry = {
        provider: new apn.Provider(clone(cfg)),
        ref: 0,
        timer: null
      }
      this.#providers.set(hash, entry)
    } else if (entry.timer) {
      clearTimeout(entry.timer)
    }
    entry.ref += 1

    return entry.provider.send(notification, [destination.token])
      .catch(e => {
        err = e
      })
      .then(response => {
        entry.ref -= 1
        if (entry.ref === 0) {
          entry.timer = setTimeout(() => {
            entry.provider.shutdown()
            this.#providers.delete(hash)
          }, 5000)
          entry.timer.unref()
        }
        if (err) {
          throw err
        }
        return response
      })

  }

  static async getApproximateMemoryUsage() {

    let sz = 0

    for (let provider of this.#providers.values()) {
      sz += await roughSizeOfObjectAsync(provider)
    }
    return sz

  }

}

// ----------------------------------------------------------------

/**
 * Using legacy fcm api
 *
 * @param serverKey
 * @param payload
 * @param callback
 */
function sendFCM(serverKey, payload, callback) {

  callback = _.once(callback)

  const operation = retry.operation()

  operation.attempt((currentAttempt) => {

    const options = {
            host: 'fcm.googleapis.com',
            port: 443,
            path: '/fcm/send',
            method: 'POST',
            headers: {
              Host: 'fcm.googleapis.com',
              Authorization: `key=${serverKey}`,
              'Content-Type': 'application/json'
            }
          },
          request = https.request(options, res => {

            let data = ''

            if (res.statusCode === 503) {
              if (res.headers['retry-after']) {
                var retrySeconds = res.headers['retry-after'] * 1 // force number
                if (isNaN(retrySeconds)) {
                  retrySeconds = new Date(res.headers['retry-after']).getTime() - new Date().getTime()
                }
                if (!isNaN(retrySeconds) && retrySeconds > 0) {
                  operation._timeouts['minTimeout'] = retrySeconds
                }
              }
              if (!operation.retry('TemporaryUnavailable')) {
                callback(operation.mainError(), null)
              }
              return
            }

            function respond() {

              let error = null, id = null

              if (data.indexOf('"multicast_id":') > -1) {
                let anyFail = ((JSON.parse(data)).failure > 0),
                    anySuccess = ((JSON.parse(data)).success > 0)

                if (anyFail) {
                  error = data.substring(0).trim()
                }
                if (anySuccess) {
                  id = data.substring(0).trim()
                }
              } else if (data.indexOf('"message_id":') > -1) { // topic messages success
                id = data
              } else if (data.indexOf('"error":') > -1) { // topic messages error
                error = data
              } else if (data.indexOf('TopicsMessageRateExceeded') > -1) {
                error = 'TopicsMessageRateExceededError'
              } else if (data.indexOf('Unauthorized') > -1) {
                error = 'NotAuthorizedError'
              } else {
                error = 'InvalidServerResponse'
              }
              if (operation.retry(currentAttempt <= 3 && ['QuotaExceeded', 'DeviceQuotaExceeded', 'InvalidServerResponse'].indexOf(error) >= 0 ? error : null)) {
                return
              }
              callback(error, id)
            }

            res.on('data', function(chunk) {
              data += chunk
            })
            res.on('end', respond)
            res.on('close', respond)
          })

    request.on('error', callback)

    request.end(JSON.stringify(payload))
  })

}

/**
 * Tencent Push Notification Service
 * Push API
 * https://intl.cloud.tencent.com/document/product/1024/33764
 *
 * Error Codes
 * https://intl.cloud.tencent.com/document/product/1024/33763
 *
 * @param accessId
 * @param secretKey
 * @param payload
 * @param callback
 */
function sendTPNS(accessId, secretKey, payload, callback) {

  callback = _.once(callback)

  const operation = retry.operation()

  operation.attempt((currentAttempt) => {

    const timestamp = Math.floor(Date.now() / 1000),
          stringifiedPayload = JSON.stringify(payload),
          stringToSign = `${timestamp}${accessId}${stringifiedPayload}`,
          hexSig = crypto
            .createHmac('sha256', secretKey)
            .update(stringToSign)
            .digest('hex'),
          base64Sig = Buffer
            .from(hexSig)
            .toString('base64'),
          options = {
            host: tencentPushHost,
            port: 443,
            path: '/v3/push/app',
            method: 'POST',
            headers: {
              Host: tencentPushHost,
              'Content-Type': 'application/json',
              AccessId: accessId,
              TimeStamp: timestamp,
              Sign: base64Sig
            }
          },
          request = https.request(options, res => {

            let data = ''

            if (res.statusCode === 503) {
              if (res.headers['retry-after']) {
                var retrySeconds = res.headers['retry-after'] * 1 // force number
                if (isNaN(retrySeconds)) {
                  retrySeconds = new Date(res.headers['retry-after']).getTime() - new Date().getTime()
                }
                if (!isNaN(retrySeconds) && retrySeconds > 0) {
                  operation._timeouts['minTimeout'] = retrySeconds
                }
              }
              if (!operation.retry('TemporaryUnavailable')) {
                callback(operation.mainError(), null)
              }
              return
            }

            function respond() {

              let error = null, id = null

              // invalid response
              if (data.indexOf('"push_id":') === -1) {

                error = 'InvalidServerResponse'

              // valid response
              } else {

                const jsonData = JSON.parse(data)

                // success
                if (jsonData.ret_code === 0) {

                  id = data

                // error
                } else {

                  error = data

                }

              }

              if (operation.retry(currentAttempt <= 3 && ['InvalidServerResponse'].indexOf(error) >= 0 ? error : null)) {
                return
              }

              callback(error, id)

            }

            res.on('data', function(chunk) {
              data += chunk
            })
            res.on('end', respond)
            res.on('close', respond)
          })

    request.on('error', callback)

    request.end(stringifiedPayload)
  })

}

// ----------------------------------------------------------------

function PushWorker() {
  NotificationBaseWorker.call(this)

  this.options = extend(this.options, {
    sound: undefined,
    expiry: '1d' // expire undeliverable notifications in a day.
  })

}
util.inherits(PushWorker, NotificationBaseWorker)

PushWorker.prototype.getApproximateMemoryUsage = async function() {

  return Provider.getApproximateMemoryUsage()

}

PushWorker.prototype.getTemplateType = function() {
  return 'push'
}

PushWorker.prototype.init = function(options) {
  NotificationBaseWorker.prototype.init.call(this, options)
}

PushWorker.prototype.getPayloadOptions = function() {
  return ['sound', 'count', 'template']
}

/**
 *
 * @param payload
 *     sound
 *     apiKey
 * @param callback
 */
PushWorker.prototype.parsePayload = function(payload, callback) {

  NotificationBaseWorker.prototype.parsePayload.call(this, payload, function(err, payload) {
    if (!err) {
      if (!_.isString(payload.sound) || !payload.sound.length) {
        delete payload.sound
      }
      if (!_.isString(payload.apiKey) || !payload.apiKey.length) {
        delete payload.apiKey
      }
    }
    callback(err, payload)
  })

}

/**
 *
 * @param message
 * @param payload
 *     sound: optional. if provided, overrides the default sound.
 *     count: optional. if set, sets the badge on the device icon.
 *     apiKey: optional. pins to org app from registered locations.
 *     org: the org context object or org id
 *     account: the recipient principal or an object containing either an _id or email.
 *     principal: the principal or principal id to use for rendering.
 *     locale: uses the principal locale if not specified.
 *     req: the http request object or id.
 *     context: the message context.
 *     message: optional. the text message.
 *          or
 *     template: options the template to use.
 * @param options
 * @param callback
 * @private
 */
PushWorker.prototype._process = function(message, payload, options, callback) {

  let processErr = null

  return Promise.resolve(null)

    .then(async() => {

      let apnsConfig,
          locations,
          apps // filtered matching apps

      const destinations = {
              apn: [],
              gcm: [],
              fcm: [],
              tpns: []
            },
            apnTopics = toArray(pathTo(payload, 'endpoints.push.apn.topics')),
            pushType = pathTo(payload, 'endpoints.push.apn.pushType')

      // no registered account recipient. bail silently.
      if (!ap.is(payload.account)) {
        return
      }

      // get base apns config, if it exists.
      try {
        apnsConfig = await promised(modules.config, 'get', { _id: acl.BaseOrg }, 'apns')
      } catch (e) {
        void e
      }

      // get base apns from org, if it exists.
      try {
        const orgConfig = await promised(modules.config, 'get', payload.org, 'apns')
        if (orgConfig) {
          apnsConfig = orgConfig
        }
      } catch (e) {
        void e
      }

      if (!apnsConfig) {
        apnsConfig = config('notifications.apns')
      }

      // get locations that can receive the message.
      locations = await modules.db.models.location.find({ org: payload.org._id,
        accountId: payload.account._id,
        $or: [
          { 'ios.notification.token': { $exists: true } },
          { 'voip.token': { $exists: true } },
          { 'android.regid': { $exists: true } },
          { 'firebase.token': { $exists: true } },
          { 'tencent.token': { $exists: true } }
        ] }).lean().exec()

      if (locations.length === 0) {
        return
      }

      // load org apps if they aren't already loaded.
      if (_.every(['apps._id', 'apps.GCM', 'apps.FCM', 'apps.TPNS', 'apps.APNs', 'apps.clients.key'], function(path) { return payload.org.isSelected(path) })) {
        apps = payload.org.apps
      } else {
        const doc = await modules.db.models.org.findOne({ _id: payload.org._id }).select('apps._id apps.GCM apps.FCM apps.TPNS apps.APNs apps.clients.key').lean().exec()
        if (!doc) {
          return
        }
        apps = toArray(doc.apps)
      }

      // match up locations with apps.
      apps = apps.filter(app =>
        !payload.apiKey || _.some(toArray(app.clients), client => client.key === payload.apiKey)
      )

      for (const app of apps) {

        const appId = app._id,
              debug = !!pathTo(app, 'APNs.debug'),
              cert = pathTo(app, 'APNs.cert') || '',
              key = pathTo(app, 'APNs.key') || '',
              bundleId = pathTo(app, 'APNs.bundleId') || '',
              gcmKey = pathTo(app, 'GCM.apiKey') || '',
              fcmKey = pathTo(app, 'FCM.apiKey') || '',
              accessId = pathTo(app, 'TPNS.accessId') || '',
              secretKey = pathTo(app, 'TPNS.secretKey') || '',
              clients = toArray(app.clients).map(function(client) { return pathTo(client, 'key') }).filter(function(key) { return !!key }),
              useToken = pathTo(payload.org, 'configuration.notification.APNsConfig.useToken')

        if (clients.length > 0) {

          let appTopic = null,
              isVoip = false

          if (!useToken && cert && key) {

            const certTopics = getTopics(cert),
                  setDefaultTopic = () => {
                    if (apnTopics.includes('voip')) {
                      isVoip = true
                      appTopic = certTopics['voip']
                    } else {
                      appTopic = certTopics['app'] || certTopics['topic']
                    }
                  }

            if (pushType && ['alert', 'background'].indexOf(pushType) < 0) {
              const certTopic = certTopics[pushType]
              if (certTopic) {
                isVoip = pushType === 'voip'
                appTopic = certTopic
              } else {
                setDefaultTopic()
              }
            } else {
              setDefaultTopic()
            }
          } else {
            if (pushType === 'voip' || apnTopics.includes('voip')) {
              isVoip = true
              appTopic = `${bundleId}.voip`
            } else {
              appTopic = bundleId
            }
          }

          locations.forEach(location => {
            let token = isVoip ? pathTo(location, 'voip.token') : pathTo(location, 'ios.notification.token')
            if (appTopic && token && ~clients.indexOf(location.client)) {
              const expiration = pathTo(payload, 'endpoints.push.apn.expiration')
              destinations.apn.push({
                orgId: payload.org._id,
                apiKey: location.client,
                appId: appId,
                debug: debug,
                cert: cert,
                key: key,
                token: token,
                notification: payload.notification || null,
                count: _.isFinite(payload.count) ? payload.count : undefined,
                sound: payload.sound || this.options.sound || undefined,
                topic: appTopic,
                pushType,
                useToken,
                apnsConfig,
                expires: isSet(expiration) ? expiration : this.options.expiry,
                priority: pathTo(payload, 'endpoints.push.apn.priority') || (pushType !== 'background' ? 10 : 5)
              })
            }
          })
        }

        if (gcmKey) {
          locations.forEach(location => {
            const regId = pathTo(location, 'android.regid'),
                  expiration = pathTo(payload, 'endpoints.push.gcm.expiration')
            if (regId && ~clients.indexOf(location.client)) {
              destinations.gcm.push({
                orgId: payload.org._id,
                apiKey: location.client,
                appId: appId,
                gcmKey: gcmKey,
                regId: regId,
                notification: payload.notification || null,
                count: _.isFinite(payload.count) ? payload.count : undefined,
                sound: payload.sound || this.options.sound || undefined,
                expires: isSet(expiration) ? expiration : this.options.expiry
              })
            }
          })
        }

        if (fcmKey) {
          locations.forEach(location => {
            let token = pathTo(location, 'firebase.token')
            if (token && ~clients.indexOf(location.client)) {
              const expiration = pathTo(payload, 'endpoints.push.fcm.expiration')
              destinations.fcm.push({
                orgId: payload.org._id,
                apiKey: location.client,
                appId,
                fcmKey,
                token,
                notification: payload.notification || null,
                count: _.isFinite(payload.count) ? payload.count : undefined,
                sound: payload.sound || this.options.sound || undefined,
                expires: isSet(expiration) ? expiration : this.options.expiry
              })
            }
          })
        }

        if (accessId && secretKey) {
          locations.forEach(location => {
            let token = pathTo(location, 'tencent.token')
            if (token && ~clients.indexOf(location.client)) {
              destinations.tpns.push({
                orgId: payload.org._id,
                apiKey: location.client,
                appId,
                accessId,
                secretKey,
                token
              })
            }
          })
        }
      }

      if (destinations.apn.length === 0 &&
        destinations.gcm.length === 0 &&
        destinations.fcm.length === 0 &&
        destinations.tpns.length === 0) {
        return
      }

      // render the note from an org template
      function setMessageInDestinations(message) {
        destinations.apn.forEach(function(destination) {
          destination.message = message
        })
        destinations.gcm.forEach(function(destination) {
          destination.message = message
        })
        destinations.fcm.forEach(function(destination) {
          destination.message = message
        })
        destinations.tpns.forEach(function(destination) {
          destination.message = message
        })
      }

      if (isSet(payload.message)) {

        setMessageInDestinations(payload.message)

      } else if (isSet(payload.template)) {

        // grab the first piece of output content.
        const result = await promised(this, 'renderTemplate', payload)
        setMessageInDestinations(_.values(result || {})[0] || '')

      }

      return destinations

    })

    .then(async(destinations) => {

      if (!destinations) {
        return
      }

      // common results handler
      function done(err, provider, response, destination) {

        if (err) {
          const errMessage = err.message || String(err)
          err = Fault.from(err, false, true)
          err.reason = errMessage
          err.message = `An error occurred attempting to send an ${provider} push notification`
        }

        const logMessage = {
          response,
          recipientId: payload.account._id,
          template: payload.template,
          apiKey: destination.apiKey,
          debugGateway: !!destination.debug,
          provider: provider,
          priority: destination.priority
        }

        if (provider === 'APNS') {
          logMessage.topic = destination.topic
          logMessage.pushType = destination.pushType
          logMessage.expiration = destination.expires
          logMessage.apnHeaders = destination.headersSent

        } else if (provider === 'FCM') {
          logMessage.timeToLive = pathTo(payload, 'endpoints.push.fcm.timeToLive')
          logMessage.priority = pathTo(payload, 'endpoints.push.fcm.priority') || 'high'
        }

        modules.db.models.Log.createLogEntry(
          new acl.AccessContext(ap.synthesizeAnonymous(payload.org), null, { req: message.req }),
          'notification',
          err,
          logMessage
        )

      }

      // send functionality for apn, gcm, fcm
      await promised(
        async,
        'parallel',
        [

          function(callback) {

            async.eachLimit(destinations.apn, 10, function(destination, cb) {
              if (config('__is_mocha_test__')) {
                require('../../../../test/lib/server').events.emit('worker.push', destination, message, payload, options)
                cb()
              } else {

                let cfg, notification

                try {
                  cfg = {
                    production: !destination.debug
                  }
                  const APNsConfig = destination.apnsConfig
                  if (APNsConfig && destination.useToken) {
                    Object.assign(cfg, {
                      token: {
                        key: APNsConfig.key,
                        keyId: APNsConfig.keyId,
                        teamId: APNsConfig.teamId
                      }
                    })
                  } else {
                    Object.assign(cfg, {
                      cert: destination.cert,
                      key: destination.key
                    })
                  }

                  notification = new apn.Notification({
                    alert: destination.message,
                    badge: destination.count,
                    sound: destination.sound,
                    pushType: destination.pushType
                  })
                } catch (err) {
                  done(err, 'APNS', null, destination)
                  return cb()
                }

                if (destination.notification) {
                  if (equalIds(destination.notification.type, consts.emptyId)) {
                    if (isPlainObject(payload.variables)) {
                      notification.payload = { ...payload.variables, notification: destination.notification }
                    } else {
                      notification.payload = { payload: payload.variables, notification: destination.notification }
                    }
                  } else {
                    notification.payload = destination.notification
                  }
                }

                notification.topic = destination.topic
                notification.expiry = destination.expires
                notification.priority = destination.priority

                destination.headersSent = notification.headers()

                Provider.send(cfg, notification, destination).then(response => {

                  // response.failed: Array of objects containing the device token (`device`) and either an `error`, or a `status` and `response` from the API
                  let err
                  if (response.failed && response.failed.length) {
                    const resp = pathTo(response.failed[0], 'error') || Fault.create('kError', { statusCode: pathTo(response.failed[0], 'status'), message: pathTo(response.failed[0], 'response.reason') })
                    err = Fault.from(resp, false, true)
                  }
                  done(err, 'APNS', response, destination)
                  cb()

                }).catch(err => {
                  done(err, 'APNS', null, destination)
                  cb()
                })

              }

            }, callback)

          },

          function(callback) {

            async.eachLimit(destinations.gcm, 10, function(destination, cb) {
              var gcmMessage = new gcm.Message({
                    delayWhileIdle: false,
                    timeToLive: isSet(destination.ttl) ? destination.ttl : 86400,
                    data: {
                      message: destination.message,
                      count: destination.count,
                      notification: payload.notification || null
                    }
                  }),
                  regIds = [destination.regId],
                  sender = new gcm.Sender(destination.gcmKey)

              if (equalIds(payload.notification.type, consts.emptyId)) {
                gcmMessage.data.payload = payload.variables
              }

              if (config('__is_mocha_test__')) {
                require('../../../../test/lib/server').events.emit('worker.push', destination, message, payload, options)
                cb()
              } else {
                sender.send(gcmMessage, regIds, 5, function(err, result) {
                  done(err, 'GCM', result, destination)
                  cb()
                })
              }

            }, callback)
          },

          function(callback) {

            const fcmTopic = pathTo(payload, 'endpoints.push.fcm.topic'),
                  ttl = pathTo(payload, 'endpoints.push.fcm.timeToLive'),
                  priority = pathTo(payload, 'endpoints.push.fcm.priority') || 'high'

            async.eachLimit(destinations.fcm, 10, function(destination, cb) {
              const fcmMessage = {
                to: destination.token,
                data: {
                  message: destination.message,
                  count: destination.count,
                  notification: payload.notification || null
                }
              }

              if (priority) {
                fcmMessage.priority = priority
              }

              if (isSet(ttl)) {
                fcmMessage.time_to_live = ttl
              }

              if (fcmTopic) {
                fcmMessage.data.topic = fcmTopic
              }
              if (equalIds(payload.notification.type, consts.emptyId)) {
                if (isPlainObject(payload.variables)) {
                  fcmMessage.data = { ...payload.variables, ...fcmMessage.data }
                } else {
                  fcmMessage.data.payload = payload.variables
                }
              }

              if (config('__is_mocha_test__')) {
                require('../../../../test/lib/server').events.emit('worker.push', destination, message, payload, options)
                cb()
              } else {
                sendFCM(destination.fcmKey, fcmMessage, function(err, result) {
                  done(err, 'FCM', result, destination)
                  cb()
                })
              }

            }, callback)
          },

          function(callback) {

            async.eachLimit(destinations.tpns, 10, function(destination, cb) {

              const tpnsEndpointOptions = pathTo(payload, 'endpoints.push.tpns') || {}

              if(tpnsEndpointOptions.audience_type){
                delete tpnsEndpointOptions.audience_type
              }
              if(tpnsEndpointOptions.token_list){
                delete tpnsEndpointOptions.token_list
              }

              // Push API Documentation
              // https://intl.cloud.tencent.com/document/product/1024/33764
              const tpnsMessage = extend(true, {
                audience_type: 'token',
                message_type: 'notify',
                token_list: [destination.token],
                multi_pkg: true,
                message: {
                  content: destination.message,
                  android: {
                    custom_content: {}
                  }
                }
              }, tpnsEndpointOptions)

              if (equalIds(payload.notification.type, consts.emptyId)) {
                if (isPlainObject(payload.variables) && isPlainObject(tpnsMessage.message.android.custom_content)) {
                  extend(true, tpnsMessage.message.android.custom_content, payload.variables)
                } else {
                  tpnsMessage.message.android.custom_content = payload.variables
                }
              }

              // required to be a string
              if (isPlainObject(tpnsMessage.message.content)) {
                tpnsMessage.message.content = JSON.stringify(tpnsMessage.message.content)
              }

              // required to be a string
              if (isPlainObject(tpnsMessage.message.android.custom_content)) {
                tpnsMessage.message.android.custom_content = JSON.stringify(tpnsMessage.message.android.custom_content)
              }

              if (config('__is_mocha_test__')) {
                require('../../../../test/lib/server').events.emit('worker.push', destination, message, payload, options, tpnsMessage)
                cb()
              } else {
                sendTPNS(destination.accessId, destination.secretKey, tpnsMessage, function(err, result) {
                  done(err, 'TPNS', result, destination)
                  cb()
                })
              }

            }, callback)
          }
        ]
      )

    })

    .catch(err => {
      processErr = err
    })
    .then(() => {
      callback(processErr)
    })

}

module.exports = PushWorker
