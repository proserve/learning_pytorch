'use strict'

const async = require('async'),
      server = require('./server'),
      modules = require('../../lib/modules'),
      ap = require('../../lib/access-principal'),
      acl = require('../../lib/acl'),
      utils = require('../../lib/utils'),
      _ = require('underscore'),
      supertest = require('supertest')

module.exports = function(email, callback) {

  let baseAdmin = null,
      medableOrg = {
        org: null,
        appClient: null,
        admin: null,
        session: null,
        getHeaders: function() {
          return { 'Medable-Client-Key': this.appClient.key }
        }
      }

  async.waterfall([
    // get medable org session app client
    callback => {

      modules.db.models.org.findOne({ _id: acl.BaseOrg }, (err, org) => {
        if (!err) {
          medableOrg.org = org
          medableOrg.appClient = org.apps[1].clients[0]
          baseAdmin = {
            email: email,
            password: server.password,
            name: { first: 'System', last: 'Admin' },
            mobile: '+353868044914',
            roles: [acl.OrgAdminRole]
          }
        }
        callback(err)
      })
    },
    // provision a new account for logging into medable
    callback => modules.accounts.provisionAccount(
      null,
      baseAdmin,
      medableOrg.org,
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
          if (err.errCode === 'cortex.conflict.duplicateKey' ||
                        (err.errCode === 'cortex.conflict.duplicateEmail') ||
                        (err.errCode === 'cortex.invalidArgument.validation' && utils.array(err.faults).length === 1 && _.find(err.faults, f => f.errCode === 'cortex.conflict.duplicateEmail'))
          ) {
            err = null
          }
        }
        callback(err)
      }
    ),
    // login the account
    callback => {
      let login = { email: baseAdmin.email, password: server.password },
          agent = supertest.agent(server.api.expressApp)
      agent
        .post('/medable/accounts/login')
        .set({ 'Medable-Client-Key': medableOrg.appClient.key })
        .send(login)
        .done((err, result) => {
          if (!err) {
            medableOrg.session = agent
            ap.create(medableOrg.org, result._id, (err, principal) => {
              if (!err) {
                medableOrg.admin = principal
              }
              callback()
            })
          } else {
            modules.db.models.Callback.findOne({ handler: 'ver-location', target: baseAdmin.email }).lean().select({ token: 1 }).exec((err, ver) => {
              void err
              agent
                .post('/medable/accounts/login')
                .set({ 'Medable-Client-Key': medableOrg.appClient.key })
                .send({ email: baseAdmin.email, password: server.password, location: { verificationToken: ver.token } })
                .done((err, result) => {
                  if (err) {
                    return callback(err)
                  }
                  medableOrg.session = agent
                  ap.create(medableOrg.org, result._id, (err, principal) => {
                    if (!err) {
                      medableOrg.admin = principal
                    }
                    callback(err)
                  })
                })
            })
          }
        })
    }
  ], function(err) {
    callback(err, medableOrg)
  })

}
