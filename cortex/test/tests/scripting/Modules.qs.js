'use strict'

module.exports = {

  main: function() {

    require('should')

    const qs = require('qs'),
          obj = {
            foo: 'bar',
            arr: ['a', 'b', 'c']
          }

    JSON.stringify(qs.parse(qs.unescape(qs.escape(qs.stringify(obj))))).should.equal(JSON.stringify(obj))

    return true
  }
}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
