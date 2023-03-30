'use strict'

const server = require('../../lib/server'),
      should = require('should')

describe('Rest Api', function() {

  describe('Api', function() {

    describe('GET /', function() {

      it('should return public info', function(callback) {
        server.sessions.provider
          .get(server.makeEndpoint('/'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.object)
            should.equal(result.object, 'org')
            callback()
          })
      })

    })

    describe('GET /status', function() {

      it('should return api status', function(callback) {
        server.sessions.provider
          .get(server.makeEndpoint('/status'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.data.status, 'healthy', 'api status')
            should.equal(result.data.maintenance, false, 'maintenance mode')
            callback()
          })
      })

    })

  })

})
