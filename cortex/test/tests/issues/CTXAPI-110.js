'use strict'

/* global before */

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('CTXAPI-110 - Property model not found for some matches', function() {

    let refId

    before(function(callback) {

      sandboxed(function() {

        /* global org, consts */

        let Model = org.objects.c_ctxapi_110,
            RefModel = org.objects.c_ctxapi_110_ref,
            refId

        org.objects.Object.insertOne({
          label: RefModel.name,
          name: RefModel.name,
          defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
          createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }]
        }).execute()

        org.objects.Object.insertOne({
          label: Model.name,
          name: Model.name,
          defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
          createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
          properties: [{
            label: 'c_ref_a',
            name: 'c_ref_a',
            type: 'Reference',
            sourceObject: RefModel.name,
            indexed: true,
            acl: [{ type: 3, target: '000000000000000000000004', allow: 7 }],
            expandable: true,
            referenceAccess: 0,
            grant: 0,
            inheritInstanceRoles: true,
            defaultAcl: [{ type: 3, target: '000000000000000000000004', allow: 7 }]
          }, {
            label: 'c_ref_b',
            name: 'c_ref_b',
            type: 'Reference',
            sourceObject: RefModel.name,
            indexed: true,
            acl: [{ type: 3, target: '000000000000000000000004', allow: 7 }],
            expandable: true,
            referenceAccess: 0,
            grant: 0,
            inheritInstanceRoles: true,
            defaultAcl: [{ type: 3, target: '000000000000000000000004', allow: 7 }]
          }],
          objectTypes: [
            {
              label: 'c_email',
              name: 'c_email',
              properties: [
                { label: 'c_value', name: 'c_value', type: 'String', indexed: true }
              ]
            },
            {
              label: 'c_other',
              name: 'c_other',
              properties: [
                { label: 'c_value', name: 'c_value', type: 'Boolean', indexed: true }
              ]
            }
          ]
        }).execute()

        refId = RefModel.insertOne().execute()

        Model.insertMany([
          { type: 'c_email', c_value: 'test@example.org', c_ref_a: refId, c_ref_b: refId },
          { type: 'c_email', c_value: 'test@example.org' },
          { type: 'c_other', c_ref_a: refId, c_ref_b: refId }
        ]).execute()

        return refId

      })(function(err, result) {
        refId = result
        callback(err)
      })

    })

    it('searching using reference without _id', sandboxed(function() {

      /* global org, script */

      require('should')

      const Model = org.objects.c_ctxapi_110

      Model.find({ type: 'c_email', 'c_ref_b._id': script.arguments.refId }).paths('c_value', 'c_ref_b').engine('stable').count().should.equal(1)
      Model.find({ type: 'c_email', 'c_ref_b._id': script.arguments.refId }).paths('c_value', 'c_ref_b').engine('latest').count().should.equal(1)

      Model.find({ type: 'c_email', c_ref_b: script.arguments.refId }).paths('c_value', 'c_ref_b').engine('stable').count().should.equal(1)
      Model.find({ type: 'c_email', c_ref_b: script.arguments.refId }).paths('c_value', 'c_ref_b').engine('latest').count().should.equal(1)

    }, 'admin', 'route', 'javascript', 'es6', { refId }))

  })

})
