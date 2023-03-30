'use strict'

/* global CortexObject, script, consts */

const sandboxed = require('../../lib/sandboxed')

describe('Properties', function() {

  describe('Lists', function() {

    before(sandboxed(function() {

      const Model = CortexObject.as('Object'),
            // create a child object that cannot be read or written.
            childId = Model.insertOne({
              name: 'c_linked_property_child',
              label: 'Child',
              hasETag: true,
              properties: [{
                label: 'Foo',
                name: 'c_foo',
                type: 'String'
              }]
            }).execute(),
            // create a parent object through which children will be created
            parentId = Model.insertOne({
              name: 'c_linked_property_parent',
              label: 'List Testing',
              defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
              createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
              hasETag: true,
              properties: [{
                label: 'Foo',
                name: 'c_foo',
                type: 'String'
              }]
            }).execute()

      // add the parent reference to the child
      Model.updateOne(childId, {
        $push: {
          properties: [{
            label: 'Parent',
            name: 'c_parent',
            type: 'Reference',
            sourceObject: 'c_linked_property_parent',
            indexed: true,
            writable: false,
            cascadeDelete: true,
            validators: [{
              name: 'required'
            }]
          }]
        }
      }).execute()

      // hook up the linked property
      Model.updateOne(parentId, {
        $push: {
          properties: [{
            label: 'Children',
            name: 'c_children',
            type: 'List',
            sourceObject: 'c_linked_property_child',
            linkedProperty: 'c_parent',
            defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
            createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
            readThrough: true,
            writeThrough: true,
            updateOnWriteThrough: true
          }]
        }
      }).execute()

    }))

    it('should create parent/child linked property instances and succeed with through ops', sandboxed(function() {

      require('should')

      const Parent = CortexObject.as('c_linked_property_parent'),
            Child = CortexObject.as('c_linked_property_child'),
            parentId = Parent.insertOne({}).execute()

      Parent.updateOne(parentId, {
        $set: {
          c_foo: 'bar'
        },
        $push: {
          c_children: [{
            c_foo: 'bar'
          }, {
            c_foo: 'baz'
          }]
        }
      }).execute()

      let parent = Parent.find({ _id: parentId }).paths('c_children.c_foo').next()

      Parent.updateOne(parentId, {
        $remove: {
          c_children: [parent.c_children.data[0]._id]
        },
        $push: {
          c_children: [{
            c_foo: 'more'
          }, {
            c_foo: 'kids!!!'
          }]
        }
      }).execute()

      Parent.find({ _id: parentId }).paths('c_children.c_foo').next().c_children.data.length.should.equal(3)
      Child.find().hasNext().should.equal(false)

      Parent.find().count().should.equal(1)
      Child.find().hasNext().should.equal(false)

      Child.find({ owner: script.principal._id }).skipAcl().count().should.equal(3)

    }))

    it('should fail to create standalone child instances', sandboxed(function() {

      require('should')

      const Parent = CortexObject.as('c_linked_property_parent'),
            Child = CortexObject.as('c_linked_property_child')

      try {

        Child.insertOne({
          c_parent: {
            _id: Parent.insertOne({ c_children: {} }).execute()
          }
        })
          .skipAcl()
          .bypassCreateAcl()
          .grant(8)
          .execute()

      } catch (err) {
        (err.errCode).should.equal('cortex.accessDenied.notWritable')
        return
      }
      throw new Error('Should have thrown')

    }))

    it('should fail to create standalone child instances', sandboxed(function() {

      require('should')

      const Child = CortexObject.as('c_linked_property_child')

      try {

        Child.insertOne({})
          .skipAcl()
          .bypassCreateAcl()
          .grant(8)
          .execute()

      } catch (err) {
        err.faults[0].errCode.should.equal('cortex.invalidArgument.required')
        return
      }
      throw new Error('Should have thrown')

    }))

    it('should fail to create standalone child instances', sandboxed(function() {
      require('should')
      const Child = CortexObject.as('c_linked_property_child')
      try {
        Child.insertOne({}).execute()
      } catch (err) {
        err.code.should.equal('kAccessDenied')
        return
      }
      throw new Error('Should have thrown')

    }))

    it('should fail to create update the parent reference', sandboxed(function() {

      require('should')

      const Parent = CortexObject.as('c_linked_property_parent'),
            Child = CortexObject.as('c_linked_property_child'),
            parent = Parent.find({ _id: Parent.insertOne({ c_children: {} }).execute() }).paths('c_children').next()

      try {
        Child.updateOne(
          parent.c_children.data[0]._id,
          {
            $set: {
              c_parent: Parent.insertOne({ c_children: {} }).execute()
            }
          })
          .skipAcl()
          .grant(8)
          .execute()
      } catch (err) {
        (err.errCode).should.equal('cortex.accessDenied.notWritable')
        return
      }
      throw new Error('Should have thrown')

    }))

    it('should update the Etag after write through.', sandboxed(function() {

      require('should')

      const Model = CortexObject.as('Object'),
            Parent = CortexObject.as('c_linked_property_parent'),
            parentObj = Model.find({ name: 'c_linked_property_parent' }).next(),
            parentInstance = Parent.find().include('c_children').next(),
            etag1 = Parent.find({ _id: parentInstance._id }).paths('ETag').next().ETag

      Model.updateOne(parentObj._id, {
        $set: {
          properties: {
            _id: parentObj.properties.filter(p => p.name === 'c_children')[0]._id,
            updateOnWriteThrough: true
          }
        }
      }).execute()

      Parent.updateOne(parentInstance._id, {
        $set: {
          c_children: [{
            _id: parentInstance.c_children.data[0]._id,
            c_foo: 'uno dos tres'
          }]
        }
      }).execute()

      let etag2 = Parent.find({ _id: parentInstance._id }).paths('ETag').next().ETag

      etag1.should.not.equal(etag2)

    }))

    it('should not update the Etag after write through.', sandboxed(function() {

      require('should')

      const Model = CortexObject.as('Object'),
            Parent = CortexObject.as('c_linked_property_parent'),
            parentObj = Model.find({ name: 'c_linked_property_parent' }).next(),
            parentInstance = Parent.find().include('c_children').next(),
            etag1 = Parent.find({ _id: parentInstance._id }).paths('ETag').next().ETag

      Model.updateOne(parentObj._id, {
        $set: {
          properties: {
            _id: parentObj.properties.filter(p => p.name === 'c_children')[0]._id,
            updateOnWriteThrough: false
          }
        }
      }).execute()

      Parent.updateOne(parentInstance._id, {
        $set: {
          c_children: [{
            _id: parentInstance.c_children.data[0]._id,
            c_foo: 'what what whaaaaaat'
          }]
        }
      }).execute()

      let etag2 = Parent.find({ _id: parentInstance._id }).paths('ETag').next().ETag

      etag1.should.equal(etag2)

    }))

    it('should cascade delete child instances', sandboxed(function() {

      require('should')

      const Parent = CortexObject.as('c_linked_property_parent'),
            Child = CortexObject.as('c_linked_property_child'),
            parentId = Parent.insertOne({}).execute()

      Parent.updateOne(parentId, {
        $push: {
          c_children: [{}, {}]
        }
      }).execute()

      Child.find({ c_parent: parentId }).skipAcl().count().should.equal(2)

      Parent.deleteOne(parentId).execute()

      require('debug').sleep(1000) // in testing the cascade deleter runs much faster.

      Child.find({ c_parent: parentId }).skipAcl().count().should.equal(0)

    })).timeout(5000)

  })

})
