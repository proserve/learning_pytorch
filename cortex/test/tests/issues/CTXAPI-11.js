'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('CTXAPI-11 - property order', function() {

    it('reference created with paths[] before sourceObject', sandboxed(function() {

      /* global org */

      const Model = org.objects.c_ctxapi_11_a

      org.objects.Object.insertOne({
        label: Model.name,
        name: Model.name,
        properties: [
          {
            label: 'reference',
            name: 'c_reference',
            type: 'Reference',
            paths: ['name'],
            sourceObject: 'account'
          }
        ]
      }).execute()

    }))

  })

})
