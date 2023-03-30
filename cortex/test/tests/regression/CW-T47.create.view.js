'use strict'

/* global after, before, org, consts */

const sandboxed = require('../../lib/sandboxed')

describe('CW-T47 - Admin user should be able to create a view', function() {

  describe('CW-T47 - Create a View', function() {

    after(sandboxed(function() {

      const Model = org.objects.c_cw_t47_create_view
      org.objects.views.deleteOne({
        name: 'c_cw_t47_create_view'
      }).execute()
      org.objects.objects.deleteOne({
        name: Model.name
      }).execute()
    }))

    before(sandboxed(function() {
      org.objects.objects.insertOne({
        label: 'c_cw_t47_create_view',
        name: 'c_cw_t47_create_view',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'A', name: 'c_a', type: 'String', indexed: true },
          { label: 'B', name: 'c_b', type: 'Number', indexed: true }
        ]
      }).execute()
    }))

    it('should create a view', sandboxed(function() {

      const should = require('should')

      org.objects.views.insertOne({
        name: 'c_cw_t47_create_view',
        label: 'Test View',
        description: 'A Simple Test View',
        active: false,
        sourceObject: 'c_cw_t47_create_view'
      }).execute()

      let view = org.objects.views.find({ name: 'c_cw_t47_create_view' }).next()
      should.exist(view)

      view.name.should.equal('c_cw_t47_create_view')
      view.label.should.equal('Test View')
      view.description.should.equal('A Simple Test View')
      view.active.should.equal(false)
      view.sourceObject.should.equal('c_cw_t47_create_view')

    }))

  })

})
