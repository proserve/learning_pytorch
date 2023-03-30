'use strict'

const server = require('../../lib/server'),
      supertest = require('supertest'),
      should = require('should'),
      Fault = require('cortex-service/lib/fault'),
      utils = require('../../../lib/utils')

describe('Rest Api', function() {

  describe('Request Signing', function() {

    it('should fail with kAccessDenied', function(callback) {

      supertest(server.api.expressApp)
        .post('/test-org/accounts/login')
        .set(server.getSignedHeaders('/accounts/login', 'POST'))
        .send({})
        .end(function(err, result) {
          if (!err) {
            err = Fault.from(utils.path(result, 'body'))
          }
          should.exist(err)
          err.code.should.equal('kAccessDenied')
          callback()
        })
    })

    it('mismatched path should fail with cortex.accessDenied.invalidRequestSignature', function(callback) {
      supertest(server.api.expressApp)
        .get('/test-org/patientfiles').set(server.getSignedHeaders('not quite right', 'GET'))
        .end(function(err, result) {
          if (!err) err = Fault.from(utils.path(result, 'body'))
          should.exist(err)
          err.errCode.should.equal('cortex.accessDenied.invalidRequestSignature')
          callback()
        })
    })
    it('mismatched method should fail with cortex.accessDenied.invalidRequestSignature', function(callback) {
      supertest(server.api.expressApp)
        .get('/test-org/patientfiles').set(server.getSignedHeaders('/patientfiles', 'POST'))
        .end(function(err, result) {
          if (!err) err = Fault.from(utils.path(result, 'body'))
          should.exist(err)
          err.errCode.should.equal('cortex.accessDenied.invalidRequestSignature')
          callback()
        })
    })
    it('bad signature should fail with cortex.accessDenied.invalidRequestSignature', function(callback) {
      supertest(server.api.expressApp)
        .get('/test-org/patientfiles').set(server.getSignedHeaders('/patientfiles', 'GET', { signature: 'what the heck is a bronie?' }))
        .end(function(err, result) {
          if (!err) err = Fault.from(utils.path(result, 'body'))
          should.exist(err)
          err.errCode.should.equal('cortex.accessDenied.invalidRequestSignature')
          callback()
        })
    })
    it('bad secret should fail with cortex.accessDenied.invalidRequestSignature', function(callback) {
      supertest(server.api.expressApp)
        .get('/test-org/patientfiles').set(server.getSignedHeaders('/patientfiles', 'GET', { secret: 'pssst!' }))
        .done(function(err) {
          should.exist(err)
          err.errCode.should.equal('cortex.accessDenied.invalidRequestSignature')
          callback()
        })
    })
    it('bad key should fail with kNotFound', function(callback) {
      supertest(server.api.expressApp)
        .get('/test-org/patientfiles').set(server.getSignedHeaders('/patientfiles', 'GET', { key: 'hey hey' }))
        .done(function(err) {
          should.exist(err)
          err.errCode.should.equal('cortex.notFound.app')
          callback()
        })
    })
    it('stale request should fail with cortex.invalidArgument.staleRequestSignature', function(callback) {
      supertest(server.api.expressApp)
        .get('/test-org/patientfiles').set(server.getSignedHeaders('/patientfiles', 'GET', { timestamp: Date.now() - 86400000 }))
        .done(function(err) {
          should.exist(err)
          err.errCode.should.equal('cortex.invalidArgument.staleRequestSignature')
          callback()
        })
    })
    it('future request should fail with cortex.invalidArgument.staleRequestSignature', function(callback) {
      supertest(server.api.expressApp)
        .get('/test-org/patientfiles').set(server.getSignedHeaders('/patientfiles', 'GET', { timestamp: Date.now() + 86400000 }))
        .done(function(err) {
          should.exist(err)
          err.errCode.should.equal('cortex.invalidArgument.staleRequestSignature')
          callback()
        })
    })
    it('invalid nonce should fail with cortex.accessDenied.invalidRequestSignature', function(callback) {
      supertest(server.api.expressApp)
        .get('/test-org/patientfiles').set(server.getSignedHeaders('/patientfiles', 'GET', { nonce: 'nope' }))
        .done(function(err) {
          should.exist(err)
          err.errCode.should.equal('cortex.accessDenied.invalidRequestSignature')
          callback()
        })
    })
    it('replay (nonce test) should fail with cortex.accessDenied.invalidRequestSignature', function(callback) {
      var headers = server.getSignedHeaders('/patientfiles', 'GET')
      supertest(server.api.expressApp)
        .get('/test-org/patientfiles').set(headers)
        .done(function() {
          supertest(server.api.expressApp)
            .get('/test-org/patientfiles').set(headers)
            .done(function(err) {
              should.exist(err)
              err.errCode.should.equal('cortex.accessDenied.invalidRequestSignature')
              callback()
            })
        })
    })
    it('signed request should succeed', function(callback) {
      var headers = server.getSignedHeaders('/patientfiles', 'GET')
      supertest(server.api.expressApp)
        .get('/test-org/patientfiles').set(headers)
        .done(function(err) {
          should.not.exist(err)
          callback()
        })
    })
  })

})
