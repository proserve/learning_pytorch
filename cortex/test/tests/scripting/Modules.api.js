'use strict'

module.exports = {

  main: function() {

    /* global script */

    require('should')

    const api = require('api'),
          principal = api.principal.create(script.principal._id),
          stats = api.stats({ limit: 1 }),
          logs = api.logs({ limit: 1 })

    principal.email.should.equal(script.principal.email)

    stats.data.length.should.be.a.Number()
    logs.data.length.should.be.a.Number()

    return true

  }

}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
