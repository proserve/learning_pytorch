'use strict'

/* global consts, org */

const sandboxed = require('../../lib/sandboxed')

describe('CTXAPI-T48', function() {

  describe('CTXAPI-T48 - Create a Custom Object', function() {

    after(sandboxed(function() {

      const Model = org.objects.c_cw_t48_create_object
      org.objects.objects.deleteOne({
        name: Model.name
      }).execute()
    }))

    it('should create a custom object', sandboxed(function() {

      const should = require('should'),
            _ = require('underscore'),
            Model = org.objects.c_cw_t48_create_object

      org.objects.Object.insertOne({
        label: Model.name,
        name: Model.name,
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'A', name: 'c_a', type: 'String', indexed: true },
          { label: 'B', name: 'c_b', type: 'Number', indexed: true }
        ]
      }).execute()

      let a,
          b,
          theObject = _.find(org.objects.objects.find().toArray(), o => o.name === 'c_cw_t48_create_object')

      should.exist(theObject)
      theObject.label.should.equal('c_cw_t48_create_object')
      theObject.properties.length.should.equal(2)

      a = _.find(theObject.properties, p => p.name === 'c_a')
      b = _.find(theObject.properties, p => p.name === 'c_b')

      should.exist(a)
      should.exist(b)
      a.label.should.equal('A')
      a.type.should.equal('String')
      a.indexed.should.equal(true)
      b.label.should.equal('B')
      b.type.should.equal('Number')
      b.indexed.should.equal(true)

    }))

  })

})
