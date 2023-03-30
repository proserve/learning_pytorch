const sandboxed = require('../../lib/sandboxed'),
      loadScript = require('../../lib/script.loader'),
      server = require('../../lib/server'),
      should = require('should'),
      { promised } = require('../../../lib/utils')

describe('Features - Object Script Routes', function() {

  before(async() => {
    const routeScript = loadScript('CTXAPI-340_Route.js')
    await promised(null, sandboxed(function() {
      /* global org, script */
      org.objects.scripts.insertOne({
        label: 'CTXAPI-340 CustomRoute Library',
        name: 'c_ctxapi_340_custom_route_lib',
        type: 'library',
        script: script.arguments.routeScript,
        configuration: {
          export: 'c_ctxapi_340_custom_route_lib'
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
        deleted: org.objects.scripts.deleteOne({ name: 'c_ctxapi_340_custom_route_lib' }).execute()
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

  it('should create and run a runtime GET route', async() => {
    let getRoute, result
    const runtimeConfig = await promised(null, sandboxed(function() {
      return org.read('runtime')
    }))

    should.exist(runtimeConfig)
    getRoute = runtimeConfig.routes.find(r => r.name === 'c_340_get')
    should.exist(getRoute)

    should.equal(getRoute.weight, 1)
    should.equal(getRoute.type, 'route')
    should.equal(getRoute.active, true)
    should.equal(getRoute.metadata.methodName, 'getImpl')
    should.equal(getRoute.metadata.className, 'CustomRoute')
    should.equal(getRoute.metadata.scriptExport, 'c_ctxapi_340_custom_route_lib')

    should.equal(getRoute.configuration.method, 'get')
    should.equal(getRoute.configuration.path, 'c_340_ping/:id')

    result = await server.sessions.admin
      .get(server.makeEndpoint('/routes/c_340_ping/1600?number=42'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .then()

    should.exist(result)
    should.exist(result.body)
    should.not.exist(result.body.errCode)
    should.equal(result.body.object, 'result')
    should.equal(result.body.data, 'The get! Your ID is 1600, and your number is 42')
  })

  it('should create and run a runtime POST route', async() => {
    let postRoute, result
    const runtimeConfig = await promised(null, sandboxed(function() {
      return org.read('runtime')
    }))

    should.exist(runtimeConfig)
    postRoute = runtimeConfig.routes.find(r => r.name === 'c_340_post')
    should.exist(postRoute)

    should.equal(postRoute.weight, 1)
    should.equal(postRoute.type, 'route')
    should.equal(postRoute.active, true)
    should.equal(postRoute.metadata.methodName, 'postImpl')
    should.equal(postRoute.metadata.className, 'CustomRoute')
    should.equal(postRoute.metadata.scriptExport, 'c_ctxapi_340_custom_route_lib')

    should.equal(postRoute.configuration.method, 'post')
    should.equal(postRoute.configuration.path, 'c_340_ping')

    result = await server.sessions.admin
      .post(server.makeEndpoint('/routes/c_340_ping'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send({
        theNumber: 42
      })
      .then()

    should.exist(result)
    should.exist(result.body)
    should.not.exist(result.body.errCode)
    should.equal(result.body.object, 'result')
    should.equal(result.body.data, 'The post! The number is 42')

  })

  it('should not run a runtime route without the correct access', async() => {
    let postRoute, result
    const runtimeConfig = await promised(null, sandboxed(function() {
      return org.read('runtime')
    }))

    should.exist(runtimeConfig)
    postRoute = runtimeConfig.routes.find(r => r.name === 'c_340_post')
    should.exist(postRoute)

    should.equal(postRoute.weight, 1)
    should.equal(postRoute.type, 'route')
    should.equal(postRoute.active, true)
    should.equal(postRoute.metadata.methodName, 'postImpl')
    should.equal(postRoute.metadata.className, 'CustomRoute')
    should.equal(postRoute.metadata.scriptExport, 'c_ctxapi_340_custom_route_lib')

    should.equal(postRoute.configuration.method, 'post')
    should.equal(postRoute.configuration.path, 'c_340_ping')
    should.exist(postRoute.configuration.acl, 1)
    should.equal(postRoute.configuration.acl.length, 1)
    should.equal(postRoute.configuration.acl[0].target.toString(), '000000000000000000000004')
    should.equal(postRoute.configuration.acl[0].type, 3)
    should.equal(postRoute.configuration.acl[0].allow, 1)

    result = await server.sessions.patient
      .post(server.makeEndpoint('/routes/c_340_ping'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send({
        theNumber: 42
      })
      .then()

    should.exist(result)
    should.exist(result.body)
    should.equal(result.body.errCode, 'cortex.accessDenied.route')
    should.equal(result.body.object, 'fault')
    should.equal(result.body.status, 403)
    should.equal(result.body.message, 'Route access denied.')
    should.not.exist(result.body.data)

  })

  it('should run 2 layered PATCH routes', async() => {
    let patchRouteHigh, patchRouteLow, result
    const runtimeConfig = await promised(null, sandboxed(function() {
      return org.read('runtime')
    }))

    should.exist(runtimeConfig)
    patchRouteHigh = runtimeConfig.routes.find(r => r.name === 'c_340_patch_high')
    should.exist(patchRouteHigh)

    should.equal(patchRouteHigh.type, 'route')
    should.equal(patchRouteHigh.active, true)
    should.equal(patchRouteHigh.weight, 2)
    should.equal(patchRouteHigh.metadata.className, 'CustomRoute')
    should.equal(patchRouteHigh.metadata.methodName, 'thisPatchGoesFirst')
    should.equal(patchRouteHigh.metadata.scriptExport, 'c_ctxapi_340_custom_route_lib')

    should.equal(patchRouteHigh.configuration.method, 'patch')
    should.equal(patchRouteHigh.configuration.path, 'c_340_ping')

    patchRouteLow = runtimeConfig.routes.find(r => r.name === 'c_340_patch_low')
    should.exist(patchRouteLow)

    should.equal(patchRouteLow.type, 'route')
    should.equal(patchRouteLow.active, true)
    should.equal(patchRouteLow.weight, 1)
    should.equal(patchRouteLow.metadata.className, 'CustomRoute')
    should.equal(patchRouteLow.metadata.methodName, 'andThisPatchFollows')
    should.equal(patchRouteLow.metadata.scriptExport, 'c_ctxapi_340_custom_route_lib')

    should.equal(patchRouteLow.configuration.method, 'patch')
    should.equal(patchRouteLow.configuration.path, 'c_340_ping')

    result = await server.sessions.admin
      .patch(server.makeEndpoint('/routes/c_340_ping'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send({
        patchNumber: 1600
      })
      .then()

    should.exist(result)
    should.equal(result.statusCode, 200)
    should.exist(result.body)
    should.not.exist(result.body.errCode)
    should.equal(result.body.object, 'result')
    should.equal(result.body.data, 'The world famous patch! New number is 1612, old number is 1600. The bird is the word')

  })

  it('should run a PUT route', async() => {
    let putRoute, result, data
    const runtimeConfig = await promised(null, sandboxed(function() {
      return org.read('runtime')
    }))

    should.exist(runtimeConfig)
    putRoute = runtimeConfig.routes.find(r => r.name === 'c_340_put')
    should.exist(putRoute)

    should.equal(putRoute.type, 'route')
    should.equal(putRoute.active, true)
    should.equal(putRoute.weight, 1)
    should.equal(putRoute.metadata.className, 'CustomRoute')
    should.equal(putRoute.metadata.methodName, 'thePutImplementation')
    should.equal(putRoute.metadata.scriptExport, 'c_ctxapi_340_custom_route_lib')

    should.equal(putRoute.configuration.method, 'put')
    should.equal(putRoute.configuration.path, 'c_340_ping')

    result = await server.sessions.admin
      .put(server.makeEndpoint('/routes/c_340_ping'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send({
        date: new Date(),
        string: 'yo!',
        array: [1, 2, 3, 4, 5],
        object: {}
      })
      .then()

    should.exist(result)
    should.equal(result.statusCode, 200)
    should.exist(result.body)
    should.not.exist(result.body.errCode)
    should.equal(result.body.object, 'list')

    data = result.body.data
    should.equal(data.length, 13)

    should.equal(data[0], null)
    should.equal(data[1], null)
    should.equal(data[2], 2)
    should.equal(data[3], 168)
    should.equal(data[4], 'string')
    should.equal(data[5], 'object')
    should.equal(data[6], true)
    should.equal(data[7], 5)
    should.equal(data[8], 5)
    should.equal(data[9], 3)
    should.equal(data[10], null)
    should.equal(data[11], true)
    should.equal(data[12], true)
  })

  it('should run a layered DELETE route and stream the response as ndjson', async() => {
    let deleteRouteSecond, deleteRouteFirst, result, ndjsonArray
    const runtimeConfig = await promised(null, sandboxed(function() {
      return org.read('runtime')
    }))

    should.exist(runtimeConfig)
    deleteRouteSecond = runtimeConfig.routes.find(r => r.name === 'c_340_delete')
    should.exist(deleteRouteSecond)

    should.equal(deleteRouteSecond.weight, 1)
    should.equal(deleteRouteSecond.type, 'route')
    should.equal(deleteRouteSecond.active, true)
    should.equal(deleteRouteSecond.metadata.className, 'CustomRoute')
    should.equal(deleteRouteSecond.metadata.methodName, 'secondLayerDelete')
    should.equal(deleteRouteSecond.metadata.scriptExport, 'c_ctxapi_340_custom_route_lib')

    should.equal(deleteRouteSecond.configuration.method, 'delete')
    should.equal(deleteRouteSecond.configuration.path, 'c_340_ping')

    deleteRouteFirst = runtimeConfig.routes.find(r => r.name === 'c_340_delete_all')
    should.exist(deleteRouteFirst)

    should.equal(deleteRouteFirst.weight, 999)
    should.equal(deleteRouteFirst.type, 'route')
    should.equal(deleteRouteFirst.active, true)
    should.equal(deleteRouteFirst.metadata.methodName, 'firstLayerDelete')
    should.equal(deleteRouteFirst.metadata.scriptExport, 'c_ctxapi_340_custom_route_lib')
    should.equal(deleteRouteFirst.metadata.className, 'CustomRoute')

    should.equal(deleteRouteFirst.configuration.path, '*')
    should.equal(deleteRouteFirst.configuration.method, 'delete')

    result = await server.sessions.admin
      .delete(server.makeEndpoint('/routes/c_340_ping'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .then()

    should.exist(result)
    should.exist(result.text)
    should.equal(result.type, 'application/x-ndjson')

    ndjsonArray = result.text.trim().split('\n')

    should.exist(ndjsonArray)
    should.equal(ndjsonArray.length, 2)

    // It's easier to assert the results if the json objects are parsed:
    ndjsonArray = ndjsonArray.map(json => JSON.parse(json))

    ndjsonArray.forEach(json => {
      should.equal(json.key, server.sessionsClient.key)
      should.equal(json.principal, server.principals.admin.email)
    })

    should.equal(ndjsonArray[0].route, 'delete /routes/*')
    should.equal(ndjsonArray[0].firstResource, 'script#type(library).name(c_ctxapi_340_custom_route_lib).@route 86:2')

    should.equal(ndjsonArray[1].route, 'delete /routes/c_340_ping')
    should.equal(ndjsonArray[1].secondResource, 'script#type(library).name(c_ctxapi_340_custom_route_lib).@route 104:2')
  })

})
