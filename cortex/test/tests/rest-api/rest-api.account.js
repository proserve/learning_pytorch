'use strict'

const server = require('../../lib/server'),
      sandboxed = require('../../lib/sandboxed'),
      supertest = require('supertest'),
      should = require('should'),
      async = require('async'),
      consts = require('../../../lib/consts'),
      modules = require('../../../lib/modules'),
      testUtils = require('../../lib/utils')()

describe('Rest Api', function() {

  let accountId

  const testAccount = {
          email: 'tester@example.com',
          password: 'testPa$$word123',
          name: {
            first: 'Test',
            last: 'Tester'
          },
          username: 'tester',
          mobile: '+15055555555'
        },
        testAccountLoginPayload = {
          email: testAccount.email,
          password: testAccount.password
        }

  // make sure we allow simultaneous logins
  before(function(callback) {
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.allowSimultaneousLogins': true } }, () => {
      server.updateOrg(callback)
    })
  })
  after(function(callback) {
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.allowSimultaneousLogins': false } }, () => {
      server.updateOrg(callback)
    })
  })

  // create account
  before(function(done) {

    async.series([

      // login
      callback => {
        supertest(server.api.expressApp)
          .post(server.makeEndpoint('/accounts/register'))
          .set(server.getSessionHeaders())
          .send(testAccount)
          .done(function(err, res) {
            should.not.exist(err)
            accountId = res._id
            callback()
          })
      },

      // verify
      callback => {
        modules.db.models.Account.updateOne({ _id: accountId }, {
          $set: {
            state: 'verified'
          }
        }, callback)
      }

    ], done)

  })

  // delete account
  after(sandboxed(function() {
    /* global org */
    org.objects.accounts.deleteOne({ email: 'tester@example.com' }).skipAcl().grant(8).execute()
  }))

  function doLogin(agent, payload, callback) {
    agent
      .post('/test-org/accounts/login')
      .set(server.getSessionHeaders())
      .send(payload)
      .done(callback)
  }

  function doLoginWithToken(agent, payload, callback) {
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
          doLogin(agent, { ...payload, location: { verificationToken: ver && ver.token } }, function(err, result) {
            callback(err, result)
          })
        })
      })
  }

  describe('Accounts', function() {

    describe('GET /accounts/me', function() {

      it('logged in account should return the current account', function(callback) {
        const agent = supertest.agent(server.api.expressApp)
        doLoginWithToken(agent, { email: server.principals.provider.email, password: server.password }, function(err) {
          should.not.exist(err)
          agent
            .get('/test-org/accounts/me')
            .set(server.getSessionHeaders())
            .done(function(err, result) {
              should.not.exist(err)
              should.exist(result)
              should.exist(result._id)
              callback()
            })
        })

      })

      it('signed call should return the current account', function(callback) {

        server.sessions.provider
          .get('/test-org/accounts/me')
          .set(server.getSignedHeaders('/accounts/me', 'GET', { principal: server.principals.provider._id }))
          .done(function(err, account) {
            should.not.exist(err)
            should.exist(account)
            should.exist(account._id)
            callback()
          })
      })

      it('anonymous call should fail with cortex.accessDenied.notLoggedIn', function(callback) {
        // we need a valid fingerprint.
        const agent = supertest.agent(server.api.expressApp),
              cookies = server.sessions.provider.jar.getCookies({ path: '/' }).filter(function(v) {
                return v.name === 'md.fingerprint'
              })
        agent.jar.setCookie(cookies[0])
        agent
          .get('/test-org/accounts/me')
          .set({ 'Medable-Client-Key': server.sessionsClient.key })
          .done(function(err) {
            should.exist(err)
            err.errCode.should.equal('cortex.accessDenied.notLoggedIn')
            callback()
          })
      })

    })

    describe('GET /accounts/status', function() {

      it('logged in account should return the current account', function(done) {

        const agent = supertest.agent(server.api.expressApp)

        async.series([

          // login
          callback => {
            doLoginWithToken(agent, testAccountLoginPayload, callback)
          },

          // test
          callback => {

            agent
              .get(server.makeEndpoint('/accounts/status/?expand=true'))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.exist(result.data)
                should.equal(result.data.loggedin, true)
                should.exist(result.data.account)
                should.equal(result.data.account._id, accountId.toString())
                callback()
              })

          }

        ], (testErr) => {

          // logout
          agent
            .post('/test-org/accounts/me/logout')
            .set(server.getSessionHeaders())
            .done(function(logoutErr, result) {
              should.not.exist(testErr)
              should.not.exist(logoutErr)
              done()
            })

        })

      })

      it('anonymous account should show as !loggedin', function(callback) {

        const agent = supertest.agent(server.api.expressApp)

        agent
          .get('/test-org/accounts/status')
          .set({ 'Medable-Client-Key': server.sessionsClient.key })
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.data.loggedin, false)
            should.not.exist(result.data.account)
            callback()
          })
      })

    })

    describe('GET /accounts/me/resend-verification', function() {

      it('should fail if already verified', function(done) {

        const agent = supertest.agent(server.api.expressApp)

        async.series([

          // login
          callback => {
            doLoginWithToken(agent, testAccountLoginPayload, callback)
          },

          // test
          callback => {

            agent
              .post(server.makeEndpoint('/accounts/me/resend-verification'))
              .set(server.getSessionHeaders())
              .done(function(err) {
                console.log(err)
                should.exist(err)
                should.equal(err.errCode, 'cortex.conflict.accountAlreadyVerified')
                callback()
              })

          }

        ], (testErr) => {

          // logout
          agent
            .post('/test-org/accounts/me/logout')
            .set(server.getSessionHeaders())
            .done(function(logoutErr, result) {
              should.not.exist(testErr)
              should.not.exist(logoutErr)
              done()
            })

        })

      })

      it('should fail as anonymous', function(callback) {

        supertest(server.api.expressApp)
          .post(server.makeEndpoint('/accounts/me/resend-verification'))
          .set(server.getSessionHeaders())
          .done(function(err) {
            should.exist(err)
            callback()
          })
      })

      it('should succeed', function(callback) {

        const agent = supertest.agent(server.api.expressApp)
        doLoginWithToken(agent, { email: 'james+unverified@medable.com', password: server.password }, function(err) {
          should.not.exist(err)
          agent
            .post(server.makeEndpoint('/accounts/me/resend-verification'))
            .set(server.getSessionHeaders())
            .done(function(err, result) {
              should.not.exist(err)
              should.equal(result.data, true)
              callback()
            })
        })
      })

    })

    const accountInput = {
      name: {
        first: 'Reg',
        last: 'Me'
      },
      email: 'reg.me@example.com',
      password: 'DwUTqKdpChDrY8dTdpsGcA7Dk9C6urN2',
      mobile: '+16049892489'
    }
    let accountJson, newUserAgent

    describe('POST /accounts/register', function() {

      it('should register, then activate, then sign-in as a new account, and update the password', function(callback) {

        newUserAgent = supertest.agent(server.api.expressApp)

        async.series([

          // register the account
          callback => {

            newUserAgent
              .post(server.makeEndpoint('/accounts/register'))
              .set(server.getSessionHeaders())
              .send(accountInput)
              .done(function(err, result) {
                should.not.exist(err)
                should.equal(result.object, 'account')
                should.equal(result.state, 'unverified')
                accountJson = result
                callback()
              })

          },

          // grab the token and verify the account.
          callback => {

            modules.db.models.Callback.findOne({
              handler: consts.callbacks.ver_acct,
              target: 'reg.me@example.com'
            }, (err, cb) => {

              should.not.exist(err)
              should.exist(cb)

              newUserAgent
                .post(server.makeEndpoint('/accounts/' + cb.token))
                .set(server.getSessionHeaders())
                .done(function(err) {
                  should.not.exist(err)
                  callback()
                })

            })

          },

          // loading the account should show as verified.
          callback => {

            newUserAgent
              .get(server.makeEndpoint('/accounts/me'))
              .set(server.getSessionHeaders())
              .done(function(err, account) {
                should.not.exist(err)
                should.exist(account)
                should.equal(account._id, accountJson._id)
                callback()
              })

          },

          callback => {

            const update = {
              current: accountInput.password,
              password: 'cee6ZRFkiWLGoqvYefM3tzbAvw727vYt'
            }

            newUserAgent
              .post(server.makeEndpoint('/accounts/me/update-password'))
              .set(server.getSessionHeaders())
              .send(update)
              .done(function(err) {
                should.not.exist(err)
                callback()
              })

          }

        ], callback)

      })

      it('should accept loginMethods parameter', async function() {
        const newUserAgent = supertest.agent(server.api.expressApp),
              payload = {
                name: {
                  first: 'Test',
                  last: 'Account'
                },
                email: 'test.account@medable.com',
                password: 'myPa$$word123',
                mobile: '15055555555',
                loginMethods: ['credentials']
              },
              response = await newUserAgent
                .post(server.makeEndpoint('/accounts/register'))
                .set(server.getSessionHeaders())
                .send(payload)

        should.equal(response.body.object, 'account')
        response.body.loginMethods.should.containDeep(['credentials'])

        await testUtils.deleteInstance('accounts', response.body._id)
      })

    })

    describe('POST /accounts/request-password-reset', function() {

      // enable username
      before(function(callback) {
        modules.db.sequencedUpdate(
          server.org.constructor, {
            _id: server.org._id
          }, {
            $set: {
              'configuration.accounts.enableUsername': true
            }
          }, () => {
            server.updateOrg(callback)
          })
      })

      // disable username
      after(function(callback) {
        modules.db.sequencedUpdate(
          server.org.constructor, {
            _id: server.org._id
          }, {
            $set: {
              'configuration.accounts.enableUsername': false
            }
          }, () => {
            server.updateOrg(callback)
          })
      })

      it('should return successfully using account ID', function(done) {

        supertest(server.api.expressApp)
          .post(server.makeEndpoint('/accounts/request-password-reset'))
          .set(server.getSessionHeaders())
          .send({ accountId })
          .done(function(err, res) {
            should.not.exist(err)
            should.equal(res.object, 'result')
            should.equal(res.data, true)
            done()
          })

      })

      it('should return successfully using email', function(done) {

        supertest(server.api.expressApp)
          .post(server.makeEndpoint('/accounts/request-password-reset'))
          .set(server.getSessionHeaders())
          .send({ email: testAccount.email })
          .done(function(err, res) {
            should.not.exist(err)
            should.equal(res.object, 'result')
            should.equal(res.data, true)
            done()
          })

      })

      it('should return successfully using username', function(done) {

        supertest(server.api.expressApp)
          .post(server.makeEndpoint('/accounts/request-password-reset'))
          .set(server.getSessionHeaders())
          .send({ username: 'tester' })
          .done(function(err, res) {
            should.not.exist(err)
            should.equal(res.object, 'result')
            should.equal(res.data, true)
            done()
          })

      })

      it('should return error for invalid account ID', function(done) {

        supertest(server.api.expressApp)
          .post(server.makeEndpoint('/accounts/request-password-reset'))
          .set(server.getSessionHeaders())
          .send({ accountId: '12345' })
          .done(function(err, res) {
            should.exist(err)
            should.equal(err.name, 'error')
            should.equal(err.statusCode, 400)
            should.equal(err.code, 'kInvalidArgument')
            should.equal(err.errCode, 'cortex.invalidArgument.invalidObjectId')
            should.equal(err.message, 'Invalid object identifier.')
            done()
          })

      })

    })

  })

})
