'use strict'

const sandboxed = require('../../lib/sandboxed'),
      loadScript = require('../../lib/script.loader'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      { promised } = require('../../../lib/utils'),
      should = require('should'),
      instances = [
        {
          c_number: 4,
          c_boolean: true,
          c_string: 'stringA',
          c_string_b: 'stringB',
          c_string_array: ['first', 'second'],
          c_number_array: [8, 16, 32, 64],
          c_doc_array: [{
            c_string: 'first_doc'
          }, {
            c_string: 'second_doc'
          }]
        },
        {
          c_number: 8,
          c_boolean: true,
          c_string: 'stringB',
          c_string_b: 'stringC',
          c_string_array: ['third', 'fourth'],
          c_number_array: [16, 32, 64, 128],
          c_doc_array: [{
            c_string: 'third_doc'
          }, {
            c_string: 'fourth_doc'
          }]
        },
        {
          c_number: 15,
          c_boolean: true,
          c_string: 'stringC',
          c_string_b: 'stringD',
          c_string_array: ['fifth', 'sixth'],
          c_number_array: [30, 60, 120, 240],
          c_doc_array: [{
            c_string: 'fifth_doc'
          }, {
            c_string: 'sixth_doc'
          }]
        },
        {
          c_number: 16,
          c_boolean: true,
          c_string: 'stringE',
          c_string_b: 'stringF',
          c_string_array: ['seventh', 'eighth'],
          c_number_array: [32, 64, 128, 256],
          c_doc_array: [{
            c_string: 'seventh_doc'
          }, {
            c_string: 'eighth_doc'
          }]
        }
      ],
      transformScript = loadScript('CTXAPI-260_script_transform.js')

describe('Features - Script transform', function() {

  // Enable transformations within views
  let enableViewTransforms,
      enableApiPolicies

  before(callback => {
    enableViewTransforms = server.org.configuration.scripting.enableViewTransforms
    enableViewTransforms = server.org.configuration.scripting.enableApiPolicies

    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.scripting.enableViewTransforms': true,
        'configuration.scripting.enableApiPolicies': true
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  after(callback => {
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.scripting.enableViewTransforms': enableViewTransforms,
        'configuration.scripting.enableApiPolicies': enableApiPolicies
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  before(sandboxed(function() {

    /* global org, script */

    org.objects.objects.insertOne({
      label: 'CTXAPI-260',
      name: 'c_ctxapi_260',
      defaultAcl: ['owner.delete'],
      createAcl: ['account.public'],
      properties: [
        { name: 'c_string', label: 'A string', type: 'String', indexed: true },
        { name: 'c_number', label: 'Number', type: 'Number', indexed: true },
        { name: 'c_boolean', label: 'Boolean', type: 'Boolean', indexed: true },
        { name: 'c_string_b', label: 'Another string', type: 'String', removable: true },
        { name: 'c_string_array', label: 'String Array', type: 'String', array: true },
        { name: 'c_number_array', label: 'Number Array', type: 'Number', array: true },
        {
          name: 'c_doc_array',
          label: 'Document Array',
          type: 'Document',
          array: true,
          properties: [{
            name: 'c_string',
            label: 'String',
            type: 'String'
          }]
        }]
    }).execute()

    org.objects.c_ctxapi_260.insertMany(script.arguments.instances).execute()

    org.objects.scripts.insertOne({
      label: 'Transformer Library',
      name: 'c_ctxapi_260_transform_lib',
      description: 'Library to transform',
      type: 'library',
      script: script.arguments.transformScript,
      configuration: {
        export: 'c_ctxapi_260_transform_lib'
      }
    }).execute()

    org.objects.views.insertOne({
      name: 'c_ctxapi_260_transform_view',
      label: 'Transformer View',
      description: 'A View using Apply a transformation',
      active: true,
      sourceObject: 'c_ctxapi_260',
      script: script.arguments.transformScript
    }).execute()

  }, {
    runtimeArguments: {
      instances,
      transformScript
    }
  }))

  after(sandboxed(function() {
    const should = require('should')
    org.objects.c_ctxapi_260.deleteMany({}).execute()
    org.objects.views.deleteOne({ name: 'c_ctxapi_260_transform_view' }).execute()
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_260_transform_lib' }).execute()

    should.equal(org.objects.c_ctxapi_260.find().count(), 0)
    should.equal(org.objects.views.find({ name: 'c_ctxapi_260_transform_view' }).count(), 0)
    should.equal(org.objects.scripts.find({ name: 'c_ctxapi_260_transform_lib' }).count(), 0)
  }))

  it('should transform a cursor with an inline Transformer', async() => {

    let result

    result = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_260.find().transform(
        `
      error(err) {
        throw Fault.create('axon.error.transformed', { faults: [err] })
      }

      beforeAll(memo, { cursor }) {
        const should = require('should')

        should.equal(cursor.hasNext(), true)
        should.equal(cursor.isClosed(), false)

        cursor.push({
          message: 'I am using the inline transformer!'
        })
        memo.beforeAll = true
        memo.count = 0
      }
      before(memo, { cursor }) {
        const should = require('should')

        should.equal(cursor.hasNext(), true)
        should.equal(cursor.isClosed(), false)

        memo.before = true
        cursor.push({
          message: 'Before goes before after'
        })
      }
      each(object, memo, { cursor }) {
        memo.count++
        let c_string = object.c_string
        object.c_transformed = true

        cursor.push({
          message: 'Transforming ' + c_string
        })

        return object
      }
      after(memo, { cursor }) {
        const should = require('should')

        should.equal(cursor.hasNext(), false)
        should.equal(cursor.isClosed(), true)

        memo.after = true
        cursor.push({
          message: 'After comes after before'
        })
      }
      afterAll(memo, { cursor }) {
        const should = require('should')

        should.equal(cursor.hasNext(), false)
        should.equal(cursor.isClosed(), true)

        memo.afterAll = true
        cursor.push({
          message: 'Wrapping up!'
        })
        cursor.push({
          object: 'memo',
          ...memo
        })
      }
    `
      ).toArray()
    }, 'admin'))

    should.exist(result)
    should.equal(result.length, 13)
    result.forEach(res => {
      should.exist(res)
    })

    should.equal(result[0].message, 'I am using the inline transformer!')
    should.equal(result[1].message, 'Before goes before after')
    should.equal(result[2].message, 'Transforming stringA')
    result[3].should.containDeep({ ...instances[0], c_transformed: true })
    should.equal(result[4].message, 'Transforming stringB')
    result[5].should.containDeep({ ...instances[1], c_transformed: true })
    should.equal(result[6].message, 'Transforming stringC')
    result[7].should.containDeep({ ...instances[2], c_transformed: true })
    should.equal(result[8].message, 'Transforming stringE')
    result[9].should.containDeep({ ...instances[3], c_transformed: true })
    should.equal(result[10].message, 'After comes after before')
    should.equal(result[11].message, 'Wrapping up!')
    result[12].should.be.eql({
      object: 'memo',
      beforeAll: true,
      count: 4,
      before: true,
      after: true,
      afterAll: true
    })
  })

  it('should transform a cursor using a library reference to the Transformer', async() => {

    let result

    result = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_260.find().transform('c_ctxapi_260_transform_lib').toArray()
    }, 'admin'))

    should.exist(result)
    should.equal(result.length, 13)
    result.forEach(res => {
      should.exist(res)
    })

    should.equal(result[0].message, 'Before anything')
    should.equal(result[1].message, 'Before goes before after')
    should.equal(result[2].message, 'Transforming stringA')
    result[3].should.containDeep({ ...instances[0], c_transformed: true })
    should.equal(result[4].message, 'Transforming stringB')
    result[5].should.containDeep({ ...instances[1], c_transformed: true })
    should.equal(result[6].message, 'Transforming stringC')
    result[7].should.containDeep({ ...instances[2], c_transformed: true })
    should.equal(result[8].message, 'Transforming stringE')
    result[9].should.containDeep({ ...instances[3], c_transformed: true })
    should.equal(result[10].message, 'After comes after before')
    should.equal(result[11].message, 'Wrapping up!')
    result[12].should.be.eql({
      object: 'memo',
      beforeAll: true,
      count: 4,
      before: true,
      after: true,
      afterAll: true
    })
  })

  it('should create a view to apply a transformation', async() => {
    let result

    result = await server.sessions.admin
      .get(server.makeEndpoint('/views/c_ctxapi_260_transform_view'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })

    should.exist(result.body)
    should.exist(result.body.data)
    should.equal(result.body.data.length, 13)
    result.body.data.forEach(res => {
      should.exist(res)
    })

    should.equal(result.body.data[0].message, 'Before anything')
    should.equal(result.body.data[1].message, 'Before goes before after')
    should.equal(result.body.data[2].message, 'Transforming stringA')
    result.body.data[3].should.containDeep({ ...instances[0], c_transformed: true })
    should.equal(result.body.data[4].message, 'Transforming stringB')
    result.body.data[5].should.containDeep({ ...instances[1], c_transformed: true })
    should.equal(result.body.data[6].message, 'Transforming stringC')
    result.body.data[7].should.containDeep({ ...instances[2], c_transformed: true })
    should.equal(result.body.data[8].message, 'Transforming stringE')
    result.body.data[9].should.containDeep({ ...instances[3], c_transformed: true })
    should.equal(result.body.data[10].message, 'After comes after before')
    should.equal(result.body.data[11].message, 'Wrapping up!')
    result.body.data[12].should.be.eql({
      object: 'memo',
      beforeAll: true,
      count: 4,
      before: true,
      after: true,
      afterAll: true
    })
  })

  it('should create a policy with the Apply a Transformation action', async() => {
    let result, policyId

    policyId = await promised(null, sandboxed(function() {
      let policyId

      org.objects.org.updateOne({ code: org.code }, {
        $push: {
          policies: [{
            name: 'c_ctxapi_260_transform_policy',
            label: 'Transform Policy',
            priority: 0,
            active: true,
            condition: 'and',
            methods: ['get'],
            paths: ['/c_ctxapi_260'],
            action: 'Transform',
            script: script.arguments.transformScript
          }]
        }
      }).execute()

      policyId = org.objects.org.find({ code: org.code }).include('policies').next()
        .policies
        .filter(p => p.name === 'c_ctxapi_260_transform_policy')[0]
        ._id

      return policyId
    }, {
      runtimeArguments: {
        transformScript
      }
    }))

    result = await server.sessions.admin
      .get(server.makeEndpoint('/c_ctxapi_260'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })

    should.exist(result.body)
    should.exist(result.body.data)
    should.equal(result.body.data.length, 13)
    result.body.data.forEach(res => {
      should.exist(res)
    })

    should.equal(result.body.data[0].message, 'Before anything')
    should.equal(result.body.data[1].message, 'Before goes before after')
    should.equal(result.body.data[2].message, 'Transforming stringA')
    result.body.data[3].should.containDeep({ ...instances[0], c_transformed: true })
    should.equal(result.body.data[4].message, 'Transforming stringB')
    result.body.data[5].should.containDeep({ ...instances[1], c_transformed: true })
    should.equal(result.body.data[6].message, 'Transforming stringC')
    result.body.data[7].should.containDeep({ ...instances[2], c_transformed: true })
    should.equal(result.body.data[8].message, 'Transforming stringE')
    result.body.data[9].should.containDeep({ ...instances[3], c_transformed: true })
    should.equal(result.body.data[10].message, 'After comes after before')
    should.equal(result.body.data[11].message, 'Wrapping up!')
    result.body.data[12].should.be.eql({
      object: 'memo',
      beforeAll: true,
      count: 4,
      before: true,
      after: true,
      afterAll: true
    })

    await promised(null, sandboxed(function() {
      org.objects.org.patchOne({
        code: org.code
      }, {
        op: 'remove',
        path: 'policies',
        value: script.arguments.policyId
      }).execute()
    }, {
      runtimeArguments: {
        policyId: policyId.toString()
      }
    }))
  })

  it('should transform one result using a policy', async() => {

    let result, ids

    ids = await promised(null, sandboxed(function() {
      let policyId, objectId

      objectId = org.objects.c_ctxapi_260.find({ c_string: 'stringA' }).next()._id.toString()

      org.objects.org.updateOne({ code: org.code }, {
        $push: {
          policies: [{
            name: 'c_ctxapi_260_transform_one_result_policy',
            label: 'Transform One Result Policy',
            priority: 0,
            active: true,
            condition: 'and',
            methods: ['get'],
            paths: ['/c_ctxapi_260/' + objectId],
            action: 'Transform',
            script: script.arguments.transformScript
          }]
        }
      }).execute()

      policyId = org.objects.org.find({ code: org.code }).include('policies').next()
        .policies
        .filter(p => p.name === 'c_ctxapi_260_transform_one_result_policy')[0]
        ._id
        .toString()

      return { policyId, objectId }
    }, {
      runtimeArguments: {
        transformScript
      }
    }))

    result = await server.sessions.admin
      .get(server.makeEndpoint('/c_ctxapi_260/' + ids.objectId))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })

    should.exist(result.body)

    result.body.should.containDeep({ ...instances[0], c_the_result: true })
    should.exist(result.headers)
    should.equal(result.headers['x-the-result'], 'true')

    await promised(null, sandboxed(function() {
      org.objects.org.patchOne({
        code: org.code
      }, {
        op: 'remove',
        path: 'policies',
        value: script.arguments.policyId
      }).execute()
    }, {
      runtimeArguments: {
        policyId: ids.policyId
      }
    }))
  })

  it('should wrap the errors thrown', sandboxed(function() {

    const { tryCatch } = require('util.values'),
          should = require('should')

    tryCatch(function() {
      return org.objects.c_ctxapi_260
        .find({ c_undefined_prop: 'Does not exist' })
        .transform('c_ctxapi_260_transform_lib')
        .toArray()
    }, function(err, result) {
      should.not.exist(result)
      should.exist(err)
      should.equal(err.errCode, 'axon.error.transformed')
      should.equal(err.status, 500)
      should.equal(err.object, 'fault')
      should.exist(err.faults)
      should.equal(err.faults.length, 1)
      should.equal(err.faults[0].object, 'fault')
      should.equal(err.faults[0].status, 400)
      should.equal(err.faults[0].errCode, 'script.error.unspecified')
    })

  }))
})
