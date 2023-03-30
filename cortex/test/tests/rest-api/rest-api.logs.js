'use strict'

const server = require('../../lib/server'),
      should = require('should')

describe('Rest Api', function() {

  describe('Logs', function() {

    describe('GET /logs', function() {

      it('should list logs', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/logs?limit=1'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.exist(result.data)
            callback()
          })
      })

    })

  })

})
