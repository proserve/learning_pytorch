'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('CTXAPI-10', function() {

    it('Should not crash when doing a PATCH through lists.', sandboxed(function() {

      /* global org, consts */

      const pathTo = require('util.paths.to'),
            tryCatch = require('util.values').tryCatch,
            Parent = org.objects.c_ctxapi_10_parent

      let doc

      org.objects.object.insertOne({
        label: 'CTXAPI-10',
        name: 'c_ctxapi_10_parent',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }]
      }).execute()

      org.objects.object.insertOne({
        label: 'CTXAPI-10',
        name: 'c_ctxapi_10_child',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'Name', name: 'c_name', type: 'String', removable: true },
          { label: 'Fixed', name: 'c_fixed', type: 'String', removable: false },
          { label: 'Parent', name: 'c_parent', type: 'Reference', sourceObject: 'c_ctxapi_10_parent' }
        ]
      }).execute()

      org.objects.object.updateOne({
        name: 'c_ctxapi_10_parent'
      }, {
        $push: {
          properties: [
            { label: 'Children', name: 'c_children', type: 'List', readThrough: true, writeThrough: true, sourceObject: 'c_ctxapi_10_child' }
          ]
        }
      }).execute()

      doc = Parent.insertOne({
        c_children: [{
          c_fixed: 'foo',
          c_name: 'bar'
        }]
      }).lean(false).include('c_children').execute()

      tryCatch(

        () => {

          Parent.updateOne({ _id: doc._id })
            .pathPatch(
              `c_children/${doc.c_children.data[0]._id}`,
              [{
                op: 'remove',
                path: 'c_fixed'
              }]
            )

        },
        err => {

          if (pathTo(err, 'errCode') === 'cortex.accessDenied.notDeletable' &&
            pathTo(err, 'path') === 'c_fixed'
          ) {
            return true
          }
          throw err
        }
      )

      // should be okay to remove c_name
      tryCatch(

        () => {

          Parent.updateOne({ _id: doc._id })
            .pathPatch(
              `c_children/${doc.c_children.data[0]._id}`,
              [{
                op: 'remove',
                path: 'c_name'
              }]
            )

        },
        err => {
          if (err) throw err
        }
      )

      // adds passive option to ignore error
      tryCatch(

        () => {

          Parent.updateOne({ _id: doc._id })
            .passive()
            .pathPatch(
              `c_children/${doc.c_children.data[0]._id}`,
              [{
                op: 'remove',
                path: 'c_fixed'
              }]
            )

        },
        err => {
          if (err) throw err
        }
      )

    }))

  })

})
