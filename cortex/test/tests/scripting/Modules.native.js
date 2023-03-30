'use strict'

module.exports = {

  main: function() {

    try {
      require('bignumber')
      require('decimal')
      require('moment')
      require('moment.timezone')
      require('underscore')
      require('should')
      require('underscore.string')
      require('later')
    } catch (err) {
      throw Error(err.message + ' ' + err.trace)
    }

    return true

  }

}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
