'use strict'

/* global CortexObject, script, org, consts */

const sandboxed = require('../../lib/sandboxed')

describe('Properties', function() {

  describe('References', function() {

    it('auto-create test', sandboxed(function() {

      const Model = CortexObject.as('Object')

      Model.insertOne({
        name: 'c_ref_property_child_autoCreate',
        label: 'Child',
        hasETag: true,
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        properties: [{
          label: 'Foo',
          name: 'c_foo',
          type: 'String'
        }]
      }).execute()

      Model.insertOne({
        name: 'c_ref_property_parent_autoCreate',
        label: 'Ref Testing',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        hasETag: true,
        properties: [{
          label: 'Foo',
          name: 'c_foo',
          type: 'String'
        }, {
          label: 'Child',
          name: 'c_child',
          type: 'Reference',
          sourceObject: 'c_ref_property_child_autoCreate',
          writable: true,
          expandable: true,
          writeThrough: true,
          inheritInstanceRoles: true,
          autoCreate: true
        }]
      }).execute()

      require('should')

      org.objects.c_ref_property_parent_autoCreate.insertOne({
        c_foo: 'ok'
      }).execute()

      String(org.objects.c_ref_property_parent_autoCreate.find().expand('c_child').next().c_child.owner._id).should.equal(script.principal._id.toString())

      let err
      try {
        org.objects.c_ref_property_child_autoCreate.insertOne({
          c_foo: 'ok'
        }).execute()

      } catch (e) {
        err = e
      }
      if (!err || err.code !== 'kAccessDenied') {
        throw new Error('create should fail with access denied.')
      }

      return true

    }))

  })

})
