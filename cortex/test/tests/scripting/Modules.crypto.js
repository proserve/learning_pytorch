'use strict'

module.exports = {

  main: function() {

    require('should')

    const crypto = require('crypto'),
          smallString = 'ahoy hoy!'

    let bigString = ''

    while (bigString.length < 8192) {
      bigString += 'hold me thrill me repeat me' // exercise chunk size of crypto module
    }

    ['md5', 'sha1', 'sha256', 'sha512'].forEach(function(algo) {

      const hmac = algo + 'Hmac'

      crypto[algo](smallString).should.equal(crypto[algo](smallString))
      crypto[algo](bigString).should.equal(crypto[algo](bigString))

      // not a string
      try {
        crypto[algo]({ whoop: 'sie-daisy' })
      } catch (err) {}

      crypto[hmac](smallString, 'secret').should.equal(crypto[hmac](smallString, 'secret'))
      crypto[hmac](bigString, 'secret').should.equal(crypto[hmac](bigString, 'secret'))

      crypto[hmac](smallString, 'secret').should.not.equal(crypto[hmac](smallString, 'not it'))

    })

    return true

  }
}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
