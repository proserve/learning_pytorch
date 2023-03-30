'use strict'

const server = require('../../lib/server'),
      should = require('should'),
      async = require('async'),
      acl = require('../../../lib/acl'),
      modules = require('../../../lib/modules')

describe('Issues', function() {

  describe('CTXAPI-32 - Token privilege escalation', function() {

    let script = { script: 'return require("request").headers', language: 'javascript', specification: 'es6' },
        tokens = null

    before(function(callback) {

      async.parallel({

        normal: callback => modules.authentication.createToken(
          new acl.AccessContext(server.principals.admin),
          server.principals.admin.email,
          server.sessionsClient.key, {
            scope: ['*']
          }, callback),

        privileged: callback => modules.authentication.createToken(
          new acl.AccessContext(server.principals.admin),
          server.principals.admin.email,
          server.sessionsClient.key, {
            isSupportLogin: true,
            scope: ['*']
          }, callback)

      }, (err, t) => {
        tokens = t
        callback(err)
      })

    })

    it('script using a privileged token should not expose the authorization header.', function(callback) {

      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set({ Authorization: `Bearer ${tokens.privileged.token}` })
        .send(script)
        .done(function(err, result) {

          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'result')
          should.exist(result.data)
          should.exist(result.data)
          should.not.exist(result.data.authorization)
          callback()
        })

    })

    it('script using a normal token should expose the authorization header.', function(callback) {

      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set({ Authorization: `Bearer ${tokens.normal.token}` })
        .send(script)
        .done(function(err, result) {

          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'result')
          should.exist(result.data)
          should.exist(result.data)
          should.exist(result.data.authorization)
          result.data.authorization.should.equal(`Bearer ${tokens.normal.token}`)
          callback()
        })

    })

  })

})
