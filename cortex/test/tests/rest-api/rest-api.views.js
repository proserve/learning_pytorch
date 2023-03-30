'use strict'

/* global before */

const should = require('should'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl')

describe('Rest Api', function() {

  describe('Views', function() {

    let customView

    before(function(callback) {

      modules.db.models.view.aclCreate(
        server.principals.admin,
        {
          label: 'c_custom_view',
          name: 'c_custom_view',
          sourceObject: 'account',
          acl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
          objectAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier, allow: acl.AccessLevels.Connected }]
        },
        (err, { ac }) => {
          customView = ac.subject
          callback(err)
        }
      )

    })

    describe('GET /views/number-of-user-accounts', function() {

      it('should run the view', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/views/number-of-user-accounts?where=' + encodeURIComponent('{"createdOnOrAfter": "' + new Date().toISOString() + '", "createdOnOrBefore": "' + new Date().toISOString() + '"}')))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.object, 'list')
            callback()
          })
      })

    })

    describe('GET /views/number-of-logins-since', function() {

      it('should run the view', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/views/number-of-logins-since?where=' + encodeURIComponent('{"since": "' + new Date().toISOString() + '"}')))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.object, 'list')
            callback()
          })
      })

    })

    describe('GET /views/missing-built-in-view', function() {

      it('should fail to run the view', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/views/missing-built-in-view'))
          .set(server.getSessionHeaders())
          .done(function(err) {
            should.exist(err)
            should.equal(err.code, 'kNotFound')
            callback()
          })
      })

    })

    describe('GET /views/number-of-logins-since/run', function() {

      it('should run the legacy route', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/views/number-of-logins-since/run?where=' + encodeURIComponent('{"since": "' + new Date().toISOString() + '"}')))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.object, 'list')
            callback()
          })
      })

    })

    describe('GET /views/c_custom_view', function() {

      it('should run the custom view', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/views/c_custom_view'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.object, 'list')
            callback()
          })
      })

    })

    describe('GET /views/:id/run', function() {

      it('should run the legacy route using the id', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/views/' + customView._id + '/run'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.object, 'list')
            callback()
          })
      })

    })

    describe('GET /views/:code', function() {

      it('should skip to using the object reading route.', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/views/' + customView._id))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'view')
            callback()
          })
      })

    })

  })

})
