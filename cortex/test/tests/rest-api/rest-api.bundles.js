'use strict'

const server = require('../../lib/server'),
      should = require('should')

describe('Rest Api', function() {

  describe('Bundles', function() {

    describe('GET /bundles/:locale/:version?', function() {

      it('should deep equal stub', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/bundles/en_US/0'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'result')
            should.deepEqual(result.data, {
              result: {
                locale: 'en_US',
                org: server.org._id.toString(),
                version: 0
              }
            })
            callback()
          })
      })

    })

  })

})
