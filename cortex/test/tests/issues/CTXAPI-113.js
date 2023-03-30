'use strict'

/* global before */

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('CTXAPI-113 - list principal resolution', function() {

    /**
     * Create roles in advance so the next script will include them in consts.
     */
    before(sandboxed(function() {

      /* global org */

      org.push(
        'roles',
        [
          { name: 'c_ctxapi_113_a2cRole' }
        ]
      )

    }))

    /**
     * Create a parent -> child -> grandchild scenario with various acl and role inheritance.
     *
     * A -> B (list) -> C (list)
     *
     * A -> B (list) -> C (ref) -> D (list)
     * B -> C (list), D (ref)
     * C -> E (list), F (ref)
     * D -> C (ref), E (list)
     * E
     *
     */
    before(sandboxed(function() {

      /* global org, consts */

      const Model = org.objects.object

      Model.insertMany([{
        name: 'c_ctxapi_113_a',
        label: 'c_ctxapi_113_a',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }]
      }, {
        name: 'c_ctxapi_113_b',
        label: 'c_ctxapi_113_b'
      }, {
        name: 'c_ctxapi_113_c',
        label: 'c_ctxapi_113_c'
      }]).execute()

      // hard link creation --------------------------------------------------------------------------------------------

      Model.updateOne({ name: 'c_ctxapi_113_c' }, { $push: { properties: [{
        name: 'c_property',
        label: 'c_property',
        type: 'String'
      }, {
        name: 'c_parent',
        label: 'c_parent',
        type: 'Reference',
        expandable: true,
        indexed: true,
        sourceObject: 'c_ctxapi_113_b',
        writable: false,
        cascadeDelete: true,
        // this allows use to read a -> c -> b, but will not allow a -> b -> c -> b
        inheritInstanceRoles: true,
        defaultAcl: [{ target: consts.roles.c_ctxapi_113_a2cRole, type: consts.accessTargets.role, allow: consts.accessLevels.read }]
      }, {
        name: 'c_grand_parent',
        label: 'c_grand_parent',
        type: 'Reference',
        expandable: true,
        indexed: true,
        sourceObject: 'c_ctxapi_113_a',
        writable: false,
        cascadeDelete: true
      }] } }
      ).execute()

      Model.updateOne({ name: 'c_ctxapi_113_b' }, { $push: { properties: [{
        name: 'c_property',
        label: 'c_property',
        type: 'String'
      }, {
        name: 'c_parent',
        label: 'c_parent',
        type: 'Reference',
        expandable: true,
        indexed: true,
        sourceObject: 'c_ctxapi_113_a',
        writable: false,
        cascadeDelete: true
      }, {
        name: 'c_children',
        label: 'c_children',
        type: 'List',
        sourceObject: 'c_ctxapi_113_c',
        readThrough: true,
        writeThrough: true,
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        linkedReferences: [{
          source: '_id',
          target: 'c_parent'
        }, {
          source: 'c_parent',
          target: 'c_grand_parent'
        }]
      }] } }
      ).execute()

      Model.updateOne({ name: 'c_ctxapi_113_a' }, { $push: { properties: [{
        name: 'c_property',
        label: 'c_property',
        type: 'String'
      }, {
        name: 'c_children',
        label: 'c_children',
        type: 'List',
        sourceObject: 'c_ctxapi_113_b',
        readThrough: true,
        writeThrough: true,
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        linkedReferences: [{
          source: '_id',
          target: 'c_parent'
        }]
      }] } }
      ).execute()

      // soft link properties for access testing -----------------------------------------------------------------------

      Model.updateOne({ name: 'c_ctxapi_113_a' }, { $push: { properties: [{
        name: 'c_grand_children',
        label: 'c_grand_children',
        type: 'List',
        sourceObject: 'c_ctxapi_113_c',
        readThrough: true,
        // this role is applied above to c_ctxapi_113_c.c_parent so, reading through here will allow us to see it.
        roles: [consts.roles.c_ctxapi_113_a2cRole],
        defaultAcl: [{ target: consts.roles.c_ctxapi_113_a2cRole, type: consts.accessTargets.role, allow: consts.accessLevels.read }],
        linkedReferences: [{
          source: '_id',
          target: 'c_grand_parent'
        }]
      }] } }).execute()

      // insert test subject
      org.objects.c_ctxapi_113_a.insertOne({
        c_children: [{
          c_children: [{
            c_property: 'a0 -> b0 -> c0'
          }, {
            c_property: 'a0 -> b0 -> c1'
          }]
        }, {
          c_children: [{
            c_property: 'a0 -> b1 -> c0'
          }, {
            c_property: 'a0 -> b1 -> c1'
          }]
        }]
      }).execute()

    }))

    it('access context cases', sandboxed(function() {

      /* global org, consts */

      require('should')

      const Model = org.objects.c_ctxapi_113_a,
            tree = org.objects.c_ctxapi_113_a.find().include('c_children', 'c_grand_children', 'c_children.c_children').next()

      // top level basics tests
      Model.getAccessContext().resolved.should.equal(consts.accessLevels.delete)
      Model.getAccessContext([{}]).resolved.should.equal(consts.accessLevels.delete)
      Model.getAccessContext('{}').resolved.should.equal(consts.accessLevels.delete)
      Model.getAccessContext([{ owner: consts.emptyId }]).resolved.should.equal(0)
      Model.getAccessContext([{ owner: consts.emptyId }]).resolved.should.equal(0)

      // nested lists and references
      Model.getAccessContext([tree._id, 'c_children', tree.c_children.data[0]._id, 'c_children']).resolved.should.equal(consts.accessLevels.delete)
      Model.getAccessContext([tree._id, 'c_children', tree.c_children.data[0]._id, 'c_children', tree.c_children.data[0].c_children.data[0]]).resolved.should.equal(consts.accessLevels.delete)

      // test that the instance instance role is applied
      Model.getAccessContext('c_grand_children.c_parent').instanceRoles.toString().should.equal([consts.roles.c_ctxapi_113_a2cRole].toString())
      Model.getAccessContext([tree._id, 'c_grand_children', tree.c_grand_children.data[0]._id, 'c_parent'])
        .instanceRoles.toString().should.equal([consts.roles.c_ctxapi_113_a2cRole].toString())

    }))

  })

})
