'use strict'

const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-895 $exists in $or branching on indexed property make the wrong query', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      org.objects.objects.insertOne({
        label: 'c_ctxapi_895',
        name: 'c_ctxapi_895',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [
          {
            name: 'c_bool',
            label: 'Boolean Property',
            type: 'Boolean',
            indexed: true
          }]
      }).execute()

      org.objects.c_ctxapi_895.insertOne({
        c_bool: false
      }).execute()

      org.objects.c_ctxapi_895.insertOne().execute()

      org.objects.c_ctxapi_895.insertOne({
        c_bool: true
      }).execute()
    }))
  })

  it('getting items using $exists in $or should return results', async function() {
    const result = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_895.find({
        $or: [
          { c_bool: false },
          { c_bool: { $exists: false } }
        ]
      }).engine('stable').toArray()
    }))

    should(result.length).equal(2)

  })

})
