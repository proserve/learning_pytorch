'use strict'

const server = require('../../lib/server'),
      wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  main: function() {

    const req = require('request'),
          should = require('should');

    (function() {
      try {
        req.getCookie('')
      } catch (err) {
        if (err.reason === 'Missing cookie name') {
          return
        }
        throw err
      }
      throw new Error('Missing cookie name should cause an error.')
    }());

    (function() {
      try {
        req.getCookie('md.sid')
      } catch (err) {
        if (err.code === 'kAccessDenied') {
          return
        }
        throw err
      }
      throw new Error('loading md. cookie should cause an error.')
    }())

    should.equal(req.getHeader('X-Medable-Test-Header'), 'Test', 'X-Medable-Test-Header')
    should.equal(req.getCookie('X-Medable-Test-Cookie'), 'Test', 'X-Medable-Test-Cookie')

    return true

  },

  before: function(ac, model, callback) {

    server.events.once('request', function(req, res) {
      ac.req = req
    })

    // set test cookie.
    server.sessions.provider.jar.setCookie('X-Medable-Test-Cookie=Test')

    // trigger request
    server.sessions.provider
      .get('/test-org/')
      .set({ 'Medable-Client-Key': server.sessionsClient.key, 'X-Medable-Test-Header': 'Test' })
      .done((err) => {
        callback(err)
      })

  }
}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
