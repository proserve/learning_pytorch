'use strict'

module.exports = {

  main: function() {

    while (1) {}

  },

  fault: 'kScriptError',

  before: function(ac, model, callback) {

    ac.__routeMaxOps = ac.org.configuration.scripting.types.route.maxOps
    ac.org.configuration.scripting.types.route.maxOps = 100000
    callback()

  },

  after: function(err, result, ac, model, callback) {

    ac.org.configuration.scripting.types.route.maxOps = ac.__routeMaxOps

    if (!err || err.code !== 'kScriptError' || err.reason !== 'max ops exceeded') {
      err = new Error('script should have exceeded ops')
    }
    callback(err, result)

  }

}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Sandbox', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
