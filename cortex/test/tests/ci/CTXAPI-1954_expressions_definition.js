const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      should = require('should'),
      { promised } = require('../../../lib/utils')

describe('Expression definition #CTXAPI-1954', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org, script */
      org.objects.expressions.insertOne({
        label: 'Expression test',
        description: 'Testing creating an expression',
        name: 'c_expressions_ctx_api_1954',
        active: true,
        environment: 'development',
        weight: 10,
        type: 'expression',
        expression: { $concat: ['', '$$ROOT.foo', '.bar'] }
      }).execute()

    }))

    await promised(null, sandboxed(function() {
      /* global org, script */
      org.objects.expressions.insertOne({
        label: 'Pipeline test',
        description: 'Testing creating an expression pipeline',
        name: 'c_pipelines_ctx_api_1954',
        active: true,
        environment: 'development',
        weight: 10,
        type: 'pipeline',
        pipeline: [{
          $project: {
            x: { $concat: ['', '$$ROOT.foo', '.bar'] }
          }
        }]
      }).execute()

    }))
  })

  after(async function() {
    return promised(null, sandboxed(function() {
      org.objects.expressions.deleteMany({ name: /^c_expressions_ctx_api_1954/ }).execute()
      org.objects.expressions.deleteMany({ name: /^c_pipelines_ctx_api_1954/ }).execute()
    }))
  })

  describe('Expressions', async() => {
    it('should exist in runtime', async() => {
      let expression
      const runtimeConfig = await promised(null, sandboxed(function() {
        return org.read('runtime')
      }))

      should.exist(runtimeConfig)
      expression = runtimeConfig.expressions.find(r => r.name === 'c_expressions_ctx_api_1954')
      should.exist(expression)

      should.equal(expression.weight, 10)
      should.equal(expression.type, 'expression')
      should.equal(expression.active, true)
      should.equal(expression.environment, 'development')
      should.equal(expression.metadata.runtime, false)
      should.equal(expression.metadata.resource, `expression#type(expression).name(c_expressions_ctx_api_1954)`)
    })

    it('should be removed from runtime after deletion', async() => {
      await promised(null, sandboxed(function() {
        /* global org, script */
        org.objects.expressions.insertOne({
          label: 'Expression to delete',
          description: 'Testing creating an expression',
          name: 'c_expressions_ctx_api_1954_to_delete',
          active: true,
          environment: 'development',
          weight: 10,
          type: 'expression',
          expression: { $concat: ['', '$$ROOT.foo', '.bar'] }
        }).execute()

      }))

      let expression,
          // read runtime to check it exists
          runtimeConfig = await promised(null, sandboxed(function() {
            return org.read('runtime')
          }))

      should.exist(runtimeConfig)
      expression = runtimeConfig.expressions.find(r => r.name === 'c_expressions_ctx_api_1954_to_delete')
      should.exist(expression)

      await promised(null, sandboxed(function() {
        script.exit({
          deleted: org.objects.expressions.deleteOne({ name: 'c_expressions_ctx_api_1954_to_delete' }).execute()
        })
      }))

      // read runtime again
      runtimeConfig = await promised(null, sandboxed(function() {
        return org.read('runtime')
      }))

      // it should not exist
      should.exist(runtimeConfig)
      expression = runtimeConfig.expressions.find(r => r.name === 'c_expressions_ctx_api_1954_to_delete')
      should.not.exist(expression)
    })

    it('should be able to fetch through REST API', async() => {
      let result = await server.sessions.admin
        .get(server.makeEndpoint('/expressions/c_expressions_ctx_api_1954'))
        .set({ 'Medable-Client-Key': server.sessionsClient.key })
        .then()

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.equal(result.body.weight, 10)
      should.equal(result.body.type, 'expression')
      should.equal(result.body.active, true)
      should.equal(result.body.environment, 'development')
    })

    it('should be able to create through REST API', async() => {
      let result = await server.sessions.admin
        .post(server.makeEndpoint('/expressions'))
        .set({ 'Medable-Client-Key': server.sessionsClient.key })
        .send({
          label: 'Expression test',
          description: 'Testing creating an expression',
          name: 'c_expressions_ctx_api_1954_post',
          active: true,
          environment: 'development',
          weight: 10,
          type: 'expression',
          expression: { $concat: ['', '$$ROOT.foo', '.bar'] }
        })
        .then()

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.equal(result.body.name, 'c_expressions_ctx_api_1954_post')
      should.equal(result.body.weight, 10)
      should.equal(result.body.type, 'expression')
      should.equal(result.body.active, true)
      should.equal(result.body.environment, 'development')
    })
  })

  describe('Pipelines', async() => {
    it('should exist in runtime', async() => {
      let pipeline
      const runtimeConfig = await promised(null, sandboxed(function() {
        return org.read('runtime')
      }))

      should.exist(runtimeConfig)
      pipeline = runtimeConfig.pipelines.find(r => r.name === 'c_pipelines_ctx_api_1954')
      should.exist(pipeline)

      should.equal(pipeline.weight, 10)
      should.equal(pipeline.type, 'pipeline')
      should.equal(pipeline.active, true)
      should.equal(pipeline.environment, 'development')
      should.equal(pipeline.metadata.runtime, false)
      should.equal(pipeline.metadata.resource, `expression#type(pipeline).name(c_pipelines_ctx_api_1954)`)
    })

    it('should be removed from runtime after deletion', async() => {
      await promised(null, sandboxed(function() {
        /* global org, script */
        org.objects.expressions.insertOne({
          label: 'pipeline to delete',
          description: 'Testing creating an expression pipeline',
          name: 'c_pipelines_ctx_api_1954_to_delete',
          active: true,
          environment: 'development',
          weight: 10,
          type: 'pipeline',
          pipeline: [{
            $project: {
              x: { $concat: ['', '$$ROOT.foo', '.bar'] }
            }
          }]
        }).execute()

      }))

      let pipeline,
          // read runtime to check it exists
          runtimeConfig = await promised(null, sandboxed(function() {
            return org.read('runtime')
          }))

      should.exist(runtimeConfig)
      pipeline = runtimeConfig.pipelines.find(r => r.name === 'c_pipelines_ctx_api_1954_to_delete')
      should.exist(pipeline)

      await promised(null, sandboxed(function() {
        script.exit({
          deleted: org.objects.expressions.deleteOne({ name: 'c_pipelines_ctx_api_1954_to_delete' }).execute()
        })
      }))

      // read runtime again
      runtimeConfig = await promised(null, sandboxed(function() {
        return org.read('runtime')
      }))

      // it should not exist
      should.exist(runtimeConfig)
      pipeline = runtimeConfig.pipelines.find(r => r.name === 'c_pipelines_ctx_api_1954_to_delete')
      should.not.exist(pipeline)
    })

    it('should be able to fetch through REST API', async() => {
      let result = await server.sessions.admin
        .get(server.makeEndpoint('/expressions/c_pipelines_ctx_api_1954'))
        .set({ 'Medable-Client-Key': server.sessionsClient.key })
        .then()

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.equal(result.body.weight, 10)
      should.equal(result.body.type, 'pipeline')
      should.equal(result.body.active, true)
      should.equal(result.body.environment, 'development')
    })

    it('should be able to create through REST API', async() => {
      let result = await server.sessions.admin
        .post(server.makeEndpoint('/expressions'))
        .set({ 'Medable-Client-Key': server.sessionsClient.key })
        .send({
          label: 'pipeline test',
          description: 'Testing creating an expression pipeline',
          name: 'c_pipelines_ctx_api_1954_post',
          active: true,
          environment: 'development',
          weight: 10,
          type: 'pipeline',
          pipeline: [{
            $project: {
              x: { $concat: ['', '$$ROOT.foo', '.bar'] }
            }
          }]
        })
        .then()

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.equal(result.body.name, 'c_pipelines_ctx_api_1954_post')
      should.equal(result.body.weight, 10)
      should.equal(result.body.type, 'pipeline')
      should.equal(result.body.active, true)
      should.equal(result.body.environment, 'development')
    })
  })
})
