const should = require('should'),
      supertest = require('supertest'),
      server = require('../../lib/server'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Features - CTXAPI-619 add ability to pass script.as a string function', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org, script */

      org.objects.scripts.insertOne({
        label: 'CTXAPI-619 RouteObject Library',
        name: 'c_ctxapi_619_routeobject_lib',
        description: 'Library to route',
        type: 'library',
        script: `const { route } = require('decorators')
                  class CustomCtxapi619Route {

                  @route({
                    method: 'GET',
                    name: 'c_ctxapi_619',
                    acl: [ 'account.anonymous' ],
                    path: 'c_619_ping',
                    weight: 1
                  })
                  postImplCtxapi619({ req, body }) {
                    return 'Runtime script successfully executed'
                  }
                
                }`,
        configuration: {
          export: 'c_ctxapi_619_routeobject_lib'
        }
      }).execute()
    }))
  })

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_619_routeobject_lib' }).execute()
  }))

  it('script can be passed as string for script.as', async() => {

    let result = await promised(null, sandboxed(function() {
      /* global script */
      return script.as(script.principal._id, `return 'Success script execution'`)

    }))

    should.equal(result, 'Success script execution')
  })

  it('script as string should be valid script parameter', async() => {
    let newUserAgent = supertest.agent(server.api.expressApp),
        result = await newUserAgent
          .get(server.makeEndpoint('/routes/c_619_ping'))
          .set(server.getSessionHeaders()).then()

    should.equal(result.statusCode, 200)
    should.equal(result.body.data, 'Runtime script successfully executed')

  })

})
