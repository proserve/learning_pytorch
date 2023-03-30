'use strict'

const server = require('../../lib/server'),
      should = require('should'),
      { promised } = require('../../../lib/utils'),
      sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('CTXAPI-187 - policies with apps', function() {

    before(async() => {

      await server.org.constructor.updateOne({ _id: server.org._id }, { $inc: { sequence: 1 }, $set: { 'configuration.maxApps': 100 } })

      await promised(server, 'updateOrg')

      await promised(null, sandboxed(function() {

        /* global org, script */

        org.objects.org.updateOne({ code: script.org.code }, {
          $push: {
            apps: [{
              name: 'c_ctxapi_187',
              label: 'c_ctxapi_187',
              enabled: true,
              clients: [{
                label: 'c_ctxapi_187',
                enabled: true,
                readOnly: false,
                sessions: true
              }]
            }, {
              name: 'c_ctxapi_187_no_policy',
              label: 'c_ctxapi_187_no_policy',
              enabled: true,
              clients: [{
                label: 'c_ctxapi_187_no_policy',
                enabled: true,
                readOnly: false,
                sessions: true
              }]
            }]
          }
        }).execute()

        const appId = org.read('apps').find(v => v.name === 'c_ctxapi_187')._id

        org.objects.org.updateOne({ code: script.org.code }, {
          $push: {
            policies: [{
              name: 'c_ctxapi_187_allow',
              label: 'c_ctxapi_187_allow',
              priority: 100,
              active: true,
              condition: 'and',
              action: 'Allow',
              methods: ['get'],
              appBlacklist: [appId],
              paths: ['/routes/c_ctxapi_187'],
              halt: true
            }, {
              name: 'c_ctxapi_187_deny',
              label: 'c_ctxapi_187_deny',
              priority: 99,
              active: true,
              condition: 'and',
              action: 'Deny',
              appBlacklist: [appId],
              faultCode: 'kAccessDenied',
              faultStatusCode: 403,
              faultReason: 'denied by policy c_ctxapi_187_deny'
            }]
          }
        }).execute()

        org.objects.script.insertOne({
          label: 'c_ctxapi_187',
          name: 'c_ctxapi_187',
          type: 'route',
          script: ` return 'c_ctxapi_187' `,
          configuration: {
            acl: 'account.public',
            method: 'get',
            path: '/c_ctxapi_187'
          }
        }).execute()

      }))

      await promised(server, 'updateOrg')

    })

    after(async() => {

      await promised(null, sandboxed(function() {

        /* global org, script */

        org.objects.org.updateOne({ code: script.org.code }, {
          $pull: {
            policies: ['c_ctxapi_187_allow', 'c_ctxapi_187_deny']
          }
        }).execute()

        org.objects.org.updateOne({ code: script.org.code }, {
          $pull: {
            apps: ['c_ctxapi_187', 'c_ctxapi_187_no_policy']
          }
        }).execute()

      }))

      await promised(server, 'updateOrg')

    })

    // ------------------------------------------------

    it('calling the policy restricted route with the correct app', function(callback) {

      const key = server.org.apps.find(v => v.name === 'c_ctxapi_187').clients[0].key

      server.sessions.admin
        .get(server.makeEndpoint('/routes/c_ctxapi_187'))
        .set(server.getSessionHeaders({ key }))
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'result')
          should.equal(result.data, 'c_ctxapi_187')
          callback()
        })

    })

    it('calling another route with policy restricted app', function(callback) {

      const key = server.org.apps.find(v => v.name === 'c_ctxapi_187').clients[0].key

      server.sessions.admin
        .get(server.makeEndpoint('/accounts/me'))
        .set(server.getSessionHeaders({ key }))
        .done(function(err, result) {
          should.exist(err)
          should.equal(err.code, 'kAccessDenied')
          callback()
        })

    })

    it('calling the policy restricted route with another app', function(callback) {

      const key = server.org.apps.find(v => v.name === 'c_ctxapi_187_no_policy').clients[0].key

      server.sessions.admin
        .get(server.makeEndpoint('/routes/c_ctxapi_187'))
        .set(server.getSessionHeaders({ key }))
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'result')
          should.equal(result.data, 'c_ctxapi_187')
          callback()
        })

    })

    it('calling another route with policy another app', function(callback) {

      const key = server.org.apps.find(v => v.name === 'c_ctxapi_187_no_policy').clients[0].key

      server.sessions.admin
        .get(server.makeEndpoint('/accounts/me'))
        .set(server.getSessionHeaders({ key }))
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'account')
          callback()
        })

    })

  })

})
