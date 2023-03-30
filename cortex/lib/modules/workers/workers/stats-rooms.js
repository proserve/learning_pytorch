'use strict'

const Worker = require('../worker'),
      util = require('util'),
      modules = require('../../../modules')

function StatsRoomUsage() {
  Worker.call(this)
}

util.inherits(StatsRoomUsage, Worker)

/**
 * @param message
 * @param payload
 * @param options
 * @param callback
 * @private
 */
StatsRoomUsage.prototype._process = function(message, payload, options, callback) {

  let request

  const onCancelMessage = () => {
    if (request) {
      request.cancel()
    }
  }

  message.once('cancel', onCancelMessage)

  request = modules.db.models.Room.processBillingRecords(err => {
    request = null
    message.removeListener('cancel', onCancelMessage)
    callback(err)
  })

}

module.exports = StatsRoomUsage
