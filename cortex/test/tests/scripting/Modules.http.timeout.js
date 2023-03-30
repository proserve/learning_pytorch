'use strict'

module.exports = {

  main: function() {

    const http = require('http')

    http.get('http://medable.com/')

    return true

  },

  fault: 'kTimeout',

  before: function(ac, model, callback) {

    let scripting = ac.org.configuration.scripting
    scripting._maxCalloutRequestTimeout = scripting.maxCalloutRequestTimeout
    scripting.maxCalloutRequestTimeout = 1
    callback()

  },

  after: function(err, result, ac, model, callback) {
    let scripting = ac.org.configuration.scripting
    scripting.maxCalloutRequestTimeout = scripting._maxCalloutRequestTimeout
    callback(err, result)

  }

}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
