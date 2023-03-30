'use strict'

module.exports = {

  main: function() {

    // noinspection NpmUsedModulesInstalled
    const base64 = require('base64'),
          string = "Let's put some happy little clouds in our world. Let's give him a friend too. Everybody needs a friend.",
          encoded = base64.encode(string)

    if (string !== base64.decode(encoded)) {
      throw new Error('decoded string should match original')
    }

    if (string !== base64.decode(encoded, true).toString()) {
      throw new Error('decoded string as buffer should match original')
    }

    return true

  }
}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
