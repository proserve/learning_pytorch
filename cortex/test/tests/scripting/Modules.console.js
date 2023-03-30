'use strict'

/* global script */

const server = require('../../lib/server'),
      acl = require('../../../lib/acl'),
      wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  main: function() {

    /* global sys */

    require('should')

    let cursor
    script.as('james+admin@medable.com', { safe: false }, () => {
      cursor = sys.tail('console')
    })

    console.log('not much going on in here')
    console.time('foo') // deprecated but should not throw
    console.timeEnd('foo') // deprecated but should not throw
    console.timeEnd('bogus') // deprecated but should not throw
    console.count('foo') // deprecated but should not throw
    console.count('foo') // deprecated but should not throw
    console.count('foo') // deprecated but should not throw
    console.log('log')
    console.info('info')
    console.error('error')
    console.warn('warn')
    console.table('huh?') // deprecated but should not throw

    // send too much. will fail silently
    var large = 'lots'
    while (large.length < 245760) {
      large += large
    }
    console.log(large)

    console.log('after')

    cursor.next().message[0].should.equal('not much going on in here')
    cursor.next().message[0].should.equal('log')
    cursor.next().message[0].should.equal('info')
    cursor.next().message[0].should.equal('error')
    cursor.next().message[0].should.equal('warn')
    cursor.next().message[0].should.equal('after')

    return true

  },

  skip: true,

  before: function(ac, model, callback) {

    // install as a route for this to work properly.
    model.type = 'route'
    model.configuration = {
      method: 'Get',
      path: '/console-test-path',
      acl: [{ type: 1, target: '000000000000000000000003' }],
      authValidation: 'legacy'
    }

    const modelAc = new acl.AccessContext(ac.principal, model)
    modelAc.save(function(err) {

      if (err) return callback(err)

      // trigger request
      server.sessions.provider
        .get(server.makeEndpoint('/routes/console-test-path'))
        .set(server.getSessionHeaders())
        .done((err, result, response) => {
          callback(err)
        })

    })

  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
