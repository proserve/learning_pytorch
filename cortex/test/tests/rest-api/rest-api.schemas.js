'use strict'

const server = require('../../lib/server'),
      should = require('should'),
      acl = require('../../../lib/acl')

server.usingMedia = true

describe('Rest Api', function() {

  describe('Schemas', function() {

    describe('GET /schemas', function() {

      it('should list schemas', function(callback) {
        server.sessions.provider
          .get(server.makeEndpoint('/schemas'))
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

    describe('GET /schemas/:object', function() {

      it('should list built-in conversation', function(callback) {
        server.sessions.provider
          .get(server.makeEndpoint('/schemas/conversation'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'schema')
            should.equal(result.name, 'conversation')
            callback()
          })
      })

      it('should list custom object schema', function(callback) {
        'use strict'

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err) => {
          if (err) return callback(err)
          server.sessions.provider
            .get(server.makeEndpoint('/schemas/c_script_mod_obj_stream_test'))
            .set(server.getSessionHeaders())
            .done(function(err, result) {
              should.not.exist(err)
              should.exist(result)
              should.equal(result.object, 'schema')
              should.equal(result.name, 'c_script_mod_obj_stream_test')
              callback()
            })
        })
      })

    })

    describe('GET /schemas/:object/*', function() {

      it('should list a schema property', function(callback) {
        server.sessions.provider
          .get(server.makeEndpoint('/schemas/c_script_mod_obj_stream_test/pluralName'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'result')
            should.equal(result.data, 'c_script_mod_obj_stream_tests')
            callback()
          })
      })

    })

  })

})
