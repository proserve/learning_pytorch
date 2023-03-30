'use strict'

const ics = require('ics'),
      Fault = require('cortex-service/lib/fault')

module.exports = {

  createEvent: async function(script, message, event) {
    const { error, value } = ics.createEvent(event)
    if (error) {
      throw Fault.from(error)
    }
    return value
  },

  createEvents: async function(script, message, events) {
    const { error, value } = ics.createEvents(events)
    if (error) {
      throw Fault.from(error)
    }
    return value
  }

}
