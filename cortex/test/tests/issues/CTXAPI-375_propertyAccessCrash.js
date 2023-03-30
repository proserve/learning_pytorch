'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-375 - Property Access with Lists', function() {

  before(sandboxed(function() {

    org.objects.objects.insertOne({
      label: 'c_ctxapi_375',
      name: 'c_ctxapi_375',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [
        {
          name: 'c_list',
          label: 'c_list',
          type: 'List',
          sourceObject: 'account',
          writeThrough: true
        }]
    }).execute()

  }))

  it('checking propertyAccess on an instance with a list with writeThrough should not crash.', sandboxed(function() {

    /* global org */

    org.objects.c_ctxapi_375.insertOne({}).execute()
    org.objects.c_ctxapi_375.find().include('propertyAccess').next()

  }))

})
