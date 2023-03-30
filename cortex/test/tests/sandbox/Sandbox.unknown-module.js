'use strict'

module.exports = {

  main: function() {

    require('dne')

  },

  fault: 'kNotFound'

}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Sandbox', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
