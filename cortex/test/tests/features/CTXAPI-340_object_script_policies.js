const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      loadScript = require('../../lib/script.loader'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl'),
      { promised } = require('../../../lib/utils')

describe('Features -Object Script Policies', function() {

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

  before(async() => {
    const policiesScript = loadScript('CTXAPI-340_Policies.js')
    await promised(null, sandboxed(function() {
      /* global script, org */
      org.objects.scripts.insertOne({
        label: 'CTXAPI-340 Policies Library',
        name: 'c_ctxapi_340_policies_lib',
        description: 'Library for policies',
        type: 'library',
        script: script.arguments.policiesScript,
        configuration: {
          export: 'c_ctxapi_340_policies_lib'
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
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_340_policies_lib' }).execute()
  }))

  it('check redirect policy', (callback) => {
    server.sessions.admin
      .get(server.makeEndpoint('/routes/test-policy-redirect'))
      .set({ Authorization: `Bearer ${token.token}` })
      .done((err, body, response) => {
        should.not.exist(err)
        should.exist(response)
        should.equal(response.status, 307)
        callback()
      })

  })

  it('check end by return data in policy', async() => {
    try {
      const { body } = await new Promise((resolve, reject) => {
        server.sessions.admin
          .post(server.makeEndpoint('/routes/test-route'))
          .set({ Authorization: `Bearer ${token.token}` })
          .send({ end: true })
          .done((err, body, response) => {
            if (err) {
              return reject(err)
            }
            return resolve({ body, response })
          })
      })

      should.exist(body)
      body.data.should.equal('ended!')
    } catch (e) {
      throw e
    }
  })

  it('check end by throw error in policy', async() => {
    try {
      await new Promise((resolve, reject) => {
        server.sessions.admin
          .post(server.makeEndpoint('/routes/test-route'))
          .set({ Authorization: `Bearer ${token.token}` })
          .send({ halt_throw: true })
          .done((err, body, response) => {
            if (err) {
              return reject(err)
            }
            return resolve({ body, response })
          })
      })
    } catch (e) {
      should.exist(e)
      e.code.should.equal('kAccessDenied')
      e.reason.should.equal('Because!')
      e.statusCode.should.equal(403)
    }
  })

  it('check policy that modifies body', async() => {
    try {
      const { body } = await new Promise((resolve, reject) => {
        server.sessions.admin
          .post(server.makeEndpoint('/routes/test-route'))
          .set({ Authorization: `Bearer ${token.token}` })
          .send({ end: false })
          .done((err, body, response) => {
            if (err) {
              return reject(err)
            }
            return resolve({ body, response })
          })
      })

      should.exist(body)
      body.data.param.should.equal('this is a param from policy')
    } catch (e) {
      throw e
    }
  })

  it('check end by response.end in policy', async() => {
    try {
      const { response } = await new Promise((resolve, reject) => {
        server.sessions.admin
          .post(server.makeEndpoint('/routes/test-route'))
          .send({ 'end_response': true })
          .set({ Authorization: `Bearer ${token.token}` })
          .done((err, body, response) => {
            if (err) {
              return reject(err)
            }
            return resolve({ body, response })
          })
      })

      should.exist(response)
      response.status.should.equal(200)
    } catch (e) {
      throw e
    }
  })

  it('check halt in policy', async() => {
    try {
      const { response, body } = await new Promise((resolve, reject) => {
        server.sessions.admin
          .get(server.makeEndpoint('/routes/test-route-halt'))
          .set({ Authorization: `Bearer ${token.token}` })
          .done((err, body, response) => {
            if (err) {
              return reject(err)
            }
            return resolve({ body, response })
          })
      })

      should.exist(response)
      response.status.should.equal(200)
      body.data.should.equal('Hello!')
    } catch (e) {
      throw e
    }
  })

  it('should apply a Transform policy', async() => {
    let accounts
    const { admin, provider, patient, unverified } = server.principals

    accounts = await server.sessions.admin
      .get(server.makeEndpoint('/routes/get-all-accounts'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .then()

    should.exist(accounts)
    should.exist(accounts.body)
    should.equal(accounts.body.object, 'list')
    should.exist(accounts.body.data)
    should.equal(accounts.body.data.length, 5)

    should.equal(accounts.body.data[0].email, admin.email)
    should.equal(accounts.body.data[0].name.first, admin.name.first)
    should.equal(accounts.body.data[0].name.last, admin.name.last)

    should.equal(accounts.body.data[1].email, provider.email)
    should.equal(accounts.body.data[1].name.first, '*******')
    should.equal(accounts.body.data[1].name.last, '*******')

    should.equal(accounts.body.data[2].email, patient.email)
    should.equal(accounts.body.data[2].name.first, '*******')
    should.equal(accounts.body.data[2].name.last, '*******')

    should.equal(accounts.body.data[3].email, unverified.email)
    should.equal(accounts.body.data[3].name.first, '*******')
    should.equal(accounts.body.data[3].name.last, '*******')

    should.equal(accounts.body.data[4], 'Transform completed!')
  })
})
