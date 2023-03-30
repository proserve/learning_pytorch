'use strict'

const should = require('should'),
      supertest = require('supertest'),
      { promised } = require('../../../../lib/utils'),
      server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed')
const modules = require('../../../../lib/modules')

describe('Issues - CTXAPI-1263 - password less login', function() {

  let oldSettings
  before(async() => {
    oldSettings = server.org.configuration
    await promised(modules.db, 'sequencedUpdate', server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.accounts.enableUsername': true,
        'configuration.accounts.enableEmail': true,
        'configuration.email.locationBypass': ['*']
      }
    })
    await promised(server, 'updateOrg')
    await promised(null, sandboxed(function() {
      /* global org, script */

      org.objects.scripts.insertOne({
        label: 'CTXAPI-1263 RouteObject Library',
        name: 'c_ctxapi1263_routeobject_lib',
        description: 'Library to route login',
        type: 'library',
        script: `
          const { route } = require('decorators')

              class RouteCTXAPI1263 {
              
                @route('POST /login_passwordless', {
                  name: 'c_login_passwordless',
                  weight: 1,
                  acl: [ 'account.anonymous' ]
                })
                passwordLessLogin({ body }) {
                  return org.objects.accounts.login({
                    email: body('email')
                  }, {
                    passwordLess: true
                  })
                }
              
              }
              module.exports = RouteCTXAPI1263
        `,
        configuration: {
          export: 'c_ctxapi1263_routeobject_lib'
        }
      }).execute()
    }))
    const newUserAgent = supertest.agent(server.api.expressApp)
    await newUserAgent.post(server.makeEndpoint('/accounts/register'))
      .set(server.getSessionHeaders())
      .send({
        name: {
          first: 'Gaston',
          last: 'Robledo'
        },
        email: 'gaston+email@medable.com',
        username: 'gaston',
        mobile: '15055555555',
        password: 'myPa$$word123'
      }, {
        skipVerification: true,
        skipActivation: true,
        skipNotification: true
      })

  })

  after(async() => {
    await promised(null, sandboxed(function() {
      org.objects.scripts.deleteOne({ name: 'c_ctxapi1263_routeobject_lib' }).execute()
      org.objects.accounts.deleteOne({ email: 'gaston+email@medable.com' }).skipAcl().grant(8).execute()

    }))
    await promised(modules.db, 'sequencedUpdate', server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.accounts.enableUsername': oldSettings.accounts.enableUsername,
        'configuration.accounts.enableEmail': oldSettings.accounts.enableEmail,
        'configuration.email.locationBypass': oldSettings.email.locationBypass
      }
    })
    await promised(server, 'updateOrg')
  })

  it('login should allow password less access', async function() {
    let newUserAgent = supertest.agent(server.api.expressApp),
        result = await newUserAgent
          .post(server.makeEndpoint('/routes/login_passwordless'))
          .set(server.getSessionHeaders())
          .send({
            email: 'gaston+email@medable.com'
          })
    should.exist(result.header['set-cookie'])
    should.equal(result.statusCode, 200)
    should.equal(result.body.object, 'account')
    should.equal(result.body.email, 'gaston+email@medable.com')
  })

})
