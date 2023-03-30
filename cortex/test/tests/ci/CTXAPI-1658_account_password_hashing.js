'use strict'

const Fault = require('cortex-service/lib/fault'),
      should = require('should'),
      { promised } = require('../../../lib/utils'),
      modules = require('../../../lib/modules'),
      server = require('../../lib/server'),
      ap = require('../../../lib/access-principal'),
      acl = require('../../../lib/acl'),
      authentication = require('../../../lib/modules/authentication'),
      bcrypt = require('bcrypt')

describe('account password hashing', function() {

  const password = 'test1234!@#ABC',
        anotherPassword = 'test5678%^&*DEF'

  describe('authentication module hashPassword', function() {

    let hashedPassword
    
    before(function(done) {
      authentication.hashPassword(password, (err, result) => {
        if (err) {
          throw Fault.create()
        } else if (result) {
          hashedPassword = result
          done()
        }
      })
    })

    it('creates 60 character hash of password', function() {
      hashedPassword.length.should.equal(60)
    }) 

    it('hashed password matches original password', async function() {
      const match = await bcrypt.compare(password, hashedPassword)
      match.should.be.true()
    }) 

    it('hashed password does not match other passwords', async function() {
      const match = await bcrypt.compare(anotherPassword, hashedPassword)
      match.should.be.false()
    })

  })

  describe('hashed password stored in database', function() {

    let account,
        storedPassword

    before(async function() {
      // create an account
      const principal = ap.synthesizeOrgAdmin(server.org, acl.SystemAdmin),
            { org } = server,
            options = {
              requireEmail: false,
              requireMobile: false
            },
            payload = {
              email: `test_user@medable.com`,
              name: {
                first: 'Drew',
                last: 'Holbrook'
              },
              password,
              locale: 'en_US'
            }
      account = await promised(modules.accounts, 'createAccount', principal, payload, org, 'en_US', 'unverified', null, null, options)
      storedPassword = account.password
    })

    it('does not store plain text password in the database', function() {
      storedPassword.should.not.equal(password)
    })

    it('stores 60 character hash of password in the database', function() {
      storedPassword.length.should.equal(60)
    })

    it('stored hashed password matches the original password', async function() {
      const match = await bcrypt.compare(password, storedPassword)
      match.should.be.true()
    })

    it('stored hashed password does not match other passwords', async function() {
      const match = await bcrypt.compare(anotherPassword, storedPassword)
      match.should.be.false()
    })

  })

})
