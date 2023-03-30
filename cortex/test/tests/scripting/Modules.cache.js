'use strict'

module.exports = {

  main: function() {

    const should = require('should'),
          cache = require('cache')

    cache.set('TestKey1', 'TestVal1')
    cache.set('TestKey2', 'TestVal2')

    cache.get('TestKey1').should.equal('TestVal1')
    cache.get('TestKey2').should.equal('TestVal2')
    should.not.exist(cache.get('NonExistant6541'))

    cache.has('TestKey1').should.equal(true)
    cache.has('NonExistant6541').should.equal(false)

    cache.find('Test').length.should.equal(2)
    cache.find('NonExistant6541').length.should.equal(0)

    cache.count('Test').should.equal(2)
    cache.count('NonExistant6541').should.equal(0)

    cache.list('Test').total.should.equal(2)

    cache.cas('TestKey1', 'TestVal1', 'TestVal3')
    cache.get('TestKey1').should.equal('TestVal3')
    cache.cas('TestKey1', 'TestVal1', 'TestVal4')
    cache.get('TestKey1').should.equal('TestVal3')

    cache.del('TestKey1')
    cache.count('Test').should.equal(1)

    cache.clear()
    cache.count('Test').should.equal(0)

    return true
  }
}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
