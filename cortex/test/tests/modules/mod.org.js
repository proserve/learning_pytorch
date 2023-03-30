'use strict'

const server = require('../../lib/server'),
      should = require('should'),
      modules = require('../../../lib/modules')

describe('Modules', function() {

  describe('Org', function() {

    describe('Accounts', function() {

      it('should read account', function(done) {

        modules.org.readAccount(server.principals.admin, server.principals.admin._id, (err, output) => {
          should.not.exist(err)
          output.email.should.equal(server.principals.admin.email)
          done()
        })

      })

      it('should list accounts', function(done) {
        let req = {
          principal: server.principals.admin,
          org: server.org,
          query: {
            total: false,
            search: 'james'
          }
        }

        modules.org.listAccounts(req.principal, { ...req.query, req }, (err, output) => {
          should.not.exist(err)
          output.data.length.should.equal(4)
          done()
        })

      })

      it('should list accounts with search', function(done) {
        let req = {
          principal: server.principals.admin,
          org: server.org,
          query: {
            total: false,
            search: 'james+admin'
          }
        }

        modules.org.listAccounts(req.principal, { ...req.query, req }, (err, output) => {
          should.not.exist(err)
          output.data.length.should.equal(1)
          done()
        })

      })

    })

  })

})
