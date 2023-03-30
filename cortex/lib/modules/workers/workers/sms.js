'use strict'

const NotificationBaseWorker = require('../notification-base-worker'),
      util = require('util'),
      _ = require('underscore'),
      async = require('async'),
      twilio = require('twilio'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      ap = require('../../../access-principal'),
      utils = require('../../../utils')

Fault.addConverter(function TwilioResponseConverter(err) {
  if (err && err['status'] && err['code'] && err['message'] && err['more_info'] && err['nodeClientResponse']) {
    const fault = Fault.create(err.code, err['message'], err['status'], 'twilio')
    err = Fault.create('cortex.error.smsNotification')
    err.add(fault)
  }
  return err
})

function SmsWorker() {
  NotificationBaseWorker.call(this)
}
util.inherits(SmsWorker, NotificationBaseWorker)

SmsWorker.prototype.getTemplateType = function() {
  return 'sms'
}

SmsWorker.prototype.getRequiredRecipientPrincipalPaths = function() {
  return NotificationBaseWorker.prototype.getRequiredRecipientPrincipalPaths.call(this).concat('mobile')
}

SmsWorker.prototype.getPayloadOptions = function() {
  return ['mobile', 'number']
}

/**
 *
 * @param payload
 *     mobile
 *     number
 *      provider
 *      number
 *      accountSid
 *      authToken
 * @param callback
 */
SmsWorker.prototype.parsePayload = function(payload, callback) {

  NotificationBaseWorker.prototype.parsePayload.call(this, payload, function(err, payload) {
    if (!err) {
      let mobile = utils.path(payload, 'endpoints.sms.mobile')
      const number = utils.path(payload, 'endpoints.sms.number')
      if (!mobile && ap.is(payload.account)) {
        mobile = payload.account.account.mobile
      }
      if (!_.isString(mobile)) {
        err = Fault.create('cortex.invalidArgument.unspecified', { path: 'worker.notification.sms.mobile' })
      } else if (mobile[0] !== '+') {
        mobile = '+' + mobile // make E.164
      }

      // validate the number to use for sending.
      if (!_.isObject(number)) {
        err = Fault.create('cortex.invalidArgument.unspecified', { path: 'worker.notification.sms.number' })
      } else if (number.provider !== 'twilio') {
        err = Fault.create('cortex.invalidArgument.unspecified', { path: 'worker.notification.sms.provider' })
      } else if (!_.isString(number.number) || !_.isString(number.accountSid) || !_.isString(number.authToken)) {
        err = Fault.create('cortex.invalidArgument.unspecified', { path: 'worker.notification.sms.number.number' })
      }

      utils.path(payload, 'endpoints.sms.mobile', mobile)

      if (Array.isArray(config('sms.blockList')) && config('sms.blockList').includes(mobile)) {
        logger.warn('SMS blocked because block list includes phone number', {
          orgId: utils.path(payload, 'org._id'),
          accountId: utils.path(payload, 'account._id')
        })
        err = Fault.create('cortex.sms.blockedNumber', { path: 'worker.notification.sms.mobile' })
      }

    }
    if (config('__is_mocha_test__') && err) {
      require('../../../../test/lib/server').events.emit('worker.sms', payload.message, payload, {}, err)
    }
    callback(err, payload)
  })

}

/**
 * payload options:
 *
 *     , or
 *
 *     org: the org id
 *     account: the account id
 *     template: the sms template name
 *     locale: optional. uses the principal locale if not specified.
 *
 * @param message
 * @param payload
 * @param options
 * @param callback
 * @private
 */
SmsWorker.prototype._process = function(message, payload, options, callback) {

  async.waterfall([

    // render message or template.
    function(callback) {
      if (payload.message) {
        return callback(null, payload.message)
      }

      // just grab the first piece of output content.
      this.renderTemplate(payload, function(err, result) {
        callback(err, _.values(result || {})[0])
      })

    }.bind(this),
    function(message, callback) {

      if (config('__is_mocha_test__')) {
        require('../../../../test/lib/server').events.emit('worker.sms', message, payload, options)
        return callback(null)
      }

      if (config('debug.doNotSendSms')) {
        return callback(null)
      }

      async.retry({
        times: utils.rInt(config('callbacks.smsRetries'), 1),
        interval: retryCount => utils.rInt(config('callbacks.smsRetryStaticDelay'), 0) +
          utils.rInt(config('callbacks.smsRetryBaseBackoffDelay'), 0) * Math.pow(2, retryCount)
      }, (callback) => {

        let timeoutId = setTimeout(function() {
          timeoutId = null
          callback(Fault.create('cortex.timeout.smsNotification'))

        }, config('callbacks.smsTimeoutTolerance'))

        const number = utils.path(payload, 'endpoints.sms.number'),
              mobile = utils.path(payload, 'endpoints.sms.mobile')

        twilio(number.accountSid, number.authToken).messages.create({
          to: mobile,
          from: number.number,
          body: message
        }, function(err) {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
            if (err) {
              err = Fault.create(err.code, { message: err.message, reason: err.moreInfo, status: err.status })
            }
            callback(err)
          }
        })

      }, callback)

    }

  ], callback)

}

module.exports = SmsWorker
