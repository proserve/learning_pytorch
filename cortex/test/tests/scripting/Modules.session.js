'use strict'

const server = require('../../lib/server'),
      acl = require('../../../lib/acl'),
      wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  skip: true,

  main: function() {

    const session = require('session'),
          should = require('should'),
          a = {},
          b = {},
          c = { this: { is: ['it'] } }

    should.equal(true, session.exists, 'session should exist')

    session.set('some.path', { foo: 'bar' })
    should.equal('bar', session.get('some.path.foo'), 'session set and get should match')

    session.set('some.path.foo', 'baz')
    should.equal('baz', session.get('some.path.foo'), 'session set and get should match')

    session.set('some.path', null)
    should.equal(null, session.get('some.path'), 'session set and get should match')

    session.set(null)
    should.deepEqual({}, session.get(), 'setting session to null should then return blank object')

    // try something weird.
    a.b = b
    b.a = a
    a.c = [a, b]

    session.set('deep', a)
    should.notDeepEqual(a, session.get('deep'), 'session set and get should not match')

    session.set('stuff', c)
    should.deepEqual(c, session.get('stuff'), 'session set and get should match');

    (function breachSessionStorage() {
      try {
        var string = 'long'
        while (string.length < 8192) {
          string += string
        }
        session.set('some.path', string)
      } catch (err) {
        if (~(err.reason || '').indexOf('Breached maximum sandbox session storage limit')) {
          return
        }
        throw err
      }
      throw new Error('breachSessionStorage should cause an error.')
    }())

    return true

  },

  before: function(ac, model, callback) {

    // install as a route for this to work properly.
    model.type = 'route'
    model.configuration = {
      method: 'Get',
      path: '/session-test-path',
      acl: [{ type: 1, target: '000000000000000000000003' }],
      authValidation: 'legacy'
    }

    const modelAc = new acl.AccessContext(ac.principal, model)
    modelAc.save(function(err) {

      if (err) return callback(err)

      // trigger request
      server.sessions.provider
        .get(server.makeEndpoint('/routes/session-test-path'))
        .set(server.getSessionHeaders())
        .done(callback)

    })

  }
}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
