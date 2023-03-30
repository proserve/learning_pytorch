'use strict'

module.exports = {

  main: function() {

    const res = require('response'),
          should = require('should')

    should.equal(res.setCookie('Name', 'Value'), false)
    should.equal(res.setHeader('Name', 'Value'), false)
    should.equal(res.write('Value'), false)
    should.equal(res.setStatusCode(200), false)

    return true

  }

}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
