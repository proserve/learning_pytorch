'use strict'

const Fault = require('cortex-service/lib/fault'),
      utils = require('../../../../utils'),
      modules = require('../../../../modules')

module.exports = {

  version: '1.0.0',

  send(script, message, name, variables, options, callback) {

    // note: queue option not allowed here.
    options = script.allowedOptions(options, 'number', 'recipient', 'context', 'locale', 'apiKey', 'count', 'sound', 'apnTopics', 'fcmTopic', 'pushType', 'endpoints')

    if (!modules.authentication.authInScope(script.ac.principal.scope, 'object.create.notification', false)) {
      return setImmediate(callback, Fault.create('cortex.accessDenied.scope', { path: 'object.create.notification' }))
    }

    const numSent = utils.rInt(script.stats.notifications, 0)
    script.stats.notifications = numSent + 1
    if (numSent >= script.configuration.limits.maxNotifications) {
      return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Max notifications per script limit exceeded.' }))
    }

    modules.notifications.send(script.ac, name, variables, options, callback)

  }

}
