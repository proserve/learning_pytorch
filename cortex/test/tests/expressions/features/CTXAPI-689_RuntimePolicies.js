'use strict'
const server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      loadScript = require('../../../lib/script.loader'),
      modules = require('../../../../lib/modules'),
      acl = require('../../../../lib/acl'),
      { promised } = require('../../../../lib/utils'),
      should = require('should')

describe('Expressions - Runtime policies', function() {

  let token = null

  before(async() => {
    const policiesScript = loadScript('CTXAPI-689_RuntimePolicy.js')
    await promised(null, sandboxed(function() {
      /* global script, org */
      org.objects.scripts.insertOne({
        label: 'CTXAPI-689 Policies Library',
        name: 'c_ctxapi_689_policies_lib',
        description: 'Library for policies',
        type: 'library',
        script: script.arguments.policiesScript,
        configuration: {
          export: 'c_ctxapi_689_policies_lib'
        }
      }).execute()
    }, {
      principal: server.principals.admin,
      runtimeArguments: {
        policiesScript
      }
    }))
  })

  before(async() => {
    token = await promised(modules.authentication, 'createToken',
      new acl.AccessContext(server.principals.admin),
      server.principals.admin.email,
      server.sessionsClient.key, {
        scope: ['*']
      })
  })

  after(sandboxed(function() {

    org.objects.scripts.deleteOne({ name: 'c_ctxapi_689_policies_lib' }).execute()

  }))

  it('check expressions on runtime GET policy - true (operators $not $eq)', (callback) => {
    server.sessions.admin
      .get(server.makeEndpoint('/routes/c_ctxapi689_policy?id=1213'))
      .set({ Authorization: `Bearer ${token.token}` })
      .done((err, body, response) => {
        should.exist(err)
        should.equal(err.reason, 'Error occurred - Value is different than 1212')
        should.equal(response.status, 500)
        callback()
      })
  })

  it('check expressions on runtime GET policy - false (operators $not $eq)', (callback) => {
    server.sessions.admin
      .get(server.makeEndpoint('/routes/c_ctxapi689_policy?id=1212'))
      .set({ Authorization: `Bearer ${token.token}` })
      .done((err, body, response) => {
        should.not.exist(err)
        should.equal(response.body.object, 'result')
        should.equal(response.body.data, 'The get request was executed!')
        should.equal(response.status, 200)
        callback()
      })
  })

  it('check expressions on runtime POST policy - true (operators $gte $dateFromString)', (callback) => {
    server.sessions.admin
      .post(server.makeEndpoint('/routes/c_689_post_policy'))
      .set({ Authorization: `Bearer ${token.token}` })
      .send({ theNumber: 1010 })
      .done((err, body, response) => {
        should.exist(err)
        should.equal(err.reason, 'Date is greater or equal on date limit configured')
        should.equal(response.status, 500)
        callback()
      })
  })

})
