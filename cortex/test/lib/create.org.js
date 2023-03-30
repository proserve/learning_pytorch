'use strict'

const async = require('async'),
      server = require('./server'),
      modules = require('../../lib/modules'),
      ap = require('../../lib/access-principal'),
      acl = require('../../lib/acl'),
      supertest = require('supertest'),
      Fault = require('cortex-service/lib/fault')

module.exports = function(orgName, orgCode, callback) {

  let newOrgData = {
    org: null,
    appClient: null,
    principals: {
      admin: null,
      provider: null,
      patient: null
    },
    sessions: {
      admin: null,
      provider: null,
      patient: null
    },
    getSessionHeaders: function() {
      return { 'Medable-Client-Key': this.appClient.key }
    },
    makeEndpoint(path) {
      return '/' + this.org.code + path
    },
    updateOrg(callback) {
      if (!(this.org && this.principals.admin && this.principals.provider && this.principals.patient)) {
        return callback()
      }
      const Org = modules.db.models.Org
      Org.loadOrg(this.org._id, (err, org) => {
        if (!err) {
          this.org = org
          this.principals.admin._org =
                        this.principals.provider._org =
                            this.principals.patient._org = org
        }
        callback(err)
      })
    }
  }

  async.waterfall([
    // get the base org client for creating the second org
    (callback) => {
      modules.db.models.org.findOne({ _id: acl.BaseOrg }, (err, org) => {

        let provisioner = org.apps[0].clients[0]
        callback(err, provisioner)

      })
    },

    // create initial org and user account
    (provisioner, callback) => {

      let payload = {
            org: {
              code: orgCode,
              name: orgName,
              state: 'enabled'
            },
            account: {
              name: {
                first: 'Test',
                last: 'Administrator'
              },
              email: server.principals.admin.email,
              mobile: '16049892489'
            }
          },
          timestamp = Date.now()

      supertest(server.api.expressApp)
        .post('/medable/sys/orgs/provision')
        .set({
          'Medable-Client-Key': provisioner.key,
          'Medable-Client-Signature': modules.authentication.signRequest('/sys/orgs/provision', 'POST', provisioner.key + provisioner.secret, timestamp),
          'Medable-Client-Timestamp': timestamp,
          'Medable-Client-Nonce': modules.authentication.genAlphaNumString(16),
          'Accept': 'application/json'
        })
        .send(payload)
        .done(callback)

    },

    // ensure scripts are enabled, registration is active, etc.
    (result, response, callback) => {

      modules.db.models.Org.updateOne({ _id: result.data.org._id }, {
        $inc: {
          sequence: 1
        },
        $set: {
          'configuration.scripting.scriptsEnabled': true,
          'configuration.legacyObjects': true,
          'configuration.maxApps': 10,
          'support.disableSupportLogin': false,
          'registration.allow': true,
          'registration.invitationRequired': false,
          'registration.activationRequired': false,
          'deployment.enabled': true,
          'deployment.supportOnly': false,
          'deployment.availability': 2
        }
      }, err => {
        callback(err, result, response)
      })
    },
    // ensure admin account is verified.
    (result, response, callback) => {

      modules.db.models.Account.updateOne({ _id: result.data.account._id }, {
        $set: {
          state: 'verified'
        }
      }, err => {
        callback(err, result, response)
      })
    },

    // ensure admin account is verified.
    (result, response, callback) => {

      modules.db.models.Account.updateOne({ _id: result.data.account._id }, {
        $set: {
          state: 'verified'
        }
      }, err => {
        callback(err, result, response)
      })
    },
    // load the org and account.
    (result, response, callback) => {

      modules.db.models.Org.findOne({ _id: result.data.org._id }, (err, model) => {
        if (err) {
          return callback(err)
        }
        newOrgData.org = model

        ap.create(newOrgData.org, result.data.account._id, (err, principal) => {
          if (!err) {
            newOrgData.admin = principal
            newOrgData.principals.admin = principal
          }
          callback(err)
        })
      })

    },
    (callback) => {

      let payload = [{
        label: 'Session App',
        enabled: true,
        clients: [{
          label: 'Session App',
          enabled: true,
          readOnly: false,
          sessions: true,
          csrf: false
        }]
      }]

      modules.db.models.Org.aclUpdatePath(newOrgData.admin, newOrgData.org._id, 'apps', payload, { method: 'post' }, (err, { ac }) => {

        if (!err) {
          newOrgData.appClient = ac.subject.apps[0].clients[0]
        }
        callback(err)

      })

    },

    (callback) => {

      modules.db.models.Callback.findOne({ targetId: newOrgData.admin._id, org: newOrgData.org._id }).exec((err, cb) => {

        if (!err && !cb) {
          err = Fault.create('kNotFound', { reason: 'pass-reset token not found.' })
        }
        if (err) {
          return callback(err)
        }

        supertest(server.api.expressApp)
          .post('/' + newOrgData.org.code + '/accounts/reset-password')
          .set(newOrgData.getSessionHeaders())
          .send({
            password: server.password,
            token: cb.token
          })
          .done(callback)

      })

    },

    // attempt to login as the administrator.
    (result, response, callback) => {

      let agent = supertest.agent(server.api.expressApp)
      agent
        .post('/' + newOrgData.org.code + '/accounts/login')
        .set(newOrgData.getSessionHeaders())
        .send({ email: newOrgData.admin.email, password: server.password })
        .done((err) => {
          if (!err) {
            newOrgData.session = agent
            newOrgData.sessions.admin = agent
            return callback()
          }
          modules.db.models.Callback.findOne({ handler: 'ver-location', target: newOrgData.admin.email }).lean().select({ token: 1 }).exec((err, ver) => {
            void err
            agent
              .post('/' + newOrgData.org.code + '/accounts/login')
              .set(newOrgData.getSessionHeaders())
              .send({ email: newOrgData.admin.email, password: server.password, location: { verificationToken: ver.token } })
              .done((err) => {
                newOrgData.session = agent
                newOrgData.sessions.admin = agent
                callback(err)

              })
          })
        })
    },
    (callback) => {

      const payload = {
              name: {
                first: 'Test',
                last: 'Provider'
              },
              email: 'james+provider@medable.com',
              mobile: '16049892489',
              password: server.password,
              roles: [acl.OrgProviderRole]
            }, options = {
              skipActivation: true,
              sendWelcomeEmail: false
            }

      modules.accounts.provisionAccount(newOrgData.principals.admin, payload, newOrgData.principals.admin.org, 'en_US', 'verified', null, options, (err) => {
        if (err) callback(err)
        else {
          let agent = supertest.agent(server.api.expressApp)
          agent.post(newOrgData.makeEndpoint('/accounts/login'))
            .set(newOrgData.getSessionHeaders())
            .send({ email: 'james+provider@medable.com', password: server.password })
            .done((err) => {
              if (!err) {
                newOrgData.sessions.provider = agent
                ap.create(newOrgData.org, 'james+provider@medable.com', (err, principal) => {
                  newOrgData.principals.provider = principal
                  callback(err)
                })
                return
              }
              modules.db.models.Callback.findOne({ handler: 'ver-location', target: 'james+provider@medable.com' }).lean().select({ token: 1 }).exec((err, ver) => {
                void err
                agent
                  .post(newOrgData.makeEndpoint('/accounts/login'))
                  .set(newOrgData.getSessionHeaders())
                  .send({ email: 'james+provider@medable.com', password: server.password, location: { verificationToken: ver.token } })
                  .done((err) => {
                    if (err) callback(err)
                    else {
                      newOrgData.sessions.provider = agent
                      ap.create(newOrgData.org, 'james+provider@medable.com', (err, principal) => {
                        newOrgData.principals.provider = principal
                        callback(err)
                      })
                    }
                  })
              })
            })
        }
      })

    },
    (callback) => {

      const payload = {
              name: {
                first: 'Test',
                last: 'Patient'
              },
              email: 'james+patient@medable.com',
              mobile: '16049892489',
              password: server.password
            },
            options = {
              skipActivation: true,
              sendWelcomeEmail: false
            }

      modules.accounts.provisionAccount(newOrgData.principals.admin, payload, newOrgData.principals.admin.org, 'en_US', 'verified', null, options, (err) => {
        if (err) callback(err)
        else {
          let agent = supertest.agent(server.api.expressApp)
          agent.post(newOrgData.makeEndpoint('/accounts/login'))
            .set(newOrgData.getSessionHeaders())
            .send({ email: 'james+patient@medable.com', password: server.password })
            .done((err) => {
              if (!err) {
                newOrgData.sessions.patient = agent
                ap.create(newOrgData.org, 'james+patient@medable.com', (err, principal) => {
                  newOrgData.principals.patient = principal
                  callback(err)
                })
                return
              }
              modules.db.models.Callback.findOne({ handler: 'ver-location', target: 'james+patient@medable.com' }).lean().select({ token: 1 }).exec((err, ver) => {
                void err
                agent
                  .post(newOrgData.makeEndpoint('/accounts/login'))
                  .set(newOrgData.getSessionHeaders())
                  .send({ email: 'james+patient@medable.com', password: server.password, location: { verificationToken: ver.token } })
                  .done((err) => {
                    if (err) callback(err)
                    else {
                      newOrgData.sessions.patient = agent
                      ap.create(newOrgData.org, 'james+patient@medable.com', (err, principal) => {
                        newOrgData.principals.patient = principal
                        callback(err)
                      })
                    }
                  })
              })
            })
        }
      })

    },
    callback => {
      newOrgData.updateOrg(callback)
    }
  ], function(err) {
    callback(err, newOrgData)
  })

}
