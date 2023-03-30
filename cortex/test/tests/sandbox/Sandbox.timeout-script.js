'use strict'

module.exports = {

  main: function() {

    require('debug').sleep(100)
    while (1) {
      console.log('hey hey!')
    }
  },

  fault: 'kTimeout',

  before: function(ac, model, callback) {

    ac.__routeTimeoutMs = ac.org.configuration.scripting.types.route.timeoutMs
    ac.org.configuration.scripting.types.route.timeoutMs = 100
    callback()

  },

  after: function(err, result, ac, model, callback) {

    ac.org.configuration.scripting.types.route.timeoutMs = ac.__routeTimeoutMs
    callback(err, result)

  }

}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Sandbox', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
