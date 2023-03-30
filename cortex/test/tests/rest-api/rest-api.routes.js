'use strict'

/* global before, after */

const server = require('../../lib/server'),
      should = require('should'),
      supertest = require('supertest'),
      async = require('async'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl')

describe('Rest Api', function() {

  describe('Routes', function() {

    let lowPriorityScript, highPriorityScript, blankRouteScript, sessionApp

    // create 2 route scripts with high and low priority.
    before(function(callback) {

      sessionApp = server.org.apps.filter(app => app.clients[0].sessions === true)[0]

      var Script = modules.db.models.Script

      async.series([

        // create route with a low priority.
        callback => {
          Script.aclCreate(server.principals.admin, {
            label: 'Low Priority',
            type: 'route',
            script: 'return "low priority"',
            configuration: {
              acl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
              method: 'get',
              path: '/priority/foo/bar',
              priority: 0
            }
          }, (err, { ac }) => {
            if (!err) {
              lowPriorityScript = ac.subject
            }
            callback(err)
          })
        },

        // create route with a high priority.
        callback => {
          Script.aclCreate(server.principals.admin, {
            label: 'High Priority',
            type: 'route',
            script: 'return "high priority"',
            configuration: {
              acl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
              method: 'get',
              path: '/priority/:foo/bar',
              priority: 100
            }
          }, (err, { ac }) => {
            if (!err) {
              highPriorityScript = ac.subject
            }
            callback(err)
          })
        },

        // create blank route
        callback => {
          Script.aclCreate(server.principals.admin, {
            label: 'Blank Route',
            type: 'route',
            script: 'return "blank get route"',
            configuration: {
              acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole }],
              method: 'get',
              path: ''
            }
          }, (err, { ac }) => {
            if (!err) {
              blankRouteScript = ac.subject
            }
            callback(err)
          })
        },

        // create route that runs as the provider principal.
        callback => {
          Script.aclCreate(server.principals.admin, {
            label: 'Runs As Provider',
            type: 'route',
            script: 'return script.principal._id',
            principal: server.principals.provider._id,
            configuration: {
              acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgProviderRole }],
              method: 'get',
              path: '/run_as_provider_principal'
            }
          }, callback)
        },

        // create route that accepts urlEncoded
        callback => {
          Script.aclCreate(server.principals.admin, {
            label: 'urlEncoded Test',
            type: 'route',
            script: 'return require("request").body',
            configuration: {
              acl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
              method: 'post',
              path: '/encoding/urlEncoded',
              urlEncoded: true
            }
          }, callback)
        },

        // create route that accepts plainText
        callback => {
          Script.aclCreate(server.principals.admin, {
            label: 'plainText Test',
            type: 'route',
            script: 'return require("request").body',
            configuration: {
              acl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
              method: 'post',
              path: '/encoding/plainText',
              plainText: true
            }
          }, callback)
        },

        // create an app pinned route we can call without an api key (and anonymously)
        callback => {
          Script.aclCreate(server.principals.admin, {
            label: 'Pinned Route',
            type: 'route',
            script: 'return require("request").client.key',
            configuration: {
              acl: [{ type: acl.AccessTargets.Account, target: acl.AnonymousIdentifier }],
              method: 'get',
              path: '/app_pinned',
              apiKey: sessionApp._id
            }
          }, callback)
        }

      ], err => {
        callback(err)
      })
    })

    // this one might get in the way of other tests.
    after(function(callback) {
      if (blankRouteScript) {
        blankRouteScript.remove(err => callback(err))
      } else {
        callback()
      }
    })

    describe('GET /routes', function() {

      it('should not run because scripts are disabled', function(callback) {
        // ensure scripts are disabled
        async.series([

          callback => {
            modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.scripting.scriptsEnabled': false } }, () => {
              server.updateOrg(callback)
            })
          },

          callback => {
            server.sessions.provider
              .get(server.makeEndpoint('/routes'))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                should.exist(err)
                err.errCode.should.equal('cortex.accessDenied.scriptsDisabled')
                callback()
              })
          }

        ], err => {

          modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.scripting.scriptsEnabled': true } }, () => {
            server.updateOrg(() => {
              callback(err)
            })
          })

        })
      })

      it('should fail with access denied', function(callback) {

        server.sessions.provider
          .get(server.makeEndpoint('/routes'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.exist(err)
            err.errCode.should.equal('cortex.accessDenied.route')
            callback()
          })

      })

      it('should route successfully for a blank route', function(callback) {

        server.sessions.admin
          .get(server.makeEndpoint('/routes'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.data, 'blank get route')
            callback()
          })

      })

    })

    describe('GET /routes/missing_route', function() {

      it('should not fail for a missing route', function(callback) {

        server.sessions.provider
          .get(server.makeEndpoint('/routes/missing_route'))
          .set(server.getSessionHeaders())
          .done(function(err) {
            should.exist(err)
            err.errCode.should.equal('cortex.notFound.route')
            err.path.should.equal('/routes/missing_route')
            callback()
          })

      })

    })

    describe('GET /routes/run_as_provider_principal', function() {

      it('should run as the test provider principal', function(callback) {

        server.sessions.patient
          .get(server.makeEndpoint('/routes/run_as_provider_principal'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.data, server.principals.provider._id, 'result should match test provider account id')
            callback()
          })

      })

    })

    describe('GET /routes/encoding/urlEncoded', function() {

      it('should return the result sent as application/x-www-form-urlencoded', function(callback) {

        var data = { a: 'b', c: ['1', '2', '3', 'd'], e: { f: { g: 'h' } } }
        server.sessions.patient
          .post(server.makeEndpoint('/routes/encoding/urlEncoded'))
          .set(server.getSessionHeaders())
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(data)
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.deepEqual(result.data, data, 'result should match sent payload')
            callback()
          })

      })

    })

    describe('GET /routes/encoding/plainText', function() {

      it('should return the result sent as text/plain', function(callback) {

        var data = JSON.stringify({ a: 'b', c: [1, 2, 3, 'd'], e: { f: { g: 'h' } } })
        server.sessions.patient
          .post(server.makeEndpoint('/routes/encoding/plainText'))
          .set(server.getSessionHeaders())
          .set('Content-Type', 'text/plain')
          .send(data)
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.deepEqual(result.data, data, 'result should match sent payload')
            callback()
          })

      })

    })

    describe('GET /routes/app_pinned', function() {

      it('should be able to be called anonymously without a session or app key.', function(callback) {

        supertest(server.api.expressApp)
          .get(server.makeEndpoint('/routes/app_pinned'))
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.data, sessionApp.clients[0].key, 'result should match the pinned app key')
            callback()
          })

      })

    })

    describe('GET /routes/priority/foo/bar', function() {

      it('should select high priority route', function(callback) {

        server.sessions.provider
          .get(server.makeEndpoint('/routes/priority/foo/bar'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.data, 'high priority')
            callback()
          })

      })

      it('should select new high priority route', function(callback) {

        async.series([

          callback => {
            modules.db.models.Script.aclUpdate(server.principals.admin, {
              _id: lowPriorityScript._id
            }, {
              configuration: {
                priority: highPriorityScript.configuration.priority + 1
              }
            }, {
              method: 'PUT'
            }, (err, { ac }) => {
              if (!err) {
                lowPriorityScript = ac.subject
              }
              callback(err)
            })
          },

          callback => {
            server.sessions.provider
              .get(server.makeEndpoint('/routes/priority/foo/bar'))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.exist(result.data)
                should.equal(result.data, 'low priority')
                callback()
              })
          }

        ], callback)
      })

    })

  })

})
