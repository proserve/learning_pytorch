const should = require('should'),
      supertest = require('supertest'),
      loadScript = require('../../lib/script.loader'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Features - CTXAPI-572 Username Accounts', function() {

  let oldSettings

  before((callback) => {
    oldSettings = server.org.configuration.accounts
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.accounts.enableUsername': true
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  after((callback) => {
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.accounts.enableUsername': oldSettings.enableUsername
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  before(async() => {

    /* global org, script */
    let code = function() {
          return org.objects.account.register({
            name: {
              first: 'Franco',
              last: 'Username'
            },
            email: 'franco+email@medable.com',
            username: 'francoUsername',
            mobile: '15055555555'
          }, {
            skipVerification: true,
            skipActivation: true,
            skipNotification: true
          })
        },
        codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
        script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

    await server.sessions.admin
      .post(server.makeEndpoint('/sys/script_runner'))
      .set(server.getSessionHeaders())
      .send(script)
      .then()

  })

  before(async() => {
    const triggerScript = loadScript('CTXAPI-572_Route.js')
    await promised(null, sandboxed(function() {
      /* global org, script */

      org.objects.scripts.insertOne({
        label: 'CTXAPI-572 RouteObject Library',
        name: 'c_ctxapi_572_routeobject_lib',
        description: 'Library to route',
        type: 'library',
        script: script.arguments.triggerScript,
        configuration: {
          export: 'c_ctxapi_572_routeobject_lib'
        }
      }).execute()
    }, {
      runtimeArguments: {
        triggerScript
      }
    }))
  })

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_572_routeobject_lib' }).execute()
    org.objects.accounts.deleteOne({ email: 'franco+email@medable.com' }).skipAcl().grant(8).execute()
  }))

  after(function() {
    // Call the reaper
    modules.workers.runNow('instance-reaper')
  })

  it('username should be valid principal parameter', async() => {
    let newUserAgent = supertest.agent(server.api.expressApp),
        result = await newUserAgent
          .get(server.makeEndpoint('/routes/c_572_ping'))
          .set(server.getSessionHeaders()).then()

    should.equal(result.statusCode, 200)
    should.equal(result.body.object, 'account')
    should.equal(result.body.email, 'franco+email@medable.com')
    should.equal(result.body.username, 'francoUsername')

  })

  it('username should be valid parameter for script.as', async() => {

    let result = await promised(null, sandboxed(function() {
      /* global script */
      return script.as({ username: 'francoUsername' }, () => {
        return script.principal
      })

    }))

    should.exist(result)
    should.equal(result.object, 'account')
    should.equal(result.email, 'franco+email@medable.com')
    should.equal(result.username, 'francoUsername')

  })
})
