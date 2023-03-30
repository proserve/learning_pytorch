'use strict'

const { rInt } = require('../../../../utils')

module.exports = {

  version: '1.0.0',

  getCalloutsRemaining: function(script, message, callback) {
    callback(null, script.configuration.isInline ? 0 : script.configuration.limits.maxCallouts - script.stats.callouts)
  },

  getNotificationsRemaining: function(script, message, callback) {
    callback(null, script.configuration.limits.maxNotifications - rInt(script.stats.notifications, 0))
  }

}
