'use strict'
const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Issues - CTXAPI-910 - Localized uniqueValues', function() {

  before(sandboxed(function() {

    /* global org */
    org.objects.objects.insertOne({
      label: 'CTXAPI-910 Localized String Array',
      name: 'c_ctxapi_910_localized',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [{
        name: 'c_string_array',
        label: 'c_string_array',
        type: 'String',
        array: true,
        uniqueValues: true,
        localization: {
          enabled: true,
          strict: false,
          fallback: false,
          fixed: ''
        }
      }]
    }).execute()
  }))

  after(sandboxed(function() {
    org.objects.objects.deleteOne({ name: 'c_ctxapi_910_localized' }).execute()
  }))

  afterEach(sandboxed(function() {
    org.objects.c_ctxapi_910_localized.deleteMany().execute()
  }))

  it('should update via script with unique values when initial array is empty', async function() {
    let result

    result = await promised(null, sandboxed(function() {
      const _id = org.objects.c_ctxapi_910_localized.insertOne({
        c_string_array: []
      }).execute()

      return org.objects.c_ctxapi_910_localized.updateOne({ _id }, {
        $push: {
          c_string_array: [ 'one', 'one', 'two' ]
        }
      }).lean(false).execute()
    }))

    should.exist(result)
    result.c_string_array.should.deepEqual([ 'one', 'two' ])
  })

  it('should update via script with unique values when initial array is not empty', async function() {
    let result

    result = await promised(null, sandboxed(function() {
      const _id = org.objects.c_ctxapi_910_localized.insertOne({
        c_string_array: [ 'one', 'two' ]
      }).execute()

      return org.objects.c_ctxapi_910_localized.updateOne({ _id }, {
        $push: {
          c_string_array: [ 'one' ]
        }
      }).lean(false).execute()
    }))

    should.exist(result)
    result.c_string_array.should.deepEqual([ 'one', 'two' ])
  })

  it('should update via REST with unique values when initial array is empty', async function() {
    let instance, update

    instance = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_910_localized.insertOne({
        c_string_array: []
      }).lean(false).execute()
    }))

    should.exist(instance)
    instance.should.containDeep({
      object: 'c_ctxapi_910_localized',
      c_string_array: []
    })

    update = await server.sessions.admin
      .put(server.makeEndpoint(`/c_ctxapi_910_localized/${instance._id}`))
      .set(server.getSessionHeaders())
      .send({
        c_string_array: [ 'one', 'two', 'one' ]
      })

    should.exist(update.body)
    should.not.exist(update.body.errCode)
    update.body.should.containDeep({
      object: 'c_ctxapi_910_localized',
      c_string_array: [ 'one', 'two' ]
    })

  })

  it('should update via REST with unique values when initial array is not empty', async function() {
    let instance, update

    instance = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_910_localized.insertOne({
        c_string_array: [ 'apple', 'orange' ]
      }).lean(false).execute()
    }))

    should.exist(instance)
    instance.should.containDeep({
      object: 'c_ctxapi_910_localized',
      c_string_array: [ 'apple', 'orange' ]
    })

    update = await server.sessions.admin
      .post(server.makeEndpoint(`/c_ctxapi_910_localized/${instance._id}/c_string_array`))
      .set(server.getSessionHeaders())
      .send([ 'apple' ])

    should.exist(update.body)
    should.not.exist(update.body.errCode)
    update.body.should.deepEqual({
      object: 'list',
      data: [
        'apple',
        'orange'
      ],
      hasMore: false
    })

  })

})
