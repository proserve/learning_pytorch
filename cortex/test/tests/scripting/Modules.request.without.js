'use strict'

module.exports = {

  main: function() {

    const req = require('request'),
          should = require('should')

    should.equal(req.getCookie('Cookie'), null)
    should.equal(req.getHeader('Accept'), null)

    return true

  }

}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
