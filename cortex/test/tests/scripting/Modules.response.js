'use strict'

const server = require('../../lib/server'),
      utils = require('../../../lib/utils'),
      acl = require('../../../lib/acl'),
      wrapper = require('../../lib/wrapped_sandbox'),
      should = require('should')

module.exports = {

  skip: true,

  main: function() {

    // noinspection NpmUsedModulesInstalled
    const res = require('response')

    res.setCookie('X-Medable-Test-Set-Cookie', 'Test')
    res.setCookie('X-Medable-Test-Set-Cookie-Aged', 'Test', { maxAge: 10 })
    res.setCookie('X-Medable-Test-Set-Cookie-Aged', 'Test', { maxAge: -1111111111 })
    res.setCookie('X-Medable-Test-Set-Cookie-Aged', 'Test', { maxAge: 1111111111 })
    res.setCookie('X-Medable-Test-Set-Cookie-Aged', 'Test', { maxAge: 3428973894723894728942734892374 })
    res.setCookie('X-Medable-Test-Set-Cookie-Aged', 'Test', { maxAge: -Infinity })
    res.setCookie('X-Medable-Test-Set-Cookie-Aged', 'Test', { maxAge: Infinity })

    res.clearCookie('X-Medable-Test-Unset-Cookie')

    res.setHeader('X-Medable-Test-Header', 'Test')

    // weird header values
    res.setHeader('X-Medable-Bad-Test-Header')
    res.setHeader('X-Medable-Bad-Test-Header', null)
    res.setHeader('X-Medable-Bad-Test-Header', undefined)
    res.setHeader('X-Medable-Bad-Test-Header', {})
    res.setHeader('X-Medable-Bad-Test-Header', { a: 1 })
    res.setHeader('X-Medable-Bad-Test-Header', [])
    res.setHeader('X-Medable-Bad-Test-Header', [1, 2, 3])
    res.setHeader('X-Medable-Bad-Test-Header', function() { return 'ouch!' })

    res.setStatusCode(202);

    (function invalidHeaderName() {
      try {
        res.setHeader('', 'value')
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error('invalidHeaderName should cause an error.')
    }());

    (function illegalHeaderName() {
      try {
        res.setHeader('access-control-allow-origin', 'EvilHost')
      } catch (err) {
        if (err.code === 'kAccessDenied') {
          return
        }
        throw err
      }
      throw new Error('illegalHeaderName should cause a kAccessDenied error.')
    }());

    (function missingCookieName() {
      try {
        res.setCookie()
      } catch (err) {
        if (err.reason === 'Missing cookie name') {
          return
        }
        throw err
      }
      throw new Error('missingCookieName should cause an error.')
    }());

    (function illegalCookieName() {
      try {
        res.setCookie('md.sid')
      } catch (err) {
        if (err.code === 'kAccessDenied') {
          return
        }
        throw err
      }
      throw new Error('illegalCookieName should cause an error.')
    }())

    res.write('okay!')
    res.write(123); // <-- coverage (converts to string)

    (function setHeaderAfterWrite() {
      try {
        res.setHeader('not okay!')
      } catch (err) {
        if (err.errCode === 'script.error.headersWritten') {
          return
        }
        throw err
      }
      throw new Error('setHeaderAfterWrite should cause an error.')
    }());

    (function setStatusCodeAfterWrite() {
      try {
        res.setStatusCode(500)
      } catch (err) {
        if (err.errCode === 'script.error.headersWritten') {
          return
        }
        throw err
      }
      throw new Error('setStatusCodeAfterWrite should cause an error.')
    }());

    (function setCookieAfterWrite() {
      try {
        res.setCookie('hey-hey', 'blow the man down')
      } catch (err) {
        if (err.errCode === 'script.error.headersWritten') {
          return
        }
        throw err
      }
      throw new Error('setCookieAfterWrite should cause an error.')
    }())

    return true
  },

  before: function(ac, model, callback) {

    // install as a route for this to work properly.
    model.type = 'route'
    model.configuration = {
      method: 'Get',
      path: '/response-test-path',
      acl: [{ type: 1, target: '000000000000000000000003' }],
      authValidation: 'legacy'

    }

    const modelAc = new acl.AccessContext(ac.principal, model)
    modelAc.save(function(err) {

      if (err) return callback(err)

      // set test cookie.
      server.sessions.provider.jar.setCookie('X-Medable-Test-Unset-Cookie=Test')

      // trigger request
      server.sessions.provider
        .get(server.makeEndpoint('/routes/response-test-path'))
        .set(server.getSessionHeaders())
        .done((err, result, response) => {

          should.not.exist(err);
          (response.headers['X-Medable-Test-Header'.toLowerCase()] || '').should.equal('Test');
          (response.text || '').should.equal('okay!123')
          response.statusCode.should.equal(202)

          const cookies = utils.array(response.headers['set-cookie']).reduce((cookies, cookie) => {
            const parts = cookie.split(';'),
                  entry = (parts[0] || '').split('=').map(v => v.trim())

            if (entry[1]) {
              cookies[entry[0].toLowerCase()] = entry[1]
            }
            return cookies
          }, {})

          should.not.exist(cookies['X-Medable-Test-Unset-Cookie'.toLowerCase()])
          should.equal(cookies['X-Medable-Test-Set-Cookie'.toLowerCase()], 'Test')

          // now, call as non-route to test false branches for creating the runtime esponse object in the script.
          model.type = 'job'

          callback(err)

        })

    })

  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
