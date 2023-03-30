'use strict'

const sandboxed = require('../../lib/sandboxed'),
      loadScript = require('../../lib/script.loader'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Issues - CTXAPI-514 - script timeouts often show as script.error.ops', function() {
  let routeTimeout
  const routeScript = loadScript('CTXAPI-514_Route.js')

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global script, org */
      org.objects.scripts.insertOne({
        label: 'CTXAPI-514 RouteObject Library',
        name: 'c_ctxapi_514_routeobject_lib',
        description: 'Library to route',
        type: 'library',
        script: script.arguments.routeScript,
        configuration: {
          export: 'c_ctxapi_514_routeobject_lib'
        }
      }).execute()

    }, {
      runtimeArguments: {
        routeScript
      }
    }
    ))
  }
  )

  before(callback => {
    routeTimeout = server.org.configuration.scripting.types.route.timeoutMs

    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.scripting.types.route.timeoutMs': 10
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  after(callback => {
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.scripting.types.route.timeoutMs': routeTimeout }
    }, () => {
      server.updateOrg(callback)
    })

  })

  after(async() => {
    await promised(null, sandboxed(function() {
      org.objects.scripts.deleteOne({ name: 'c_ctxapi_514_routeobject_lib' }).execute()
    }))
  })

  it('error should be related to timeout when route dont have enough time to process request', async function() {
    let result

    result = await server.sessions.admin
      .get(server.makeEndpoint('/routes/c_514_objects'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .then()

    should.exist(result)
    should.equal(result.body.object, 'fault')
    should.equal(result.body.code, 'kTimeout')
    should.equal(result.body.errCode, 'script.timeout.execution')
    should.equal(result.body.status, 408)
    should.equal(result.body.reason, 'script execution timeout.')
    should.equal(result.body.message, 'Script execution timed out.')
  })

  it('error should be related to timeout when script dont have enough time to process request', async function() {
    let result
    try {
      await promised(null, sandboxed(function() {
        /* global org */
        const _ = require('lodash')
        let array = _.range(5600)
        array.forEach(element => org.objects.objects.find().toArray())
        return org.read('runtime')
      }))
    } catch (e) { result = e }
    should.exist(result)
    should.equal(result.name, 'fault')
    should.equal(result.code, 'kTimeout')
    should.equal(result.errCode, 'script.timeout.execution')
    should.equal(result.statusCode, 408)
    should.equal(result.reason, 'script execution timeout.')
    should.equal(result.message, 'Script execution timed out.')
  })

})
