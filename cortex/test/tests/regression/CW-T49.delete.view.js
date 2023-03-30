'use strict'

/* global after, before, org, consts */

const sandboxed = require('../../lib/sandboxed')

describe('CW-T49 - Admin user should be able to delete a view', function() {

  describe('CW-T49 - Delete a View', function() {

    after(sandboxed(function() {

      const Model = org.objects.c_cw_t49_delete_view
      org.objects.objects.deleteOne({
        name: Model.name
      }).execute()
    }))

    before(sandboxed(function() {

      org.objects.objects.insertOne({
        label: 'c_cw_t49_delete_view',
        name: 'c_cw_t49_delete_view',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'A', name: 'c_a', type: 'String', indexed: true },
          { label: 'B', name: 'c_b', type: 'Number', indexed: true }
        ]
      }).execute()

      org.objects.views.insertOne({
        name: 'c_cw_t49_delete_view',
        label: 'Test View',
        description: 'A Simple Test View',
        active: false,
        sourceObject: 'c_cw_t49_delete_view'
      }).execute()

    }))

    it('should delete a view', sandboxed(function() {

      require('should')

      org.objects.views.deleteOne({
        name: 'c_cw_t49_delete_view'
      }).execute()

      let result = org.objects.views.find({ name: 'c_cw_t49_delete_view' }).count()
      result.should.equal(0)
    }))
  })
})
