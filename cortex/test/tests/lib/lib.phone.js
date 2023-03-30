'use strict'

require('should')

describe('Lib', function() {

  describe('Phone', function() {

    const phone = require('../../../lib/modules/phone')

    it('countryForE164Number', function() {
      phone.countryForE164Number('+15146842839').should.equal('CA')
      phone.countryForE164Number('what?').should.equal('')
    })

    it('isValidNumber', function() {
      phone.isValidNumber('+15146842839').should.equal(true)
      phone.isValidNumber('+15146842839', 'CA').should.equal(true)
      phone.isValidNumber('+15555555555').should.equal(false)
      phone.isValidNumber('what?').should.equal(false)
    })

    it('cleanPhone', function() {
      phone.cleanPhone('moeuhdmr@#R@#D+151468+4kjfghskjfhwjk fsdhjks2839').should.equal('+15146842839')
    })

  })

})
