'use strict'

const server = require('../../lib/server'),
      should = require('should'),
      ap = require('../../../lib/access-principal'),
      utils = require('../../../lib/utils')

describe('Lib', function() {

  describe('Access Principal', function() {

    it('ap.create should fail', function(callback) {
      ap.create(server.org, null, err => {
        should.exist(err)
        should.equal(err.errCode, 'cortex.notFound.account')
        callback()
      })
    })

    it('ap.create with ambiguous account id should succeed', function(callback) {
      ap.create(server.org, server.principals.unverified._id, (err, principal) => {
        should.not.exist(err)
        should.equal(ap.is(principal), true, 'expecting instance of account principal')
        callback()
      })
    })

    it('ap.create with ambiguous missing id should fail', function(callback) {
      ap.create(server.org, utils.createId(), (err, principal) => {
        should.exist(err)
        callback()
      })
    })

    it('ap.create with email address should succeed', function(callback) {
      ap.create(server.org, server.principals.unverified.email, (err, principal) => {
        should.not.exist(err)
        should.equal(ap.is(principal), true, 'expecting instance of account principal')
        callback()
      })
    })

    it('ap.create with missing email address should fail', function(callback) {
      ap.create(server.org, 'missing@example.com', (err, principal) => {
        should.exist(err)
        callback()
      })
    })

  })

})
