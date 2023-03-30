'use strict'

module.exports = {

  main: function() {

    require('should')

    const counters = require('counters')

    counters.clear('Counters.')
    counters.has('Counters.Test').should.equal(false)
    counters.next('Counters.Test').should.equal(counters.next('Counters.Test') - 1)
    counters.get('Counters.Test').should.equal(2)
    counters.next('Counters.Test2').should.equal(1)
    counters.list('Counters').data.length.should.equal(2)
    counters.count('Counters.Test2').should.equal(1)
    counters.clear('Counters.Testss').should.equal(0)
    counters.clear('Counters').should.equal(2)
    counters.next('Counters.Foo').should.equal(1)
    counters.next('Counters.Bar').should.equal(1)
    counters.del('Counters').should.equal(false)
    counters.del('Counters.Foo').should.equal(true)
    counters.count('Counters.').should.equal(1)
    counters.clear('Counters.')
    counters.count('Counters.').should.equal(0)

    return true
  }
}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
