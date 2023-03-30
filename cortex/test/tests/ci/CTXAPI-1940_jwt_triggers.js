const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      { promised } = require('../../../lib/utils'),
      assert = require('assert'),
      supertest = require('supertest')

describe('JWT triggers - #CTXAPI-1940', function() {
  before(sandboxed(function() {
    /* global org */

    org.objects.scripts.insertOne({
      label: 'CTXAPI-1940 JWT triggers',
      name: 'c_ctxapi_1940_jwt_trigger',
      description: 'authorizeToken.after trigger test',
      type: 'trigger',
      script: `
      const cache = require('cache')
      cache.set('CTXAPI-1940', 'yes I ran')
      `,
      configuration: {
        object: 'account',
        event: 'authorizeToken.after'
      }
    }
    ).execute()
  }))

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_1940_jwt_trigger' }).execute()
  }))

  afterEach(sandboxed(function() {
    return require('cache').del('CTXAPI-1940')
  }))

  it('Should fire authorizeToken.after trigger when authorizing through sandbox', async() => {
    // create a token and authorize account using that token
    await promised(null, sandboxed(function() {
      /* global org, script */
      let token = org.objects.account.createAuthToken(
        script.arguments.apiKey,
        script.arguments.email,
        {
          scope: [
            '*'
          ]
        }
      )

      org.objects.account.authorizeToken(token)
    }, {
      runtimeArguments: {
        email: server.principals.admin.email,
        apiKey: server.sessionsClient.key
      }
    }))

    // get cache result to check if trigger did run.
    let cacheResult = await promised(null, sandboxed(function() {
      return require('cache').get('CTXAPI-1940')
    }))

    assert.strictEqual(cacheResult, 'yes I ran')
  })

  it('Should fire authorizeToken.after trigger when authorizing through API', async() => {
    // create a token to use for authorization
    const token = await promised(null, sandboxed(function() {
      /* global org, script */
      let token = org.objects.account.createAuthToken(
        script.arguments.apiKey,
        script.arguments.email,
        {
          scope: [
            '*'
          ]
        }
      )
      return token
    }, {
      runtimeArguments: {
        email: server.principals.admin.email,
        apiKey: server.sessionsClient.key
      }
    }))

    // authorize through API
    await supertest(server.api.expressApp)
      .get(server.makeEndpoint('/accounts'))
      .expect(200)
      .set({
        'Medable-Client-Key': server.sessionsClient.key,
        'Authorization': 'Bearer ' + token
      })
      .then()

    // get cache result to check if trigger did run.
    let cacheResult = await promised(null, sandboxed(function() {
      return require('cache').get('CTXAPI-1940')
    }))

    assert.strictEqual(cacheResult, 'yes I ran')
  })

})
