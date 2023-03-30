'use strict'

const server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      loadScript = require('../../../lib/script.loader'),
      { promised } = require('../../../../lib/utils'),
      { deleteInstance } = require('../../../lib/utils')(),
      should = require('should'),
      { cache } = require('../../../../lib/modules')

describe('Issues - CTXAPI-1256 - Delete triggers should include configuration paths', function() {
  before(async() => {
    const triggerLib = loadScript('CTXAPI-1256_TriggerObject.js')
    await promised(null, sandboxed(function() {
      /* global script, org */
      org.objects.objects.insertOne({
        name: 'c_ctxapi_1256_object',
        label: 'c_ctxapi_1256_object',
        defaultAcl: 'role.administrator.delete',
        createAcl: 'account.public',
        properties: [{
          name: 'c_string',
          label: 'c_string',
          type: 'String',
          indexed: true
        }, {
          name: 'c_another_string',
          label: 'c_another_string',
          type: 'String',
          indexed: true
        }]
      }).execute()

      org.objects.scripts.insertOne({
        label: 'c_ctxapi_1256_trigger_lib',
        name: 'c_ctxapi_1256_trigger_lib',
        type: 'library',
        configuration: {
          export: 'c_ctxapi_1256_trigger_lib'
        },
        script: script.arguments.triggerLib
      }).execute()
    }, {
      principal: server.principals.admin,
      runtimeArguments: {
        triggerLib
      }
    }))
  })

  after(async() => {
    await promised(null, sandboxed(function() {
      org.objects.scripts.deleteOne({ name: 'c_ctxapi_1256_trigger_lib' }).execute()
      org.objects.objects.deleteOne({ name: 'c_ctxapi_1256_object' }).execute()
    }))
  })

  it('should load the configured paths on delete triggers', async() => {

    // insert an object and delete it.
    const objectId = await promised(null, sandboxed(function() {
      let result = org.objects.c_ctxapi_1256_object.insertOne({
        c_string: 'The first',
        c_another_string: 'The second'
      }).execute()
      return result
    }))

    let beforeDelete, afterDelete
    await deleteInstance('c_ctxapi_1256_object', objectId)

    // get values set by the triggers from the cache
    beforeDelete = await promised(cache, 'get', server.org, `c_ctxapi_1256_object.${objectId}.before_delete`)
    afterDelete = await promised(cache, 'get', server.org, `c_ctxapi_1256_object.${objectId}.after_delete`)

    should.exist(beforeDelete.c_string)
    should.equal(beforeDelete.c_string, 'The first')
    should.exist(beforeDelete.object)
    should.equal(beforeDelete.object, 'c_ctxapi_1256_object')

    should.exist(afterDelete.c_string)
    should.equal(afterDelete.c_string, 'The first')
    should.exist(afterDelete.c_another_string)
    should.equal(afterDelete.c_another_string, 'The second')
    should.exist(afterDelete.object)
    should.equal(afterDelete.object, 'c_ctxapi_1256_object')

  })

})
