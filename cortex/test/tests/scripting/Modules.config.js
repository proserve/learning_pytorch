'use strict'

const wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  main: function() {

    const should = require('should'),
          config = require('config'),
          tryCatch = require('util.values').tryCatch

    config('me', { foo: 'bar' })
    config('me.foo', 'baz')
    config('me.cake', { eat: 'it', too: 'yes!' })

    should.equal('baz', config('me.foo'))
    should.equal('yes!', config('me.cake.too'))

    tryCatch(function() {
      config('bad.$key', 1)
    }, function(err) {
      if (!err || err.errCode !== 'cortex.invalidArgument.dollarPrefixedDbKey') {
        throw err
      }
    })

    tryCatch(function() {
      config('bad', { $value: 'gaah!' })
    }, function(err) {
      if (!err || err.errCode !== 'cortex.invalidArgument.dollarPrefixedDbKey') {
        throw err
      }
    })

    tryCatch(function() {
      config('too', '1'.repeat(1024 * 256))
    }, function(err) {
      if (!err || !err.reason.includes('maximum')) {
        throw err
      }
    })

    return true
  }
}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
