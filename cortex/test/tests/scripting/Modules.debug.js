'use strict'

const should = require('should'),
      wrapper = require('../../lib/wrapped_sandbox')

let debugErr = null

module.exports = {

  main: function() {

    var debug = require('debug')

    debug.sleep(1, true)
    debug.sleep(1)
    debug.log('yoohoo')

    if (debug.echo(123) !== 123) {
      throw new Error('debug.echo ought to return the same result')
    }

    return true

  },

  before: function(ac, model, callback) {

    console._debug_test_log = console.log
    console.log = function(m) {
      try {
        should.equal(m, 'yoohoo')
      } catch (e) {
        debugErr = e
      }
    }
    callback(null)

  },

  after: function(err, result, ac, model, callback) {
    console.log = console._debug_test_log
    delete console._debug_test_log

    callback(err || debugErr, result)

  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
