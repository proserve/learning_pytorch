const sandboxed = require('../../lib/sandboxed'),
      loadScript = require('../../lib/script.loader'),
      modules = require('../../../lib/modules/index'),
      supertest = require('supertest'),
      server = require('../../lib/server'),
      should = require('should'),
      { promised } = require('../../../lib/utils')

/* TODO seems the org is in maintenance mode:
  AssertionError: expected 'cortex.accessDenied.maintenance' to not exist
      at Context.<anonymous> (test/tests/issues/CTXAPI-932.js:56:16)
* */
describe('CTXAPI-932 Issue - Return proper auth message with @routes', function() {

  before(async() => {
    const routeScript = loadScript('CTXAPI-932_Route.js')
    await promised(null, sandboxed(function() {
      /* global org, script */
      org.objects.scripts.insertOne({
        label: 'CTXAPI-932 CustomRoute Library',
        name: 'c_ctxapi_932_custom_route_lib',
        type: 'library',
        script: script.arguments.routeScript,
        configuration: {
          export: 'c_ctxapi_932_custom_route_lib'
        }
      }).execute()

    }, {
      runtimeArguments: {
        routeScript
      }
    }))
  })

  after(function(callback) {
    sandboxed(function() {
      script.exit({
        deleted: org.objects.scripts.deleteOne({ name: 'c_ctxapi_932_custom_route_lib' }).execute()
      })
    })(function(err, result) {
      if (err) {
        return callback(err)
      }
      should.exist(result)
      should.equal(result.deleted, true)

      server.updateOrg(callback)
    })
  })

  it('should access to an anonymous route if they have an anonymous acl defined', async() => {
    const result = await supertest(server.api.expressApp)
      .get(server.makeEndpoint('/routes/c_ctxapi_932_anonymous'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send()

    should.exist(result)
    should.exist(result.body)
    should.not.exist(result.body.errCode)
    should.equal(result.body.object, 'result')
    should.equal(result.body.data, 'Cool! you can access this anonymously')
  })

  it('should access to an anonymous route and principal would be the logged user', async() => {
    const result = await server.sessions.patient
      .get(server.makeEndpoint('/routes/c_ctxapi_932_anonymous'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send()

    should.exist(result)
    should.exist(result.body)
    should.not.exist(result.body.errCode)
    should.equal(result.body.object, 'result')
    should.equal(result.body.data, 'Cool! you can access this james+patient@medable.com')
  })

  it('should not access to an authenticated route if they call anonymously', async() => {
    const result = await supertest(server.api.expressApp)
      .get(server.makeEndpoint('/routes/c_ctxapi_932_with_specific_acl'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send()

    should.exist(result)
    should.exist(result.body)
    should.equal(result.body.errCode, 'cortex.accessDenied.notLoggedIn')
    should.equal(result.body.status, 403)
  })

  it('should access to an authenticated route', async() => {
    const result = await server.sessions.patient
      .get(server.makeEndpoint('/routes/c_ctxapi_932'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send()

    should.exist(result)
    should.exist(result.body)
    should.not.exist(result.body.errCode)
    should.equal(result.body.object, 'result')
    should.equal(result.body.data, `You are james+patient@medable.com!`)
  })

  it('should throw sessionTimeout', async() => {

    let result

    const agent = await supertest.agent(server.api.expressApp)

    // Log in and keep cookie in agent
    result = await agent.post(server.makeEndpoint('/accounts/login'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send({ email: server.principals.patient.email, password: server.password })

    if (result.body && result.body.errCode === 'cortex.success.newLocation') {
      const cb = await modules.db.models.Callback.findOne({ handler: 'ver-location', target: server.principals.patient.email }).lean().select({ token: 1 }).exec()
      await agent.post(server.makeEndpoint('/accounts/login'))
        .set({ 'Medable-Client-Key': server.sessionsClient.key })
        .send({ email: server.principals.patient.email, password: server.password, location: { verificationToken: cb.token } })
    }
    // expire session
    await modules.db.models.session.updateMany({ accountId: server.principals.patient._id }, { $set: { 'session.expires': new Date().getTime() - 5000 } })

    result = await agent.get(server.makeEndpoint('/routes/c_ctxapi_932'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send()
    should.exist(result)
    should.exist(result.body)
    should.equal(result.body.errCode, 'cortex.accessDenied.sessionExpired')
    should.equal(result.body.status, 403)

  })

  it('should throw a different error when access to authenticated routes using a different principal', async() => {
    const result = await server.sessions.provider
      .get(server.makeEndpoint('/routes/c_ctxapi_932_with_specific_acl'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send()

    should.exist(result)
    should.exist(result.body)
    should.equal(result.body.errCode, 'cortex.accessDenied.route')
    should.equal(result.body.status, 403)
    should.equal(result.body.message, 'Route access denied.')
  })

  it('should access as anonymous with a route with multiple acl and anonymous on it', async() => {
    const result = await supertest(server.api.expressApp)
      .get(server.makeEndpoint('/routes/c_ctxapi_932_more_acl'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send()

    should.exist(result)
    should.exist(result.body)
    should.not.exist(result.body.errCode)
    should.equal(result.body.object, 'result')
    should.equal(result.body.data, `This can be accessed by org or anonymous`)
  })

  it('should throw sessionTimeout even if has anonymous as acl', async() => {

    let result

    const agent = await supertest.agent(server.api.expressApp)

    // Log in and keep cookie in agent
    result = await agent.post(server.makeEndpoint('/accounts/login'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send({ email: server.principals.patient.email, password: server.password })

    if (result.body && result.body.errCode === 'cortex.success.newLocation') {
      const cb = await modules.db.models.Callback.findOne({ handler: 'ver-location', target: server.principals.patient.email }).lean().select({ token: 1 }).exec()
      await agent.post(server.makeEndpoint('/accounts/login'))
        .set({ 'Medable-Client-Key': server.sessionsClient.key })
        .send({ email: server.principals.patient.email, password: server.password, location: { verificationToken: cb.token } })
    }
    // expire session
    await modules.db.models.session.updateMany({ accountId: server.principals.patient._id }, { $set: { 'session.expires': new Date().getTime() - 5000 } })

    result = await agent.get(server.makeEndpoint('/routes/c_ctxapi_932_more_acl'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send()
    should.exist(result)
    should.exist(result.body)
    should.equal(result.body.errCode, 'cortex.accessDenied.sessionExpired')
    should.equal(result.body.status, 403)

  })

})
