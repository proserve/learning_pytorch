'use strict'

/* global before, after */

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server')

describe('Issues', function() {

  describe('CTXAPI-107 - updating notification preferences', function() {

    // set a known notification to user-selectable
    let notifState

    before(function(callback) {
      sandboxed(function() {
        var notifState = org.read('configuration/notifications/4e662041637457656c636f6d/endpoints/456e64706f696e7420456d6c/state')
        org.update('configuration/notifications/4e662041637457656c636f6d/endpoints/456e64706f696e7420456d6c/state', 'User')
        return notifState
      })(function(err, result) {
        if (err) {
          return callback(err)
        }
        notifState = result
        server.updateOrg(callback)
      })
    })

    after(function(callback) {
      sandboxed(function() {
        org.update('configuration/notifications/4e662041637457656c636f6d/endpoints/456e64706f696e7420456d6c/state', script.arguments.notifState)
        return script.arguments.notifState
      },
      'admin', 'route', 'javascript', 'es6', { notifState }
      )(function(err, result) {
        if (err) {
          return callback(err)
        }
        notifState = result
        server.updateOrg(callback)
      })

    })

    it('should update notification preferences', sandboxed(function() {

      /* global org, script */

      require('should')

      let err, notifState = script.principal.read('preferences/notifications/4e662041637457656c636f6d/endpoints/456e64706f696e7420456d6c/enabled')

      try {

        script.principal.update('preferences/notifications/4e662041637457656c636f6d/endpoints/456e64706f696e7420456d6c/enabled', true)
        script.principal.read('preferences/notifications/4e662041637457656c636f6d/endpoints/456e64706f696e7420456d6c/enabled').should.equal(true)

        script.principal.update('preferences/notifications/4e662041637457656c636f6d/endpoints/456e64706f696e7420456d6c/enabled', false)
        script.principal.read('preferences/notifications/4e662041637457656c636f6d/endpoints/456e64706f696e7420456d6c/enabled').should.equal(false)

      } catch (e) {
        err = e
      }

      // another failure mode is if this fails to update.
      script.principal.update('preferences/notifications/4e662041637457656c636f6d/endpoints/456e64706f696e7420456d6c/enabled', notifState)

      if (err) {
        throw err
      }

    }))

  })

})
