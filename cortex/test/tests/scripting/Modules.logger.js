'use strict'

module.exports = {

  main: function() {

    const logger = require('logger')
    logger.info('take that!')

    return true

  }

}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
