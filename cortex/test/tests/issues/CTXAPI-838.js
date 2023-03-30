'use strict'

const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-838 inserting a uuid array throw error', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      org.objects.objects.insertOne({
        label: 'c_ctxapi_838_uuid',
        name: 'c_ctxapi_838_uuid',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          name: 'c_uuids',
          label: 'uuids',
          type: 'UUID',
          array: true
        }]
      }).execute()
    }))
    return true
  })

  it('inserting an array of uuid should succeed', async function() {

    const result = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_838_uuid.insertOne({
        c_uuids: [
          '7b6387a8-5a7b-4829-b3bb-036fe9da0677',
          '1bc58f96-83e4-4991-884e-ec3d6b97bcef',
          'cda634ac-d6aa-4cd6-b465-a76eb083ec2c',
          '31ad7e52-5748-48d6-a177-8aa76214a1bd'
        ]
      }).execute()
    }))

    should.exist(result)
    return true
  })

})
