'use strict'

module.exports = {

  main: "var x=';",
  fault: 'cortex.invalidArgument.scriptCompilation'

}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Sandbox', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
