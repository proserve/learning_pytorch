'use strict'

/* global before, after */

const server = require('../../lib/server'),
      supertest = require('supertest'),
      should = require('should'),
      async = require('async'),
      modules = require('../../../lib/modules'),
      ap = require('../../../lib/access-principal'),
      { createId, promised } = require('../../../lib/utils'),
      acl = require('../../../lib/acl'),
      { createAccount, updateInstance, deleteInstance, updateOrg } = require('../../lib/utils')(),
      sandboxed = require('../../lib/sandboxed'),
      consts = require('../../../lib/consts')

describe('Modules', function() {

  describe('Authentication', function() {

    before(function(done) {
      done()
    })

    after(function(done) {
      async.series([
        callback => {
          ap.create(server.org, server.principals.admin._id, (err, principal) => {
            if (!err) {
              server.principals.admin = principal
            }
            callback(err)
          })
        },
        callback => {
          ap.create(server.org, server.principals.provider._id, (err, principal) => {
            if (!err) {
              server.principals.provider = principal
            }
            callback(err)
          })
        },
        callback => {
          ap.create(server.org, server.principals.patient._id, (err, principal) => {
            if (!err) {
              server.principals.patient = principal
            }
            callback(err)
          })
        }
      ], done)

    })

    describe('Generators', function() {
      // modules.authentication.signRequest(command, method, secret, timestamp)
      it('should generate a 25 char alphanumeric string', function() {
        let alphanum = modules.authentication.genAlphaNum(25)
        alphanum.should.be.a.String()
        alphanum.length.should.be.equal(25)
      })

      it('should generate a 16 char nonce', function() {
        let nonce = modules.authentication.generateNonce()
        nonce.should.be.a.String()
        nonce.length.should.be.equal(16)
      })

      it('should generate a 25 char alphanumeric & symbols string', function() {
        let num = modules.authentication.genAlphaNumSym(25)
        num.should.be.a.String()
        num.length.should.be.equal(25)
      })

      it('should generate a 25 char alphanumeric string', function() {
        let num = modules.authentication.genAlphaNumString(25)
        num.should.be.a.String()
        num.length.should.be.equal(25)

      })

      it('should generate fingerprint', function() {
        let fingerprint = modules.authentication.generateFingerprint()
        fingerprint.should.be.a.String()
        fingerprint.length.should.be.equal(40)
      })

      it('should generate salt', function(done) {
        modules.authentication.generateSalt((err, salt) => {
          should.not.exist(err)
          salt.should.be.a.String()
          // 29 is what it is. Not necessirily what it should be. Revisit
          salt.length.should.equal(29)
          done()
        })
      })

      it('should generate rsa keypair', function(done) {

        modules.authentication.genRsaKeypair((err, { pub, priv } = {}) => {
          should.not.exist(err)
          pub.should.be.a.String()
          priv.should.be.a.String()

          done()
        })
      })
    })

    describe('Passwords', function() {

      let testPass = '',
          testHash = ''

      it('should generate password', function(done) {
        testPass = modules.authentication.generatePassword(25)
        testPass.should.be.a.String()
        testPass.length.should.be.equal(25)
        done()
      })

      it('should hash password', function(done) {
        modules.authentication.hashPassword(testPass, (err, hash) => {
          should.not.exist(err)
          testHash = hash
          testHash.should.be.a.String()
          done()
        })
      })

      it('should verify password', function(done) {
        modules.authentication.verifyPassword(testPass, testHash, (err, result) => {
          should.not.exist(err)
          result.should.be.ok()
          done()
        })
      })

    })

    describe('Scope', function() {
      // more scope expanstions coming
      let compiledScopes = null
      it('should validate scopes', function(done) {

        modules.authentication.isValidScope(server.org, '*').should.be.ok()
        modules.authentication.isValidScope(server.org, 'object.*').should.be.ok()
        modules.authentication.isValidScope(server.org, 'object.*.account.' + server.principals.admin._id).should.be.ok()
        modules.authentication.isValidScope(server.org, 'object.*.account.*.name').should.be.ok()
        modules.authentication.isValidScope(server.org, 'object.*.*.*.name').should.be.ok()
        modules.authentication.isValidScope(server.org, 'admin.*').should.be.ok()
        modules.authentication.isValidScope(server.org, 'admin.read').should.be.ok()
        modules.authentication.isValidScope(server.org, 'script.*').should.be.ok()
        modules.authentication.isValidScope(server.org, 'script.execute.*').should.be.ok()
        modules.authentication.isValidScope(server.org, 'script.execute.runner').should.be.ok()

        modules.authentication.validateAuthScope(server.org, '*').should.equal('*')

        done()
      })

      it('should invalidate scopes', function(done) {

        modules.authentication.isValidScope(server.org, '*.object').should.be.false()
        modules.authentication.isValidScope(server.org, '*.*').should.be.false()
        modules.authentication.isValidScope(server.org, 'object.*.account.random').should.be.false()
        modules.authentication.isValidScope(server.org, 'objects.*').should.be.false()
        modules.authentication.isValidScope(server.org, 'object.*.account.address').should.be.false()
        modules.authentication.isValidScope(server.org, 'script.execute.*.*.*').should.be.false()

        try {
          modules.authentication.validateAuthScope(server.org, '*.object')
        } catch (err) {
          should.exist(err)
          err.errCode.should.equal('cortex.invalidArgument.authScope')
        }

        done()
      })

      it('should optimize scopes', function(done) {
        let scopes = [
              'object.*',
              'object.*.object',
              'object.*.script',
              'object.*.account.' + server.principals.admin._id,
              'admin.read',
              'admin.update',
              'script.execute.route'
            ],
            scopeArray = modules.authentication.optimizeAuthScope(scopes)
        scopeArray.length.should.equal(4)
        done()
      })

      it('should compile auth scope', function(done) {

        let scopes = [
          'object.*.object',
          'object.*.script',
          'object.*.account.' + server.principals.admin._id,
          'admin.read',
          'admin.update',
          'script.execute.route'
        ]
        compiledScopes = modules.authentication.compileAuthScope(scopes)
        compiledScopes.object['*'].account[server.principals.admin._id].should.be.ok()
        compiledScopes.object['*'].object.should.be.ok()
        compiledScopes.object['*'].script.should.be.ok()
        compiledScopes.admin.read.should.be.ok()
        compiledScopes.admin.update.should.be.ok()
        compiledScopes.script.execute.route.should.be.ok()
        done()
      })

      it('should convert compiled auth scope to string', function(done) {

        let scopeString = modules.authentication.scopeToStringArray(compiledScopes)
        scopeString.length.should.equal(6)

        done()
      })

    })

    describe('Tokens', function() {

      let expiresTime = 10000,
          pToken = null,
          tToken = null,
          ac = null

      before(async() => {

        ac = new acl.AccessContext(server.principals.admin)

        pToken = (await promised(modules.authentication,
          'createToken',
          ac,
          server.principals.admin.email,
          server.sessionsClient.key,
          {
            permanent: true
          }
        )).token

        tToken = (await promised(modules.authentication,
          'createToken',
          ac,
          server.principals.admin.email,
          server.sessionsClient.key,
          {
            expiresIn: expiresTime
          }
        )).token

      })

      it('should decode token', function(done) {
        let decoded = modules.authentication.decodeToken(tToken)
        should.exist(decoded.iat)
        should.exist(decoded.exp)
        done()
      })

      it('should get subject token', function(done) {

        modules.authentication.getSubjectTokens(ac, server.sessionsClient.key, server.principals.admin.email, (err, tokens) => {
          should.not.exist(err)
          tokens.length.should.be.above(0)
          done()
        })

      })

      it('should authenticate token ', function(done) {
        modules.authentication.authenticateToken(ac, tToken, {}, (err, { client } = {}) => {
          if (!err) {
            client.key.should.equal(server.sessionsClient.key)
          }
          done(err)
        })

      })

      it('should revoke the permanent token', function(done) {
        modules.authentication.revokeToken(ac, pToken, (err, revoked) => {
          should.not.exist(err)
          revoked.should.be.ok()
          done()
        })

      })

      it('should revoke all subject tokens', function(done) {
        modules.authentication.revokeSubjectTokens(ac, server.sessionsClient.key, server.principals.admin.email, (err, count) => {
          should.not.exist(err)
          count.should.be.equal(0)
          done()
        })

      })
    })

    describe('Token & Scope Access', function() {

      let tempToken = null,
          roleId = null,
          object1 = null,
          object2 = null

      before(function(done) {
        async.series([
          callback => {
            let newRole = { 'name': 'Auth Role', 'scope': ['object.read', 'object.update', 'view.execute'] }

            server.sessions.admin
              .post(server.makeEndpoint('/orgs/' + server.org._id + '/roles'))
              .set(server.getSessionHeaders())
              .send(newRole)
              .done(function(err, result) {

                roleId = createId(result.data[result.data.length - 1]._id)
                callback(err)
              })
          },
          callback => {
            server.updateOrg(callback)
          },
          callback => {
            modules.db.models.Object.aclCreate(server.principals.admin, {
              name: 'c_auth_role_obj',
              label: 'First Deployment object',
              defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }, { type: acl.AccessTargets.OrgRole, target: roleId, allow: acl.AccessLevels.Read }],
              createAcl: [{ type: acl.AccessTargets.OrgRole, target: roleId }],
              shareChain: [acl.AccessLevels.Update, acl.AccessLevels.Share, acl.AccessLevels.Connected],
              properties: [
                { label: 'String', name: 'c_desc', type: 'String' },
                { label: 'Number', name: 'c_count', type: 'Number' },
                { label: 'Date', name: 'c_date', type: 'Date' }
              ]
            }, (err) => {
              callback(err)
            })

          },
          callback => {
            modules.db.models.Object.aclCreate(server.principals.admin, {
              name: 'c_auth_user_obj',
              label: 'First Deployment object',
              defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }, { type: acl.AccessTargets.Account, target: server.principals.patient._id, allow: acl.AccessLevels.Read }],
              createAcl: [{ type: acl.AccessTargets.Account, target: server.principals.patient._id }],
              shareChain: [acl.AccessLevels.Update, acl.AccessLevels.Share, acl.AccessLevels.Connected],
              properties: [
                { label: 'String', name: 'c_desc', type: 'String' },
                { label: 'Number', name: 'c_count', type: 'Number' },
                { label: 'Date', name: 'c_date', type: 'Date' }
              ]
            }, (err) => {
              callback(err)
            })

          },
          callback => {
            server.updateOrg(callback)
          }
        ], done)

      })

      it('should allow access all account names', function(done) {
        let options = {
          permanent: true,
          scope: ['object.read.account.*.name'],
          skipAcl: true,
          grant: 6
        }

        modules.authentication.createToken(new acl.AccessContext(server.principals.admin), server.principals.admin.email, server.sessionsClient.key, options, (err, result) => {
          should.not.exist(err)

          supertest(server.api.expressApp)
            .get(server.makeEndpoint('/accounts'))
            .set({
              'Medable-Client-Key': server.sessionsClient.key,
              'Authorization': 'Bearer ' + result.token
            })
            .done((err, result) => {
              should.not.exist(err)
              result.data.length.should.be.above(3)
              should.exist(result.data[0].name)
              should.not.exist(result.data[0].email)

              done()
            })

        })

      })

      it('should allow time bound access all account names', function(done) {
        let options = {
          expiresIn: 5,
          scope: ['object.read.account.*.name'],
          skipAcl: true,
          grant: 6
        }

        modules.authentication.createToken(new acl.AccessContext(server.principals.admin), server.principals.admin.email, server.sessionsClient.key, options, (err, result) => {
          should.not.exist(err)
          tempToken = result.token

          supertest(server.api.expressApp)
            .get(server.makeEndpoint('/accounts'))
            .set({
              'Medable-Client-Key': server.sessionsClient.key,
              'Authorization': 'Bearer ' + result.token
            })
            .done((err, result) => {
              should.not.exist(err)
              result.data.length.should.be.above(3)
              should.exist(result.data[0].name)
              should.not.exist(result.data[0].email)

              done()
            })
        })
      })

      it('should fail to allow time bound access all account names', function(done) {

        setTimeout(function() {
          supertest(server.api.expressApp)
            .get(server.makeEndpoint('/accounts'))
            .set({
              'Medable-Client-Key': server.sessionsClient.key,
              'Authorization': 'Bearer ' + tempToken
            })
            .done((err, result) => {
              should.exist(err)
              err.errCode.should.equal('cortex.expired.jwt')
              done()
            })

        }, 5000)

      })

      it('should allow update access all accounts', function(done) {
        let options = {
          scope: ['object.read.account.*', 'object.update.account.*'],
          skipAcl: true,
          grant: 7
        }

        modules.authentication.createToken(new acl.AccessContext(server.principals.admin), server.principals.admin.email, server.sessionsClient.key, options, (err, result) => {
          should.not.exist(err)

          let payload = {
            name: {
              first: 'auther',
              last: 'Tokenstein'
            }
          }
          supertest(server.api.expressApp)
            .put(server.makeEndpoint('/accounts/' + server.principals.patient._id))
            .set({
              'Medable-Client-Key': server.sessionsClient.key,
              'Authorization': 'Bearer ' + result.token
            })
            .send(payload)
            .done((err, result) => {
              should.not.exist(err)
              result.name.first.should.equal(payload.name.first)
              result.name.last.should.equal(payload.name.last)
              done()
            })

        })

      })

      it('should allow update access to specific account', function(done) {
        let options = {
          scope: ['object.read.account.' + server.principals.provider._id + '.*', 'object.update.account.' + server.principals.provider._id + '.*'],
          skipAcl: true,
          grant: 7
        }

        modules.authentication.createToken(new acl.AccessContext(server.principals.admin), server.principals.admin.email, server.sessionsClient.key, options, (err, result) => {
          should.not.exist(err)

          let payload = {
            name: {
              first: 'Mrss',
              last: 'Tokenstein'
            }
          }
          supertest(server.api.expressApp)
            .put(server.makeEndpoint('/accounts/' + server.principals.provider._id))
            .set({
              'Medable-Client-Key': server.sessionsClient.key,
              'Authorization': 'Bearer ' + result.token
            })
            .send(payload)
            .done((err, result) => {
              should.not.exist(err)
              result.name.first.should.equal(payload.name.first)
              result.name.last.should.equal(payload.name.last)
              done()
            })

        })

      })

      it('should fail to allow update access to specific account', function(done) {
        let options = {
          scope: ['object.read.account.' + server.principals.provider._id + '.*', 'object.update.account.' + server.principals.provider._id + '.*'],
          skipAcl: true,
          grant: 7
        }

        modules.authentication.createToken(new acl.AccessContext(server.principals.admin), server.principals.admin.email, server.sessionsClient.key, options, (err, result) => {
          should.not.exist(err)

          let payload = {
            name: {
              first: 'Naboo',
              last: 'Tokenstein'
            }
          }
          supertest(server.api.expressApp)
            .put(server.makeEndpoint('/accounts/' + server.principals.patient._id))
            .set({
              'Medable-Client-Key': server.sessionsClient.key,
              'Authorization': 'Bearer ' + result.token
            })
            .send(payload)
            .done((err, result) => {
              should.exist(err)
              err.code.should.equal('kAccessDenied')
              done()
            })

        })

      })

      it('should allow creation of role restricted object', function(done) {
        let options = {
          scope: ['object.*.c_auth_role_obj.*'],
          roles: [roleId]
        }

        modules.authentication.createToken(new acl.AccessContext(server.principals.admin), server.principals.patient.email, server.sessionsClient.key, options, (err, result) => {
          should.not.exist(err)

          let payload = {
            c_desc: 'Nice',
            c_count: 20,
            c_date: new Date()
          }

          supertest(server.api.expressApp)
            .post(server.makeEndpoint('/c_auth_role_obj/'))
            .set({
              'Medable-Client-Key': server.sessionsClient.key,
              'Authorization': 'Bearer ' + result.token
            })
            .send(payload)
            .done((err, result) => {
              should.not.exist(err)
              result.c_count.should.equal(20)

              done()
            })

        })

      })

      it('should fail allow creation of role restricted object without role specified', function(done) {
        let options = {
          scope: ['object.*.c_auth_role_obj.*']
        }

        modules.authentication.createToken(new acl.AccessContext(server.principals.admin), server.principals.patient.email, server.sessionsClient.key, options, (err, result) => {
          should.not.exist(err)

          let payload = {
            c_desc: 'Nice',
            c_count: 20,
            c_date: new Date()
          }

          supertest(server.api.expressApp)
            .post(server.makeEndpoint('/c_auth_role_obj/'))
            .set({
              'Medable-Client-Key': server.sessionsClient.key,
              'Authorization': 'Bearer ' + result.token
            })
            .send(payload)
            .done((err, result) => {
              should.exist(err)
              err.code.should.equal('kAccessDenied')
              done()
            })

        })

      })

      it('should allow creation of user restricted objects', function(done) {
        let options = {
          scope: ['object.*']
        }

        modules.authentication.createToken(new acl.AccessContext(server.principals.admin), server.principals.patient.email, server.sessionsClient.key, options, (err, result) => {
          should.not.exist(err)

          let payload = {
            c_desc: 'Nice',
            c_count: 20,
            c_date: new Date()
          }

          async.series([
            callback => {
              supertest(server.api.expressApp)
                .post(server.makeEndpoint('/c_auth_user_obj/'))
                .set({
                  'Medable-Client-Key': server.sessionsClient.key,
                  'Authorization': 'Bearer ' + result.token
                })
                .send(payload)
                .done((err, result) => {
                  should.not.exist(err)
                  result.c_count.should.equal(20)
                  object1 = result
                  callback()
                })
            },
            callback => {
              supertest(server.api.expressApp)
                .post(server.makeEndpoint('/c_auth_user_obj/'))
                .set({
                  'Medable-Client-Key': server.sessionsClient.key,
                  'Authorization': 'Bearer ' + result.token
                })
                .send(payload)
                .done((err, result) => {
                  should.not.exist(err)
                  result.c_count.should.equal(20)
                  object2 = result
                  callback()
                })
            }

          ], done)

        })

      })

      it('should fail to allow creation of user restricted object', function(done) {
        let options = {
          scope: ['object.*']
        }

        modules.authentication.createToken(new acl.AccessContext(server.principals.admin), server.principals.provider.email, server.sessionsClient.key, options, (err, result) => {
          should.not.exist(err)

          let payload = {
            c_desc: 'Nice',
            c_count: 20,
            c_date: new Date()
          }

          supertest(server.api.expressApp)
            .post(server.makeEndpoint('/c_auth_user_obj/'))
            .set({
              'Medable-Client-Key': server.sessionsClient.key,
              'Authorization': 'Bearer ' + result.token
            })
            .send(payload)
            .done((err, result) => {
              should.exist(err)

              done()
            })

        })

      })

      it('should allow update of specific object', function(done) {
        let options = {
          scope: ['object.*.c_auth_user_obj.' + object1._id + '.*'],
          skipAcl: true,
          grant: 7
        }

        modules.authentication.createToken(new acl.AccessContext(server.principals.admin), server.principals.admin.email, server.sessionsClient.key, options, (err, result) => {
          should.not.exist(err)

          let payload = {
            c_count: 23,
            c_date: new Date()
          }

          supertest(server.api.expressApp)
            .put(server.makeEndpoint('/c_auth_user_obj/' + object1._id))
            .set({
              'Medable-Client-Key': server.sessionsClient.key,
              'Authorization': 'Bearer ' + result.token
            })
            .send(payload)
            .done((err, result) => {
              should.not.exist(err)
              result.c_count.should.equal(23)

              done()
            })

        })

      })

      it('should fail to allow update of specific object', function(done) {
        let options = {
          scope: ['object.*.c_auth_user_obj.' + object1._id + '.*'],
          skipAcl: true,
          grant: 7
        }

        modules.authentication.createToken(new acl.AccessContext(server.principals.admin), server.principals.admin.email, server.sessionsClient.key, options, (err, result) => {
          should.not.exist(err)

          let payload = {
            c_count: 23,
            c_date: new Date()
          }

          supertest(server.api.expressApp)
            .put(server.makeEndpoint('/c_auth_user_obj/' + object2._id))
            .set({
              'Medable-Client-Key': server.sessionsClient.key,
              'Authorization': 'Bearer ' + result.token
            })
            .send(payload)
            .done((err, result) => {
              should.exist(err)
              err.code.should.equal('kAccessDenied')

              done()
            })

        })

      })

    })

    describe('loadAccount', async function() {
      /* global org */
      it('Should throw error if account has SSO disabled but login method is SSO', async function() {
        let error = {}
        const account = server.principals.provider

        await updateInstance('accounts', account._id, { $set: { loginMethods: ['credentials'] } })

        await promised(modules.authentication, 'loadAccount', { org: server.org, email: account.email, loginMethod: 'sso' })
          .catch(err => {
            error = err
          })
        error.should.containDeep({ code: 'kInvalidLoginMethod' })

        // restore default
        await updateInstance('accounts', account._id, { $set: { loginMethods: [] } })

      })

    })

    describe('attemptAuth', async function() {

      describe('loginMethods', async function() {
        /* global org */
        let account
        const validateFailedAuthAttempt = async function() {
          let error = {}

          await promised(modules.authentication, 'attemptAuth', server.org, account.email, account.password)
            .catch(err => {
              error = err
            })
          error.should.containDeep({ code: 'kInvalidLoginMethod' })
        }

        before(async function() {
          account = await createAccount()
        })

        after(async function() {
          await deleteInstance('accounts', account._id)
        })

        afterEach(async function() {
          // restore defaults
          await updateInstance('accounts', account._id, { $set: { loginMethods: [] } })
          await promised(null, sandboxed(function() {
            org.update('configuration.loginMethods', ['credentials'])
          }))
        })

        it('Should throw error if account is SSO only', async function() {
          await updateOrg('configuration.loginMethods', ['credentials', 'sso'])
          await updateInstance('accounts', account._id, { $set: { loginMethods: ['sso'] } })
          await validateFailedAuthAttempt()
        })

        it('Should allow admin to log in with credentials in sso only org', async function() {
          let authenticatedAccount

          await promised(null, sandboxed(function() {
            org.update('configuration.loginMethods', ['sso'])
          }))
          await updateInstance('accounts', account._id, { $push: { roles: consts.roles.admin } })
          authenticatedAccount = await promised(modules.authentication, 'attemptAuth', server.org, account.email, account.password)
          should.exist(authenticatedAccount)
          await updateInstance('accounts', account._id, { $pull: { roles: consts.roles.admin } })
        })
      })
    })

  })

})
