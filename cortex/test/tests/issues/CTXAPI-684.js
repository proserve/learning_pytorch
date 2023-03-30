'use strict'

const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-684 deleteMany with empty params not working', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      // Insert non localized
      org.objects.objects.insertOne({
        localized: true,
        name: 'c_ctxapi_684',
        label: 'Test Object',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'String Label',
          name: 'c_string',
          type: 'String',
          indexed: true,
          removable: true
        }]
      }).execute()

    }))
  })

  it('deleteMany getOptions should be the same with empty and {} as param', async() => {
    const result = await promised(null, sandboxed(function() {
      return [
        org.objects.c_ctxapi_684.deleteMany().getOptions(),
        org.objects.c_ctxapi_684.deleteMany({}).getOptions()
      ]
    }))

    should.deepEqual(result[0], result[1])
  })

  it('create object and delete them', async() => {
    await promised(null, sandboxed(function() {
      org.objects.c_ctxapi_684.insertOne({ c_string: 'test 1' }).execute()
      org.objects.c_ctxapi_684.insertOne({ c_string: 'test 2' }).execute()
      org.objects.c_ctxapi_684.insertOne({ c_string: 'test 3' }).execute()
    }))

    const initial = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_684.find().count()
    }))

    await promised(null, sandboxed(function() {
      org.objects.c_ctxapi_684.deleteMany().execute()
    }))

    // eslint-disable-next-line one-var
    const final = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_684.find().count()
    }))

    should(initial).equal(3)
    should(final).equal(0)
  })

})
