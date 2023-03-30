'use strict'

module.exports = {

  main: function() {

    const consts = require('consts')
    return consts != null

  }

}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
