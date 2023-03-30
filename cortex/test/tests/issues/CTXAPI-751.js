'use strict'

const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-751 $size operator parser not working', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      // Insert non localized
      org.objects.objects.insertOne({
        name: 'c_ctxapi_751',
        label: 'Size not working',
        defaultAcl: ['owner.delete'],
        createAcl: ['account.public'],
        properties: [{
          name: 'c_string',
          label: 'Strings',
          type: 'String',
          array: true,
          indexed: true,
          removable: true
        }]
      }).execute()

      org.objects.c_ctxapi_751.insertOne({ c_string: ['a'] }).execute()
      org.objects.c_ctxapi_751.insertOne({ c_string: ['a', 'b', 'c'] }).execute()
      org.objects.c_ctxapi_751.insertOne({}).execute()

    }))
  })

  it('check $size operator working', async() => {
    const result = await promised(null, sandboxed(function() {
      return [
        org.objects.c_ctxapi_751.find({ c_string: { $size: 0 } }).toArray(),
        org.objects.c_ctxapi_751.find({ c_string: { $size: 1 } }).toArray(),
        org.objects.c_ctxapi_751.find({ c_string: { $size: 3 } }).toArray(),
        org.objects.c_ctxapi_751.find({ c_string: { $size: 5 } }).toArray()
      ]
    }))

    should.equal(result[0].length, 1)
    should.equal(result[0][0].c_string.length, 0)
    should.equal(result[1].length, 1)
    should.deepEqual(result[1][0].c_string, ['a'])
    should.equal(result[2].length, 1)
    should.deepEqual(result[2][0].c_string, ['a', 'b', 'c'])
    should.equal(result[3].length, 0)
  })

})
