'use strict'

const sandboxed = require('../../lib/sandboxed')

/* global org, consts */

describe('Issues', function() {

  describe('CTXAPI-111 - 500 error with matching by type on untyped object', function() {

    before(function(callback) {

      sandboxed(function() {

        let Model = org.objects.c_ctxapi_111

        org.objects.Object.insertOne({
          label: Model.name,
          name: Model.name,
          defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
          createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
          properties: [{
            label: 'c_abc',
            name: 'c_abc',
            type: 'String',
            indexed: true
          }, {
            label: 'c_xyz',
            name: 'c_xyz',
            type: 'Number',
            indexed: true
          }]
        }).execute()

      })(function(err) {
        callback(err)
      })

    })

    it('query a untyped object with type should return 400 exception', sandboxed(function() {

      const tryCatch = require('util.values').tryCatch,
            Model = org.objects.c_ctxapi_111

      tryCatch(function() {
        Model.find({ type: 'one_type' }).engine('latest').toArray()
      }, function(err) {
        if (![err, err.code === 'kInvalidArgument', err.path === 'type'].every(v => v)) {
          throw new Error('Expected kInvalidArgument on type')
        }
      })

      tryCatch(function() {
        Model.find({ type: 'one_type' }).engine('stable').toArray()
      }, function(err) {
        if (![err, err.code === 'kInvalidArgument', err.path === 'type'].every(v => v)) {
          throw new Error('Expected kInvalidArgument on type')
        }
      })

    }))

  })

})
