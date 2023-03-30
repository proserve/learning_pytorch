'use strict'

const consts = require('../../../lib/consts'),
      sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('525 - inheritPropertyAccess for References', function() {

    it('auto-create test', sandboxed(function() {

      /* global CortexObject */

      const ObjectModel = CortexObject.as('Object'),
            Parent = CortexObject.as('c_Issue525_parent')

      ObjectModel.insertOne({
        name: 'c_Issue525_child',
        label: 'Child',
        hasETag: true,
        defaultAcl: [], // no default access to the child at all.
        properties: [{
          label: 'Foo',
          name: 'c_foo',
          type: 'String'
        }]
      }).execute()

      ObjectModel.insertOne({
        name: 'c_Issue525_parent',
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
          sourceObject: 'c_Issue525_child',
          writable: true,
          expandable: true,
          writeThrough: true,
          inheritInstanceRoles: true,
          inheritPropertyAccess: true,
          autoCreate: true
        }]
      }).execute()

      require('should')

      Parent.insertOne({
        c_foo: 'ok'
      }).execute()

      Parent.find().expand('c_child').next().c_child.access.should.equal(consts.accessLevels.delete)

      return true

    }))

  })

})
