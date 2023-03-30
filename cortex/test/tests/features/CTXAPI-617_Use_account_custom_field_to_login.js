'use strict'

const should = require('should'),
      supertest = require('supertest'),
      loadScript = require('../../lib/script.loader'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Features - CTXAPI-617 Use account custom field to login', function() {
  let oldSettings

  const triggerScript = loadScript('CTXAPI-617_RouteObject.js')
  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org, consts, script, Fault */
      const {
        objects: Objects
      } = org.objects

      if (Objects.find({ name: 'account' }).count() === 0) {

        org.objects.objects.insertOne({
          name: 'account',
          label: 'account',
          properties: [{
            name: 'c_pin_example',
            label: 'PIN',
            type: 'String',
            unique: true,
            indexed: true,
            removable: true
          }]
        }).execute()
      } else if (Objects.find({ name: 'account' }).count() === 1) {
        Objects.updateOne({ name: 'account' }, {
          $push: {
            properties: [{
              name: 'c_pin_example',
              label: 'PIN',
              type: 'String',
              unique: true,
              indexed: true,
              removable: true
            }]
          }
        }).execute()
      } else {
        throw Fault.create('cortex.error.unspecified', { reason: 'Something terrible must have happened' })
      }

      org.objects.scripts.insertOne({
        label: 'CTXAPI-617 TriggerObject Library',
        name: 'c_ctxapi_617_triggerobject_lib',
        description: 'Library to trigger',
        type: 'library',
        script: script.arguments.triggerScript,
        configuration: {
          export: 'c_ctxapi_617_triggerobject_lib'
        }
      }).execute()
    }, {
      runtimeArguments: {
        triggerScript
      }
    }
    ))
    let code = function() {
          org.objects.accounts.register({
            name: {
              first: 'Test',
              last: 'Ctxapi617'
            },
            email: 'test@user.com',
            mobile: '+15055555555',
            password: 'qpal1010',
            c_pin_example: '819815684',
            roles: [consts.roles.Developer]
          }, {
            skipNotification: true,
            skipVerification: true,
            verifyLocation: false
          })
        },
        codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
        scriptLoad = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

    await server.sessions.admin
      .post(server.makeEndpoint('/sys/script_runner'))
      .set(server.getSessionHeaders())
      .send(scriptLoad)
      .then()

  })

  before((callback) => {
    oldSettings = server.org.configuration
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.email.locationBypass': ['*']
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  after((callback) => {
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.email.locationBypass': oldSettings.email.locationBypass
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  after(sandboxed(function() {
    const { Objects } = org.objects
    let accProps = Objects.find({ name: 'account' }).next().properties

    Objects.updateOne({ name: 'account' }, {
      $remove: {
        properties: accProps.filter(p => p.name === 'c_pin_example').map(p => p._id)
      }
    }).lean(false).execute()
    org.objects.accounts.deleteOne({ email: 'test@user.com' }).skipAcl().grant(8).execute()
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_617_triggerobject_lib' }).execute()
  }))

  it('user should be able to login using a new custom field', async() => {
    let newUserAgent = supertest.agent(server.api.expressApp),
        result = await newUserAgent
          .post(server.makeEndpoint('/routes/c_617_pin_login'))
          .set(server.getSessionHeaders())
          .send({
            pin: '819815684'
          })

    should.exist(result)
    should.equal(result.body.object, 'account')
    should.equal(result.body.email, 'test@user.com')
    should.equal(result.body.name.first, 'Test')
    should.equal(result.body.name.last, 'Ctxapi617')

  })

})
