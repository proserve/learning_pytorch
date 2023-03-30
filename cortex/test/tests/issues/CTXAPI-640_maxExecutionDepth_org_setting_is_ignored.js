'use strict'

const sandboxed = require('../../lib/sandboxed'),
      loadScript = require('../../lib/script.loader'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Issues - CTXAPI-640 - maxExecutionDepth org setting is ignored', function() {
  const triggerScript = loadScript('CTXAPI-640_TriggerObject.js')
  // Set maxExecutionDepth
  let maxExecutionDepth
  before(callback => {
    maxExecutionDepth = server.org.configuration.scripting.maxExecutionDepth

    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.scripting.maxExecutionDepth': 10
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global script, org */
      const name = 'c_ctxapi_640_object',
            {
              Objects,
              [name]: Model
            } = org.objects

      if (Objects.find({ name }).count() === 0) {
        Objects.insertOne({
          name,
          label: 'CTXAPI-640 Object',
          defaultAcl: 'role.administrator.delete',
          createAcl: 'account.public',
          properties: [{
            name: 'c_count',
            label: 'Count',
            type: 'Number',
            indexed: true
          },
          {
            name: 'c_depth_log',
            label: 'Depth Array',
            type: 'String',
            array: true
          }
          ]
        }).execute()
      }
      org.objects.scripts.insertOne({
        label: 'CTXAPI-640 TriggerObject Library',
        name: 'c_ctxapi_640_triggerobject_lib',
        description: 'Library to trigger',
        type: 'library',
        script: script.arguments.triggerScript,
        configuration: {
          export: 'c_ctxapi_640_triggerobject_lib'
        }
      }).execute()
      if (Model.find().count() > 1) {
        Model.deleteMany().execute()
      }
    }, {
      runtimeArguments: {
        triggerScript
      }
    }
    ))
  }
  )

  beforeEach(sandboxed(function() {
    /* global  org */
    const name = 'c_ctxapi_640_object',
          {
            [name]: Model
          } = org.objects

    if (Model.find().count() === 0) {
      Model.insertOne({ c_count: 0 }).execute()
    }

  }))

  after(callback => {
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.scripting.maxExecutionDepth': maxExecutionDepth }
    }, () => {
      server.updateOrg(callback)
    })
  })

  afterEach(sandboxed(function() {
    org.objects.c_ctxapi_640_objects.deleteMany().execute()
  }))

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_640_triggerobject_lib' }).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_640_object' }).execute()
  }))

  it('should be able to reach maxExecutionDepth configured', async function() {
    let finalResult,
        result = await promised(null, sandboxed(function() {
          const name = 'c_ctxapi_640_object',
                {
                  [name]: Model
                } = org.objects

          return Model.updateOne({}, {
            $set: {
              c_count: 10
            }
          }).lean(false).execute()

        }))
    should.equal(server.org.configuration.scripting.maxExecutionDepth, 10)
    should.equal(result.c_depth_log[7], 9)

    finalResult = await promised(null, sandboxed(function() {
      const cache = require('cache')
      let cacheResult = cache.get(`ctxapi_640.${script.arguments.result._id.toString()}.lastExecution`),
          maxExecutionDepthValue = org.read('configuration').scripting.maxExecutionDepth

      return { cacheResult, maxExecutionDepthValue }
    }, {
      runtimeArguments: {
        result
      }
    }
    ))

    should.equal(finalResult.cacheResult, 'count: 2 depth: 10')
    should.equal(finalResult.maxExecutionDepthValue, 10)
  })

  it('should not be able to do additional execution that value configured on maxExecutionDepth', async function() {
    let finalResult,
        result = await promised(null, sandboxed(function() {
          const name = 'c_ctxapi_640_object',
                {
                  [name]: Model
                } = org.objects

          return Model.updateOne({}, {
            $set: {
              c_count: 11
            }
          }).lean(false).execute()

        }))

    should.equal(result.c_depth_log[7], 9)

    finalResult = await promised(null, sandboxed(function() {
      const cache = require('cache')
      let cacheResult = cache.get(`ctxapi_640.${script.arguments.result._id.toString()}.lastExecution`),
          output = cache.get(`ctxapi_640.${script.arguments.result._id.toString()}.error`),
          maxExecutionDepthValue = org.read('configuration').scripting.maxExecutionDepth

      return { cacheResult, maxExecutionDepthValue, output }
    }, {
      runtimeArguments: {
        result
      }
    }))

    should.exist(finalResult.output)
    should.equal(finalResult.output.object, 'fault')
    should.equal(finalResult.output.errCode, 'script.invalidArgument.executionDepthExceeded')
    should.equal(finalResult.output.message, 'Max script execution depth exceeded.')
    should.equal(finalResult.output.statusCode, 400)
    should.equal(finalResult.cacheResult, null)
    should.equal(finalResult.maxExecutionDepthValue, 10)
  })

})
