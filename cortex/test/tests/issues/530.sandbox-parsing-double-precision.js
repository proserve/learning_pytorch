'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('530 - Sandbox double precision.', function() {

    it('should parse a double precision number to full precision.', sandboxed(function() {

      require('should')

      const number = 1.9149631915063414

      require('debug').echo(number).should.equal(number)

    }))

  })

})
