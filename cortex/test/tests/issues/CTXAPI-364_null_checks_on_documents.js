'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-364 - Null checks', function() {

  before(sandboxed(function() {

    org.objects.objects.insertOne({
      label: 'c_ctxapi_364',
      name: 'c_ctxapi_364',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      uniqueKey: 'c_key',
      properties: [
        {
          name: 'c_key', label: 'c_key', uuidVersion: 4, autoGenerate: true, type: 'UUID', indexed: true, unique: true
        },
        {
          name: 'c_arr',
          label: 'c_arr',
          type: 'Document',
          array: true,
          uniqueKey: 'c_key',
          properties: [{
            name: 'c_key', label: 'c_key', uuidVersion: 4, autoGenerate: true, type: 'UUID', validators: [{ name: 'uniqueInArray' }]
          }, {
            name: 'c_string', label: 'c_string', type: 'String'
          }]
        }]
    }).execute()

  }))

  it('check for null in document def when a unique key exists', sandboxed(function() {

    /* global org */
    const should = require('should')

    // https://gitlab.medable.com/cortex/api/merge_requests/772/diffs#165c26e491ce9123e799d30b13f942aff999d4fb_606_605
    let err
    try {

      org.objects.c_ctxapi_364.insertOne({
        c_arr: [{}, null]
      }).execute()

    } catch (e) {
      err = e
    }

    should.exist(err)
    err.errCode.should.equal('cortex.invalidArgument.unspecified')
    err.path.should.equal('c_arr')

  }))

})
