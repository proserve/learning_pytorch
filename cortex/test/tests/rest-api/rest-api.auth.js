'use strict'

/* global before, after */

const server = require('../../lib/server'),
      supertest = require('supertest'),
      should = require('should'),
      async = require('async'),
      consts = require('../../../lib/consts'),
      modules = require('../../../lib/modules'),
      utils = require('../../../lib/utils')

describe('Rest Api', function() {

  describe('Auth', function() {

    let agent

    // make sure we allow simultaneous logins
    before(function(callback) {
      agent = supertest.agent(server.api.expressApp)
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.allowSimultaneousLogins': true } }, () => {
        server.updateOrg(callback)
      })
    })
    after(function(callback) {
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.allowSimultaneousLogins': false } }, () => {
        server.updateOrg(callback)
      })
    })

    // --------------------------------------------------------------------------

    function doLogin(payload, callback) {
      agent
        .post('/test-org/accounts/login')
        .set(server.getSessionHeaders())
        .send(payload)
        .done(callback)
    }

    function doLoginWithToken(payload, callback) {
      agent
        .post('/test-org/accounts/login')
        .set(server.getSessionHeaders())
        .send(payload)
        .done((err, result) => {

          if (!err || err.errCode !== 'cortex.success.newLocation') {
            return callback(err, result)
          }

          modules.db.models.Callback.findOne({ handler: 'ver-location', target: payload.email }).lean().select({ token: 1 }).exec(function(err, ver) {
            void err
            doLogin({ ...payload, location: { verificationToken: ver && ver.token } }, function(err, result) {
              callback(err, result)
            })
          })

        })
    }

    function doLogout(callback) {
      agent
        .post('/test-org/accounts/me/logout')
        .set(server.getSessionHeaders())
        .done(callback)
    }

    describe('GET /accounts/login', function() {

      it('bad or missing credentials should fail with kInvalidCredentials', function(callback) {
        doLogin({}, function(err) {
          should.exist(err)
          err.code.should.equal('kInvalidCredentials')
          callback()
        })
      })

      it('signing a login request should fail with kAccessDenied', function(callback) {

        supertest(server.api.expressApp)
          .post('/test-org/accounts/login')
          .set(server.getSignedHeaders('/accounts/login', 'POST'))
          .send({})
          .done(function(err) {
            should.exist(err)
            err.code.should.equal('kAccessDenied')
            callback()
          })
      })

      it('using a signing key as a session key should fail with cortex.accessDenied.invalidRequestSignature', function(callback) {

        supertest(server.api.expressApp)
          .post('/test-org/accounts/login')
          .set(server.getSessionHeaders({ key: server.signingClient.key }))
          .send({})
          .done(function(err) {
            should.exist(err)
            err.errCode.should.equal('cortex.accessDenied.invalidRequestSignature')
            callback()
          })
      })

      let token

      it('login to new location', function(callback) {

        async.series(
          [
            callback => {

              doLogin({ email: server.principals.patient.email, password: server.password }, function(err) {
                should.exist(err)
                err.errCode.should.equal('cortex.success.newLocation')
                modules.db.models.Callback.findOne({ handler: 'ver-location', target: server.principals.patient.email }).lean().select({ token: 1 }).exec(function(err, ver) {
                  should.not.exist(err)
                  should.exist(ver)
                  should.exist(ver.token)
                  token = ver.token
                  callback()
                })
              })

            },

            callback => {

              // logging into an unverified location should fail with cortex.accessDenied.unverifiedLocation
              doLogin({ email: server.principals.patient.email, password: server.password }, function(err) {
                should.exist(err)
                err.errCode.should.equal('cortex.accessDenied.unverifiedLocation')
                callback()
              })
            },

            callback => {

              // logging into an unverified location with a bad token format should fail with cortex.invalidArgument.locationToken
              doLogin({ email: server.principals.patient.email, password: server.password, location: { verificationToken: 'bad token' } }, function(err) {
                should.exist(err)
                err.errCode.should.equal('cortex.invalidArgument.locationToken')
                callback()
              })
            },

            callback => {

              // logging into an unverified location with a bad token should fail with cortex.invalidArgument.locationToken
              doLogin({ email: server.principals.patient.email, password: server.password, location: { verificationToken: '123456' } }, function(err) {
                should.exist(err)
                err.errCode.should.equal('cortex.invalidArgument.locationToken')
                callback()
              })
            },

            callback => {

              // using a verification token should login successfully
              doLogin({ email: server.principals.patient.email, password: server.password, location: { verificationToken: token } }, function(err, account) {
                should.not.exist(err)
                should.exist(account)
                should.exist(account._id)
                callback()
              })

            },

            callback => {

              // after having been verified, should login successfully once again
              doLogin({ email: server.principals.patient.email, password: server.password }, function(err, account) {
                should.not.exist(err)
                should.exist(account)
                should.exist(account._id)
                callback()
              })

            }

          ],
          callback
        )

      })

    })

    describe('POST /accounts/me/logout', function() {

      it('should logout successfully if logged in', function(callback) {
        doLoginWithToken({ email: server.principals.patient.email, password: server.password }, function(err) {
          should.not.exist(err)
          agent
            .post('/test-org/accounts/me/logout')
            .set(server.getSessionHeaders())
            .done(function(err, result) {
              should.not.exist(err)
              should.exist(result)
              utils.path(result, 'data').should.equal(true)
              callback()
            })
        })

      })

      it('should logout successfully if not logged in', function(callback) {
        doLogout(function() {
          agent
            .post('/test-org/accounts/me/logout')
            .set(server.getSessionHeaders())
            .done(function(err, result) {
              should.not.exist(err)
              should.exist(result)
              utils.path(result, 'data').should.equal(false)
              callback()
            })
        })

      })

    })

    var passwordResetToken

    describe('POST /accounts/request-password-reset', function() {

      it('an invalid email address should fail with cortex.invalidArgument.emailFormat', function(callback) {
        agent
          .post('/test-org/accounts/request-password-reset')
          .set(server.getSessionHeaders())
          .send({ email: 'bad email' })
          .done(function(err) {
            should.exist(err)
            err.errCode.should.equal('cortex.invalidArgument.emailFormat')
            callback()
          })
      })

      it('a missing user email address should not fail', function(callback) {
        agent
          .post('/test-org/accounts/request-password-reset')
          .set(server.getSessionHeaders())
          .send({ email: 'nobody@example.org' })
          .done(function(err) {
            should.not.exist(err)
            callback()
          })
      })

      it('a valid email should trigger an email send and password reset token message creation', function(callback) {

        async.series([

          // trigger an email
          function(callback) {

            agent
              .post('/test-org/accounts/request-password-reset')
              .set(server.getSessionHeaders())
              .send({ email: server.principals.patient.email })
              .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                utils.path(result, 'data').should.equal(true)
                callback()
              })

          },

          // look for the callback
          function(callback) {
            modules.db.models.Callback.findOne({ handler: consts.callbacks.pass_reset, targetId: server.principals.patient._id }).exec(function(err, doc) {
              should.not.exist(err)
              should.exist(doc)
              passwordResetToken = doc.token
              callback()
            })
          }

        ], callback)

      })

    })

    describe('POST /accounts/reset-password', function() {

      it('an invalid token format should fail with kInvalidArgument', function(callback) {
        agent
          .post('/test-org/accounts/reset-password')
          .set(server.getSessionHeaders())
          .send({ token: 'bad token' })
          .done(function(err) {
            should.exist(err)
            err.errCode.should.equal('cortex.notFound.passwordResetToken')
            callback()
          })
      })

      it('an invalid token should fail with kNotFound', function(callback) {
        agent
          .post('/test-org/accounts/reset-password')
          .set(server.getSessionHeaders())
          .send({ token: '3jMJ1WqJNlmIPH0pJjeU2L8VhQ4sGzef' })
          .done(function(err) {
            should.exist(err)
            err.errCode.should.equal('cortex.notFound.passwordResetToken')
            callback()
          })
      })

      it('a weak password should fail with kValidationError', function(callback) {
        agent
          .post('/test-org/accounts/reset-password')
          .set(server.getSessionHeaders())
          .send({ token: passwordResetToken, password: 'weak' })
          .done(function(err) {
            should.exist(err)
            err.code.should.equal('kValidationError')
            should.exist(err.faults)
            err.faults[0].code.should.equal('kInvalidArgument')
            err.faults[0].path.should.equal('account.password')
            callback()
          })
      })

      it('a valid reset should succeed', function(callback) {
        agent
          .post('/test-org/accounts/reset-password')
          .set(server.getSessionHeaders())
          .send({ token: passwordResetToken, password: server.password })
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            utils.path(result, 'data').should.equal(true)
            callback()
          })
      })

    })

  })

})
