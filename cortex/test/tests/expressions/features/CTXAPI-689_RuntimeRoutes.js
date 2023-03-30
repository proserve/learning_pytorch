'use strict'
const server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      loadScript = require('../../../lib/script.loader'),
      modules = require('../../../../lib/modules'),
      acl = require('../../../../lib/acl'),
      { promised } = require('../../../../lib/utils'),
      should = require('should')

describe('Expressions - Runtime routes', function() {

  let token = null

  before(async() => {
    const routesScript = loadScript('CTXAPI-689_RouteObject.js')
    await promised(null, sandboxed(function() {
      /* global script, org */
      org.objects.scripts.insertOne({
        label: 'CTXAPI-689 Route Library',
        name: 'c_ctxapi_689_routes_lib',
        description: 'Library for routes',
        type: 'library',
        script: script.arguments.routesScript,
        configuration: {
          export: 'c_ctxapi_689_routes_lib'
        }
      }).execute()
    }, {
      principal: server.principals.admin,
      runtimeArguments: {
        routesScript
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

    org.objects.scripts.deleteOne({ name: 'c_ctxapi_689_routes_lib' }).execute()

  }))

  it('check expressions on  GET route - true (operators $gt $toNumber $literal)', (callback) => {
    server.sessions.admin
      .get(server.makeEndpoint('/routes/c_ctxapi689_get_route?id=1213'))
      .set({ Authorization: `Bearer ${token.token}` })
      .done((err, body, response) => {
        should.exist(response)
        should.not.exist(err)
        should.equal(response.body.object, 'result')
        should.equal(response.body.data, 'The get request was executed!')
        should.equal(response.status, 200)
        callback()
      })
  })

  it('check expressions on runtime GET route - false (operators $gt $toNumber $literal)', (callback) => {
    server.sessions.admin
      .get(server.makeEndpoint('/routes/c_ctxapi689_get_route?=45'))
      .set({ Authorization: `Bearer ${token.token}` })
      .done((err, body, response) => {
        should.exist(err)
        should.equal(err.message, 'Route not found.')
        should.equal(response.status, 404)
        callback()
      })
  })

  it('check expressions on runtime POST route - true (operators $and $toBool)', (callback) => {
    server.sessions.admin
      .post(server.makeEndpoint('/routes/c_689_post_route'))
      .set({ Authorization: `Bearer ${token.token}` })
      .send({ theNumber: 10 })
      .done((err, body, response) => {
        should.exist(response)
        should.not.exist(err)
        should.equal(response.body.object, 'result')
        should.equal(response.body.data, 'The post! The number is 10')
        should.equal(response.status, 200)
        callback()
      })
  })

})
