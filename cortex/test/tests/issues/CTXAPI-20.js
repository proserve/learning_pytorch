'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('CTXAPI-20', function() {

    it('cortex.invalidArgument.creatableOnly error should be a child of cortex.invalidArgument.validation', sandboxed(function() {

      /* global org, consts */

      const pathTo = require('util.paths.to'),
            tryCatch = require('util.values').tryCatch,
            Model = org.objects.c_ctxapi_20

      if (!org.objects.object.find({ name: 'c_ctxapi_20' }).hasNext()) {

        org.objects.object.insertOne({
          label: 'CTXAPI-20',
          name: 'c_ctxapi_20',
          defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
          createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
          properties: [
            { label: 'Prop', name: 'c_prop', type: 'String', creatable: true }
          ]
        }).execute()

      }

      tryCatch(
        () => {
          let _id = Model.insertOne({}).execute()
          Model.updateOne({ _id }, { $set: { c_prop: 'foo' } }).execute()
        },
        err => {
          if (pathTo(err, 'errCode') === 'cortex.invalidArgument.validation' &&
            pathTo(err, 'faults.0.errCode') === 'cortex.invalidArgument.creatableOnly' &&
            pathTo(err, 'faults.0.path') === 'c_ctxapi_20.c_prop'
          ) {
            return true
          }
          throw err
        }
      )

    }))

  })

})
