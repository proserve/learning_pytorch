const sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      server = require('../../../lib/server'),
      loadScript = require('../../../lib/script.loader'),
      { promised } = require('../../../../lib/utils')

describe('Expressions - Conditional runtime transforms', function() {

  before(async function() {
    const lib = loadScript('CTXAPI-661_conditional_runtime_transforms.js')

    await promised(null, sandboxed(function() {
      /* global org, script */
      org.objects.scripts.insertOne({
        label: 'c_ctxapi_661_runtime_transform_lib',
        name: 'c_ctxapi_661_runtime_transform_lib',
        description: 'c_ctxapi_661_runtime_transform_lib',
        script: script.arguments.lib,
        type: 'library',
        configuration: {
          export: 'c_ctxapi_661_runtime_transform_lib'
        }
      }).execute()

      org.objects.objects.insertOne({
        label: 'c_ctxapi_661_transforms_object',
        name: 'c_ctxapi_661_transforms_object',
        createAcl: 'account.public',
        defaultAcl: 'role.administrator.delete',
        properties: [{
          name: 'c_string',
          label: 'c_string',
          type: 'String',
          indexed: true
        }]
      }).execute()

      org.objects.c_ctxapi_661_transforms_object.insertMany([
        { c_string: 'number 1' },
        { c_string: 'number 2' },
        { c_string: 'number 3' },
        { c_string: 'number 4' }
      ]).execute()
    }, {
      runtimeArguments: { lib }
    }))

  })

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_661_runtime_transform_lib' }).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_661_transforms_object' }).execute()
    require('system').syncEnvironment()
  }))

  it('should not run a conditional runtime transform from script if expression does not match', async function() {
    let result

    result = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_661_transforms_object.find()
        .transform('c_ctxapi_661_rt_transform')
        .toArray()
    }))

    should.exist(result)
    should.equal(result.length, 4)
    result.should.containDeep([
      { c_string: 'number 1' },
      { c_string: 'number 2' },
      { c_string: 'number 3' },
      { c_string: 'number 4' }
    ])
  })

  it('should not run a conditional runtime transform from route if expression does not match', async function() {
    let result

    result = await server.sessions.admin
      .get(server.makeEndpoint('/routes/get-accounts-as-rtcaller'))
      .set(server.getSessionHeaders())
      .then()

    should.exist(result)
    should.exist(result.body)
    should.exist(result.body.data)
    should.equal(result.body.data.length, 4)
    result.body.data.should.containDeep([
      { c_string: 'number 1' },
      { c_string: 'number 2' },
      { c_string: 'number 3' },
      { c_string: 'number 4' }
    ])

  })

  it('should run a conditional runtime transform if expression matches', async function() {
    let result

    result = await server.sessions.admin
      .get(server.makeEndpoint('/routes/get-accounts-as-provider'))
      .set(server.getSessionHeaders())
      .then()

    should.exist(result)
    should.exist(result.body)
    should.exist(result.body.data)
    should.equal(result.body.data.length, 6)
    result.body.data.should.containDeepOrdered([
      { c_string: '*****' },
      { c_string: '*****' },
      { c_string: '*****' },
      { c_string: '*****' },
      { completed: true },
      'Transform completed!'
    ])
  })

})
