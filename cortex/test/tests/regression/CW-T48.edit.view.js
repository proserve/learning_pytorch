'use strict'

/* global after, before, consts, org */

const sandboxed = require('../../lib/sandboxed')

describe('CW-T48 - Admin user should be able to edit a view', function() {

  describe('CW-T48 - Edit a View', function() {

    after(sandboxed(function() {

      const Model = org.objects.c_cw_t48_edit_view
      org.objects.views.deleteOne({
        name: 'c_cw_t48_edit_view_edited'
      }).execute()
      org.objects.objects.deleteOne({
        name: Model.name
      }).execute()
    }))

    before(sandboxed(function() {

      org.objects.objects.insertOne({
        label: 'c_cw_t48_edit_view',
        name: 'c_cw_t48_edit_view',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'A', name: 'c_a', type: 'String', indexed: true },
          { label: 'B', name: 'c_b', type: 'Number', indexed: true }
        ]
      }).execute()

      org.objects.views.insertOne({
        name: 'c_cw_t48_edit_view',
        label: 'Test View',
        description: 'A Simple Test View',
        active: false,
        sourceObject: 'c_cw_t48_edit_view'
      }).execute()

    }))

    it('should edit a view', sandboxed(function() {

      const should = require('should')

      org.objects.views.updateOne({
        name: 'c_cw_t48_edit_view'
      }, {
        $set: {
          name: 'c_cw_t48_edit_view_edited',
          label: 'Test View Edited',
          description: 'I have just edited this description'
        }
      }).execute()

      let view = org.objects.views.find({ name: 'c_cw_t48_edit_view_edited' }).next()
      should.exist(view)

      view.name.should.equal('c_cw_t48_edit_view_edited')
      view.label.should.equal('Test View Edited')
      view.description.should.equal('I have just edited this description')
      view.active.should.equal(false)
      view.sourceObject.should.equal('c_cw_t48_edit_view')

    }))

  })

})
