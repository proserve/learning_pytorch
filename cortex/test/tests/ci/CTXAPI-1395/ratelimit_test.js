const sandboxed = require('../../../lib/sandboxed'),
  { promised } = require('../../../../lib/utils'), 
  loadScript = require('../../../lib/script.loader'),
  server = require('../../../lib/server'), 
  acl = require('../../../../lib/acl'),
  modules = require('../../../../lib/modules'), 
  should = require('should')

describe('Issues - CTXAPI-1395 - Ratelimit count not reducing', function () {

  let token = null

  before((done) => {
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.scripting.enableViewTransforms': true,
        'configuration.scripting.enableApiPolicies': true
      }
    }, () => {
      server.updateOrg(done)
    })
  })

  before(async() => {
    token = await promised(modules.authentication, 'createToken',
      new acl.AccessContext(server.principals.admin),
      server.principals.admin.email,
      server.sessionsClient.key, {
        scope: ['*']
      })
  })

  before(async () => {
      const policiesScript = loadScript('../scripts/CTXAPI-1395_RateLimitPolicy.js')
      await promised(null, sandboxed(function() {
        /* global script, org */
        org.objects.scripts.insertOne({
          label: 'CTXAPI-1395 Policies Library',
          name: 'c_ctxapi_1395_policies_lib',
          description: 'Library for policies',
          type: 'library',
          script: script.arguments.policiesScript,
          configuration: {
            export: 'c_ctxapi_1395_policies_lib'
          }
        }).execute()
      }, {
        principal: server.principals.admin,
        runtimeArguments: {
          policiesScript
        }
      }))
  })

  after(sandboxed(function() {
    /* global org */
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_1395_policies_lib' }).execute()
  }))

  it('should reduce ratelimit remaining to 299 after 1st request', (callback) => {
    server.sessions.admin
      .get(server.makeEndpoint('/routes/test-policy-ratelimit'))
      .set({ Authorization: `Bearer ${token.token}` })
      .done((err, body, response) => {
        should.equal(response.headers['x-rate-limit-limit'], 300)
        should.equal(response.headers['x-rate-limit-remaining'], 299)
        should.equal(response.headers['x-rate-limit-reset'], 300)
        callback()
      })
  })

  it('should reduce ratelimit remaining to 298 after 2nd request', (callback) => {
    server.sessions.admin
      .get(server.makeEndpoint('/routes/test-policy-ratelimit'))
      .set({ Authorization: `Bearer ${token.token}` })
      .done((err, body, response) => {
        should.equal(response.headers['x-rate-limit-limit'], 300)
        should.equal(response.headers['x-rate-limit-remaining'], 298)
        callback()
      })
  })
})
