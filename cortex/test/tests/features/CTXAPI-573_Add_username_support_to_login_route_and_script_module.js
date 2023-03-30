const should = require('should'),
      supertest = require('supertest'),
      server = require('../../lib/server'),
      loadScript = require('../../lib/script.loader'),
      modules = require('../../../lib/modules'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Features - CTXAPI-573 Add username support to login route and script module', function() {
  before(async() => {

    /* global org, script */
    const newUserAgent = supertest.agent(server.api.expressApp)
    await newUserAgent.post(server.makeEndpoint('/accounts/register'))
      .set(server.getSessionHeaders())
      .send({
        name: {
          first: 'Franco',
          last: 'Username'
        },
        email: 'franco+email@medable.com',
        username: 'francoUsername',
        mobile: '15055555555',
        password: 'myPa$$word123'
      }, {
        skipVerification: true,
        skipActivation: true,
        skipNotification: true
      })
  })

  before(async() => {
    const triggerScript = loadScript('CTXAPI-573_RouteObject.js')
    await promised(null, sandboxed(function() {
      /* global org, script */

      org.objects.scripts.insertOne({
        label: 'CTXAPI-573 RouteObject Library',
        name: 'c_ctxapi_573_routeobject_lib',
        description: 'Library to route',
        type: 'library',
        script: script.arguments.triggerScript,
        configuration: {
          export: 'c_ctxapi_573_routeobject_lib'
        }
      }).execute()
    }, {
      runtimeArguments: {
        triggerScript
      }
    }))
  })

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_573_routeobject_lib' }).execute()
    org.objects.accounts.deleteOne({ email: 'franco+email@medable.com' }).skipAcl().grant(8).execute()
  }))

  after(function() {
    // Call the reaper
    modules.workers.runNow('instance-reaper')
  })

  describe('enableUsername set true', function() {
    let oldSettings

    beforeEach((callback) => {
      oldSettings = server.org.configuration
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
        $set: {
          'configuration.accounts.enableUsername': true,
          'configuration.accounts.enableEmail': false,
          'configuration.email.locationBypass': ['*']
        }
      }, () => {
        server.updateOrg(callback)
      })
    })

    afterEach((callback) => {
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
        $set: {
          'configuration.accounts.enableUsername': oldSettings.accounts.enableUsername,
          'configuration.accounts.enableEmail': oldSettings.accounts.enableEmail,
          'configuration.email.locationBypass': oldSettings.email.locationBypass
        }
      }, () => {
        server.updateOrg(callback)
      })
    })

    it('login route should be supporting username as login parameter', async() => {
      let newUserAgent = supertest.agent(server.api.expressApp),
          result = await newUserAgent
            .post(server.makeEndpoint('/accounts/login'))
            .set(server.getSessionHeaders())
            .send({
              username: 'francoUsername',
              password: 'myPa$$word123'
            })
      should.equal(result.body.username, 'francoUsername')
      should.exist(result.header['set-cookie'])
      should.equal(result.statusCode, 200)
      should.equal(result.body.object, 'account')
      should.equal(result.body.email, 'franco+email@medable.com')

    })

    it('login route should return invalidCredentials if password is invalid', async() => {
      let newUserAgent = supertest.agent(server.api.expressApp),
          result = await newUserAgent
            .post(server.makeEndpoint('/accounts/login'))
            .set(server.getSessionHeaders())
            .send({
              username: 'francoUsername',
              password: 'invalidPassword'
            })
      should.equal(result.body.code, 'kInvalidCredentials')
      should.equal(result.body.errCode, 'cortex.accessDenied.invalidCredentials')
      should.equal(result.body.message, 'Invalid email/password combination.')
      should.equal(result.statusCode, 403)
      should.equal(result.body.object, 'fault')

    })

    it('login route should return invalidCredentials if username is invalid', async() => {
      let newUserAgent = supertest.agent(server.api.expressApp),
          result = await newUserAgent
            .post(server.makeEndpoint('/accounts/login'))
            .set(server.getSessionHeaders())
            .send({
              username: 'invalidUsername',
              password: 'myPa$$word123'
            })
      should.equal(result.body.code, 'kInvalidCredentials')
      should.equal(result.body.errCode, 'cortex.accessDenied.invalidCredentials')
      should.equal(result.body.message, 'Invalid email/password combination.')
      should.equal(result.statusCode, 403)
      should.equal(result.body.object, 'fault')

    })

    it('login route should return invalidCredentials if email is used as username', async() => {
      let newUserAgent = supertest.agent(server.api.expressApp),
          result = await newUserAgent
            .post(server.makeEndpoint('/accounts/login'))
            .set(server.getSessionHeaders())
            .send({
              username: 'franco+email@medable.com',
              password: 'myPa$$word123'
            })
      should.equal(result.body.code, 'kInvalidCredentials')
      should.equal(result.body.errCode, 'cortex.accessDenied.invalidCredentials')
      should.equal(result.body.message, 'Invalid email/password combination.')
      should.equal(result.statusCode, 403)
      should.equal(result.body.object, 'fault')

    })

    it('username should be valid parameter for login script module', async() => {

      let result, newUserAgent
      /* global org, script */

      newUserAgent = supertest.agent(server.api.expressApp)
      result = await newUserAgent
        .post(server.makeEndpoint('/routes/c_573_login'))
        .set(server.getSessionHeaders())
        .send({
          username: 'francoUsername',
          password: 'myPa$$word123'
        })
        .then()

      should.equal(result.body.object, 'account')
      should.equal(result.body.email, 'franco+email@medable.com')
      should.equal(result.body.username, 'francoUsername')

    })
  })

  describe('enableUsername set false', function() {
    let oldSettings

    before((callback) => {
      oldSettings = server.org.configuration
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
        $set: {
          'configuration.accounts.enableUsername': false,
          'configuration.email.locationBypass': ['*']
        }
      }, () => {
        server.updateOrg(callback)
      })
    })

    after((callback) => {
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
        $set: {
          'configuration.accounts.enableUsername': oldSettings.accounts.enableUsername,
          'configuration.email.locationBypass': oldSettings.email.locationBypass
        }
      }, () => {
        server.updateOrg(callback)
      })
    })

    it('login script module fails with valid credentials but enableUsername set false', async() => {

      let result, newUserAgent
      /* global org, script */

      newUserAgent = supertest.agent(server.api.expressApp)
      result = await newUserAgent
        .post(server.makeEndpoint('/routes/c_573_login'))
        .set(server.getSessionHeaders())
        .send({
          username: 'francoUsername',
          password: 'myPa$$word123'
        })
        .then()

      should.equal(result.body.code, 'kInvalidCredentials')
      should.equal(result.body.errCode, 'cortex.accessDenied.invalidCredentials')
      should.equal(result.body.message, 'Script error')
      should.equal(result.statusCode, 403)
      should.equal(result.body.object, 'fault')

    })

    it('login route should fail for username if enableUsername is set false', async() => {

      let newUserAgent = supertest.agent(server.api.expressApp),
          result = await newUserAgent
            .post(server.makeEndpoint('/accounts/login'))
            .set(server.getSessionHeaders())
            .send({
              username: 'francoUsername',
              password: 'myPa$$word123'
            })
      should.equal(result.body.code, 'kInvalidCredentials')
      should.equal(result.body.errCode, 'cortex.accessDenied.invalidCredentials')
      should.equal(result.body.message, 'Invalid email/password combination.')
      should.equal(result.statusCode, 403)
      should.equal(result.body.object, 'fault')

    })

  })

})
