'use strict'

const addContext = require('@axon/zephyr-scale-api/addContext')
const { utils } = require('cortex-service')
/* global before */

const server = require('../../lib/server'),
      should = require('should'),
      async = require('async'),
      supertest = require('supertest'),
      sinon = require('sinon'),
      acl = require('../../../lib/acl')

let newAccID = null,
    orgData = null,
    testUtils

describe('Rest Api', function() {

  describe('Org', function() {

    // create a new org to refresh to
    before(function(callback) {
      require('../../lib/create.org')('New Refresh Org', 'new-refresh-org', (err, result) => {

        if (!err) {
          orgData = result
          testUtils = require('../../lib/utils')({ orgData })
        }
        callback()
      })
    })

    // create a new provider account
    before(function(callback) {
      let acc = {
        name: {
          first: 'Restful',
          last: 'Tester'
        },
        email: 'fiachra+restful@medable.com',
        mobile: '353868044914',
        roles: [acl.OrgProviderRole]
      }
      server.sessions.admin
        .post(server.makeEndpoint('/org/accounts'))
        .set(server.getSessionHeaders())
        .send(acc)
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'account')
          newAccID = result._id
          callback()
        })
    })

    async function getOrgDetails(orgData, orgId) {
      return orgData.sessions.admin
        .get(orgData.makeEndpoint(`/orgs/${orgId}`))
        .set(orgData.getSessionHeaders())
        .expect(200)
        .then(response => response.body)
    }

    async function updateOrg(orgData, payload) {
      return orgData.sessions.admin
        .put(orgData.makeEndpoint(`/orgs/${orgData.org._id}`))
        .send(payload)
        .set(orgData.getSessionHeaders())
        .expect(200)
    }

    describe('Org Settings #reg', function() {
      before(async() => {
        await testUtils.updateOrg('configuration.email.locationBypass', ['*'], orgData.principals.admin)
      })

      async function addOrgConfigContext(test, context, path) {
        const orgDetails = await getOrgDetails(orgData, orgData.org._id),
              value = { [path]: utils.path(orgDetails, path) }

        addContext(test, { title: context, value })
      }

      it('should be able to change org name #CTXAPI-T1267', async function() {
        await addOrgConfigContext(this, 'Org name before Update', 'name')

        await updateOrg(orgData, { 'name': 'demo-org' })

        await addOrgConfigContext(this, 'Org name after Update', 'name')
      })

      it('should be able to change timezone #CTXAPI-T1268', async function() {
        await addOrgConfigContext(this, 'Timezone before Update', 'tz')

        await updateOrg(orgData, { 'tz': 'Asia/Jerusalem' })

        await addOrgConfigContext(this, 'Timezone after Update', 'tz')
      })

      it('should be able to disable registration #CTXAPI-T1269', async function() {
        const email = 'ala.hawash+t1269@medable.com', password = 'myPa$$word123', mobile = '15055555555'
        await updateOrg(orgData, { registration: { allow: false } })

        await addOrgConfigContext(this, 'Registration configuration', 'registration')

        await testUtils.register({ email, password, mobile }).expect(403).then(res => {
          should.equal(res.body.status, 403)
          should.equal(res.body.code, 'kSelfRegistrationDisabled')

          addContext(this, { title: 'Resgistration response', value: res.body })
        })
      })

      it('should be able to enable registration #CTXAPI-T1270', async function() {
        const email = 'ala.hawash+t1270@medable.com', password = 'myPa$$word123', mobile = '15055555555'

        await updateOrg(orgData, { registration: { allow: true } })

        await addOrgConfigContext(this, 'Registration configuration', 'registration')

        await testUtils.register({ email, password, mobile }).expect(200).then(res => {
          should.equal(res.body.email, email)
          addContext(this, { title: 'Resgistration response', value: res.body })
        })

      })

      it('The "Invitations Required" setting can be Enabled by an Admin user #CTXAPI-T1271', async function() {
        const email = 'ala.hawash+t1271@medable.com', password = 'myPa$$word123', mobile = '15055555555'

        await updateOrg(orgData, { registration: { invitationRequired: true } })

        await addOrgConfigContext(this, 'Registration configuration', 'registration')

        await testUtils.register({ email, password, mobile }).expect(403).then(res => {
          should.equal(res.body.status, 403)
          should.equal(res.body.code, 'kRegistrationInvitationRequired')

          addContext(this, { title: 'Resgistration response', value: res.body })
        })

      })

      it('The "Invitations Required" setting can be Disabled by an Admin user #CTXAPI-T1272', async function() {
        const email = 'ala.hawash+t1272@medable.com', password = 'myPa$$word123', mobile = '15055555555'
        await updateOrg(orgData, { registration: { invitationRequired: false } })

        await addOrgConfigContext(this, 'Registration configuration', 'registration')

        await testUtils.register({ email, password, mobile }).expect(200).then(res => {
          should.equal(res.body.email, email)
          addContext(this, { title: 'Resgistration response', value: res.body })
        })
      })

      it('The "Activation Required" setting can be Disabled by an Admin user #CTXAPI-T1273', async function() {
        const email = 'ala.hawash+t1273@medable.com', password = 'myPa$$word123', mobile = '15055555555'
        await updateOrg(orgData, { registration: { activationRequired: false } })

        await addOrgConfigContext(this, 'Registration configuration', 'registration')

        await testUtils.register({ email, password, mobile }).expect(200).then(res => {
          should.equal(res.body.email, email)
          addContext(this, { title: 'Resgistration response', value: res.body })
        })

        await testUtils.login({ email, password }).expect(200).then(res => {
          addContext(this, { title: 'Login response', value: res.body })
        })

      })

      it('The "Activation Required" setting can be Enabled by an Admin user #CTXAPI-T1274', async function() {
        const email = 'ala.hawash+t1274@medable.com', password = 'myPa$$word123', mobile = '15055555555'
        await updateOrg(orgData, { registration: { activationRequired: true } })

        await addOrgConfigContext(this, 'Registration configuration', 'registration')

        await testUtils.register({ email, password, mobile }).expect(200).then(res => {
          should.equal(res.body.email, email)
          addContext(this, { title: 'Resgistration response', value: res.body })
        })

        await testUtils.login({ email, password }).expect(403).then(res => {
          should.equal(res.body.status, 403)
          should.equal(res.body.code, 'kAccountActivationRequired')
          addContext(this, { title: 'Login response', value: res.body })
        })

        // reset activation required
        await updateOrg(orgData, { registration: { activationRequired: false } })
      })

      it('The "Password Expiry Days" setting is set to "1" by an Admin user #CTXAPI-T1275', async function() {
        const email = 'ala.hawash+t1275@medable.com', password = 'myPa$$word123', passwordExpiryDays = 1,
              clock = sinon.useFakeTimers({ now: new Date(), toFake: ['Date'] })

        await testUtils.createAccount({ email, password })
        await updateOrg(orgData, { configuration: { passwordExpiryDays } })

        await addOrgConfigContext(this, 'Org settings', 'configuration.passwordExpiryDays')

        await testUtils.login({ email, password }).then(res => {
          should.equal(res.body.email, email)
          addContext(this, { title: 'Successful login response', value: res.body })
        })

        // advance clock to expire passowrd
        clock.tick(passwordExpiryDays * 60 * 60 * 24 * 1000)

        await testUtils.login({ email, password }).then(res => {
          should.equal(res.body.object, 'fault')
          should.equal(res.body.code, 'kPasswordExpired')
          addContext(this, { title: 'Reponse after password expiry', value: res.body })
        })

        clock.restore()
      })

      it('The "Simultaneous Logins" setting is set to enabled by an Admin user #CTXAPI-T1276', async function() {
        const email = orgData.principals.patient.email, password = server.password,
              agent1 = supertest.agent(server.api.expressApp),
              agent2 = supertest.agent(server.api.expressApp)

        await updateOrg(orgData, { configuration: { allowSimultaneousLogins: true } })

        await addOrgConfigContext(this, 'Org settings', 'configuration.allowSimultaneousLogins')

        await testUtils.login({ email, password }, agent1).expect(200).then(res => {
          addContext(this, { title: 'Client1 loggedIn. response', value: res.body })
        })

        await testUtils.login({ email, password }, agent2).expect(200).then(res => {
          addContext(this, { title: 'Client2 loggedIn. response', value: res.body })
        })

        await agent1.get(orgData.makeEndpoint('/accounts/me'))
          .set(orgData.getSessionHeaders()).then(res => {
            should.equal(res.body.email, email)
            should.equal(res.body.object, 'account')
            addContext(this, { title: 'Client1 /accounts/me response', value: res.body })
          })
      })

      it('The "Simultaneous Logins" setting is set to disabled by an Admin user #CTXAPI-T1277', async function() {
        const email = orgData.principals.patient.email, password = server.password,
              agent1 = supertest.agent(server.api.expressApp),
              agent2 = supertest.agent(server.api.expressApp)

        await updateOrg(orgData, { configuration: { allowSimultaneousLogins: false } })

        await addOrgConfigContext(this, 'Org settings', 'configuration.allowSimultaneousLogins')

        await testUtils.login({ email, password }, agent1).expect(200).then(res => {
          addContext(this, { title: 'Client1 loggedIn. response', value: res.body })
        })

        await testUtils.login({ email, password }, agent2).expect(200).then(res => {
          addContext(this, { title: 'Client2 loggedIn. response', value: res.body })
        })

        await agent1.get(orgData.makeEndpoint('/accounts/me'))
          .set(orgData.getSessionHeaders()).then(res => {
            should.equal(res.body.status, 403)
            should.equal(res.body.code, 'kLoggedInElsewhere')
            addContext(this, { title: 'Client1 /accounts/me response', value: res.body })
          })
      })

      it('The "Location Verification Bypass" whitelist is disabling Localization Verification when asterisk is set by an Admin user #CTXAPI-T1278', async function() {
        const email = orgData.principals.patient.email, password = server.password

        await updateOrg(orgData, { configuration: { email: { locationBypass: ['*'] } } })
        await addOrgConfigContext(this, 'Org settings', 'configuration.email')

        await testUtils.login({ email, password }).expect(200).then(res => {
          should.notEqual(res.body.object, 'fault')
          should.notEqual(res.body.code, 'kNewLocation')
          addContext(this, { title: 'Login response', value: res.body })
        })
      })

      it('The "Location Verification Bypass" whitelist enables Localization Verification when email is NOT included by an Admin user #CTXAPI-T1279', async function() {
        const email = orgData.principals.patient.email, password = server.password

        await updateOrg(orgData, { configuration: { email: { locationBypass: ['some-email@medable.com'] } } })
        await addOrgConfigContext(this, 'Org settings', 'configuration.email')

        await testUtils.login({ email, password }).expect(200).then(res => {
          should.equal(res.body.code, 'kNewLocation')
          addContext(this, { title: 'Login response', value: res.body })
        })

        // reset bypass location
        await testUtils.updateOrg('configuration.email.locationBypass', ['*'], orgData.principals.admin)
      })

      it('The "Unauthorized Attempts to Account Lock" setting can be changed by an Admin user #CTXAPI-T1280', async function() {
        const email = 'ala.hawash+t1280@medable.com', password = 'NotTheCorrectPassword', maxLoginAttempts = 3

        await testUtils.createAccount({ email })

        await updateOrg(orgData, { security: { unauthorizedAccess: { lockAttempts: maxLoginAttempts } } })
        await addOrgConfigContext(this, 'Org settings', 'security.unauthorizedAccess')

        for (let i = 0; i < maxLoginAttempts; i++) {
          await testUtils.login({ email, password }).then(res => {
            should.equal(res.body.status, 403)
            should.equal(res.body.code, 'kInvalidCredentials')
            addContext(this, { title: `Login attempt (${i + 1}) response`, value: res.body })
          })
        }

        // login one more time, should get accountLocked fault
        await testUtils.login({ email, password }).then(res => {
          should.equal(res.body.status, 403)
          should.equal(res.body.code, 'kAccountLocked')
          addContext(this, { title: `Login attempt after locking response`, value: res.body })
        })
      })

      it('The "Account Lock Duration" setting can be changed by an Admin user #CTXAPI-T1281', async function() {
        const email = 'ala.hawash+t1281@medable.com', password = 'myPa$$word123', invalidPassword = 'NotTheCorrectPassword',
              lockDuration = 3, maxLoginAttempts = 1,
              clock = sinon.useFakeTimers({ now: new Date(), toFake: ['Date'] })

        await testUtils.createAccount({ email, password })
        await updateOrg(orgData, { security: { unauthorizedAccess: { lockDuration, lockAttempts: maxLoginAttempts } } })
        await addOrgConfigContext(this, 'Org settings', 'security.unauthorizedAccess')

        for (let i = 0; i < maxLoginAttempts; i++) {
          await testUtils.login({ email, password: invalidPassword }).then(res => {
            should.equal(res.body.status, 403)
            should.equal(res.body.code, 'kInvalidCredentials')
          })
        }

        // login with correct password, to make sure the account got locked
        await testUtils.login({ email, password }).then(res => {
          should.equal(res.body.status, 403)
          should.equal(res.body.code, 'kAccountLocked')
          addContext(this, { title: `Login attempt after locking response`, value: res.body })
        })

        // move clock forward lockDuration + 1 minutes
        clock.tick((lockDuration + 1) * 60 * 1000)

        // login after lock duration passes
        await testUtils.login({ email, password }).then(res => {
          should.equal(res.body.object, 'account')
          should.equal(res.body.email, email)
          addContext(this, { title: `Login attempt after lock duration passes response`, value: res.body })
        })

        clock.restore()
      })

    })

    describe('Accounts', function() {

      it('should list accounts', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/org/accounts'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.exist(result.data)
            result.data.length.should.be.above(3)
            callback()
          })
      })

      it('should get single account', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/org/accounts/' + server.principals.admin._id))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'account')
            callback()
          })
      })

      it('should update account', function(callback) {

        let update = {
          name: {
            first: 'Maximillian',
            last: 'Power'
          }
        }
        server.sessions.admin
          .put(server.makeEndpoint('/org/accounts/' + server.principals.admin._id))
          .set(server.getSessionHeaders())
          .send(update)
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'account')
            should.equal(result.name.first, update.name.first)
            should.equal(result.name.last, update.name.last)
            callback()
          })
      })

      it('should provision new provider account', function(callback) {

        let acc = {
          name: {
            first: 'Restful',
            last: 'Tester'
          },
          email: 'fiachra+restful1@medable.com',
          mobile: '353868044914',
          roles: [acl.OrgProviderRole]
        }

        server.sessions.admin
          .post(server.makeEndpoint('/org/accounts'))
          .set(server.getSessionHeaders())
          .send(acc)
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'account')
            callback()
          })
      })

      it('should accept loginMethods parameter', async function() {

        const acc = {
                name: {
                  first: 'Test',
                  last: 'Account'
                },
                email: 'test.account@medable.com',
                password: 'myPa$$word123',
                mobile: '15055555555',
                loginMethods: ['credentials']
              },

              response = await server.sessions.admin
                .post(server.makeEndpoint('/org/accounts'))
                .set(server.getSessionHeaders())
                .send(acc),

              account = await testUtils.getInstance('accounts', response.body._id)

        should.equal(account.object, 'account')
        account.loginMethods.should.containDeep(['credentials'])
        await testUtils.deleteInstance('accounts', account._id)
      })

      it('should verify provider', function(callback) {
        server.sessions.admin
          .post(server.makeEndpoint('/org/accounts/provider/verify/' + newAccID.toString()))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            result.data.should.be.ok()
            callback()
          })
      })

      it('should activate account', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/org/accounts/activateOrVerify/' + newAccID))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            result.data.should.be.ok()
            callback()
          })
      })

      it('should fail to deactivate account', function(callback) {
        // activation is set to false on this org
        server.sessions.admin
          .get(server.makeEndpoint('/org/accounts/deactivate/' + newAccID))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.exist(err)
            should.exist(result)
            callback()
          })
      })

      it('should delete account', function(done) {
        async.series([
          callback => {
            server.sessions.admin
              .delete(server.makeEndpoint('/org/accounts/' + newAccID))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)

                callback()
              })
          },
          callback => {
            server.sessions.admin
              .get(server.makeEndpoint('/org/accounts/' + newAccID))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                should.exist(err)
                should.equal(err.code, 'kNotFound')
                should.exist(result)
                callback()
              })
          }
        ], done)

      })

    })

    describe('Org Refresh', function() {
      it('should trigger an org refresh', function(callback) {
        orgData.session
          .post('/' + orgData.org.code + '/org/refresh')
          .set({ 'Medable-Client-Key': orgData.appClient.key })
          .send({ accountPassword: server.password })
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            callback()
          })
      })

    })

  })

})
