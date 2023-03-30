'use strict'

/* global before */

const server = require('../../lib/server'),
      supertest = require('supertest'),
      should = require('should'),
      async = require('async'),
      modules = require('../../../lib/modules'),
      _ = require('underscore'),
      utils = require('../../../lib/utils'),
      acl = require('../../../lib/acl')

let baseOrg = null,
    baseAdmin = null,
    baseOrgSessionClient = null,
    baseOrgAdminSession = null

describe('Rest Api', function() {

  describe('Medable', function() {

    before(function(done) {
      async.waterfall([
        // get medable org session app client
        callback => {

          modules.db.models.org.findOne({ _id: acl.BaseOrg }, (err, org) => {
            if (err) return callback(err)
            baseOrg = org
            baseOrgSessionClient = org.apps[1].clients[0]
            baseAdmin = {
              email: 'fiachra+admin@medable.com',
              password: server.password,
              name: { first: 'System', last: 'Admin' },
              mobile: '+353868044914',
              roles: [acl.OrgAdminRole]
            }
            callback()
          })
        },
        // provision a new account for logging into medable
        callback => modules.accounts.provisionAccount(
          null,
          baseAdmin,
          baseOrg,
          'en_US',
          'verified',
          null,
          {
            skipSelfRegistrationCheck: true,
            skipActivation: true,
            isProvisioned: true,
            sendWelcomeEmail: false,
            allowDirectRoles: true
          }, err => {
            if (err) {
              if (err.code === 'kDuplicateKey' ||
                                (err.code === 'kExists' && err.path === 'account.email') ||
                                (err.code === 'kValidationError' && utils.array(err.faults).length === 1 && _.find(err.faults, f => f.path === 'account.email' && f.code === 'kExists'))
              ) {
                err = null
              }
            }
            callback(err)
          }
        ),
        // login the account
        callback => {
          const login = { email: baseAdmin.email, password: server.password },
                agent = supertest.agent(server.api.expressApp)
          agent
            .post('/medable/accounts/login')
            .set({ 'Medable-Client-Key': baseOrgSessionClient.key })
            .send(login)
            .done((err) => {
              if (!err) {
                baseOrgAdminSession = agent
                callback()
              } else {
                modules.db.models.Callback.findOne({ handler: 'ver-location', target: baseAdmin.email }).lean().select({ token: 1 }).exec((err, ver) => {
                  if (err) return callback(err)
                  agent
                    .post('/medable/accounts/login')
                    .set({ 'Medable-Client-Key': baseOrgSessionClient.key })
                    .send({ email: baseAdmin.email, password: server.password, location: { verificationToken: ver.token } })
                    .done((err) => {
                      baseOrgAdminSession = agent
                      callback(err)

                    })
                })
              }
            })
        }
      ], done)

    })

    describe('GET /sys/org', function() {

      it('should get org list', function(callback) {

        baseOrgAdminSession
          .get('/medable/sys/orgs')
          .set({ 'Medable-Client-Key': baseOrgSessionClient.key })
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.exist(result.data)
            callback()
          })
      })

      it('should get current org', function(callback) {

        baseOrgAdminSession
          .get('/medable/sys/orgs/' + server.org._id)
          .set({ 'Medable-Client-Key': baseOrgSessionClient.key })
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'org')
            should.equal(result.code, server.org.code)
            callback()
          })
      })

      it('should fail on unknown org', function(callback) {

        let notAnOrg = utils.createId()

        baseOrgAdminSession
          .get('/medable/sys/orgs/' + notAnOrg)
          .set({ 'Medable-Client-Key': baseOrgSessionClient.key })
          .done(function(err, result) {
            should.exist(err)
            should.exist(result)
            should.equal(err.errCode, 'cortex.notFound.env')
            callback()
          })
      })
    })

    describe('PUT /sys/org', function() {

      it('should update org', function(callback) {
        let update = {
          configuration: {
            maxApps: 10
          }
        }

        baseOrgAdminSession
          .put('/medable/sys/orgs/' + server.org._id)
          .set({ 'Medable-Client-Key': baseOrgSessionClient.key })
          .send(update)
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            result.configuration.maxApps.should.equal(10)
            callback()
          })
      })

      it('should fail to update disallowed org path', function(callback) {
        let orgName = server.org.name,
            update = {
              name: 'Test Unit Org Update'
            }

        baseOrgAdminSession
          .put('/medable/sys/orgs/' + server.org._id)
          .set({ 'Medable-Client-Key': baseOrgSessionClient.key })
          .send(update)
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            result.name.should.equal(orgName)
            callback()
          })
      })

      it('should get org commands and run one', function(done) {

        async.waterfall([
          callback => {
            baseOrgAdminSession
              .get('/medable/sys/orgs/commands/' + server.org._id)
              .set({ 'Medable-Client-Key': baseOrgSessionClient.key })
              .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.object, 'list')
                should.exist(result.data)
                callback(err, result.data)
              })
          },
          (commands, callback) => {
            baseOrgAdminSession
              .post('/medable/sys/orgs/' + server.org._id + '/commands/Interim Package Reader')
              .set({ 'Medable-Client-Key': baseOrgSessionClient.key })
              .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.object, 'result')
                callback()
              })

          }
        ], done)

      })

    })

  })

})
