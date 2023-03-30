'use strict'

const server = require('../../lib/server'),
      should = require('should')

describe('Rest Api', function() {

  describe('Stats', function() {

    describe('GET /stats', function() {

      it('should list stats', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/stats?limit=1'))
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
