'use strict'

const server = require('../../lib/server'),
      should = require('should')

describe('Rest Api', function() {

  describe('Script Runner', function() {

    let script = { 'script': "let value = {name: 'person',age:23,country:'US'};return value;", 'language': 'javascript', 'specification': 'es6' }

    it('should run script', function(callback) {
      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set(server.getSessionHeaders())
        .send(script)
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'result')
          should.exist(result.data)
          result.data.name.should.equal('person')
          result.data.age.should.equal(23)
          result.data.country.should.equal('US')
          callback()
        })
    })

    it('should fail to run script', function(callback) {
      server.sessions.patient
        .post(server.makeEndpoint('/sys/script_runner'))
        .set(server.getSessionHeaders())
        .send(script)
        .done(function(err, result) {
          should.exist(err)
          should.exist(result)
          err.code.should.equal('kAccessDenied')
          callback()
        })
    })

  })

})
