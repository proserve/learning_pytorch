'use strict'

/* global before, after, org, script */

const sandboxed = require('../../../lib/sandboxed'),
      modules = require('../../../../lib/modules'),
      ap = require('../../../../lib/access-principal'),
      { promised } = require('../../../../lib/utils'),
      should = require('should'),
      loadScript = require('../../../lib/script.loader')

describe('Issues - CTXAPI-1240 - dbNext operator leaves a cursor operation open', function() {

  before(async function() {
    const triggerScript = loadScript('CTXAPI-1240_trigger_script.js')

    await promised(null, sandboxed(function() {
      org.objects.objects.insertOne({
        name: 'c_ctxapi_1240_object',
        label: 'c_ctxapi_1240_object',
        defaultAcl: 'role.administrator.delete',
        createAcl: 'account.public',
        properties: [{
          name: 'c_string',
          label: 'c_string',
          type: 'String',
          indexed: true
        }, {
          name: 'c_boolean',
          label: 'c_boolean',
          type: 'Boolean',
          indexed: true
        }]
      }).execute()

      org.objects.c_ctxapi_1240_object.insertOne({
        c_string: 'The first',
        c_boolean: false
      }).execute()

      org.objects.scripts.insertOne({
        label: 'c_ctxapi_1240_trigger_lib',
        name: 'c_ctxapi_1240_trigger_lib',
        type: 'library',
        configuration: {
          export: 'c_ctxapi_1240_trigger_lib'
        },
        script: script.arguments.triggerScript
      }).execute()

    }, {
      runtimeArguments: {
        triggerScript
      }
    }))

  })

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_1240_trigger_lib' }).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_1240_object' }).execute()
  }))

  it('should explicitly close the cursor when using $dbNext operator', async function() {
    let instance, operations

    instance = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_1240_object.insertOne({
        c_string: 'The second',
        c_boolean: false
      }).lean(false).execute()
    }))

    should.exist(instance)
    instance.should.containDeep({
      c_boolean: false,
      c_string: 'The second',
      object: 'c_ctxapi_1240_object'
    })

    const baseOrg = await modules.db.models.Org.loadOrg('medable'),
          principal = ap.synthesizeOrgAdmin(baseOrg)

    operations = await promised(null, sandboxed(function() {
      /* global sys */
      return sys.findOperations().find(op => op.dbOptions && op.dbOptions.object === 'c_ctxapi_1240_object')
    },
    {
      principal
    }))

    should.not.exist(operations)
  })

})
