'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-291 - Path Delete ', function() {

  before(sandboxed(function() {

    /* global org */

    const { Objects } = org.objects

    Objects.insertOne({
      label: 'CTXAPI-291 Parent',
      name: 'c_ctxapi291_parent',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public'
    }).execute()

    Objects.insertOne({
      label: 'CTXAPI-291 Child',
      name: 'c_ctxapi291_child',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public'
    }).execute()

    Objects.updateOne({
      name: 'c_ctxapi291_child'
    }, {
      $push: {
        properties: [{
          label: 'Parent',
          name: 'c_parent',
          type: 'Reference',
          sourceObject: 'c_ctxapi291_parent',
          indexed: true
        }, {
          label: 'Property',
          name: 'c_property',
          type: 'Date',
          removable: true,
          indexed: true,
          history: true
        }]
      }
    }).execute()

    Objects.updateOne({
      name: 'c_ctxapi291_parent'
    }, {
      $push: {
        properties: [{
          label: 'Children',
          name: 'c_children',
          type: 'List',
          sourceObject: 'c_ctxapi291_child',
          linkedProperty: 'c_parent',
          readThrough: true,
          writeThrough: true
        }]
      }
    }).execute()

  }))

  it('insert a parent/child and remove a non-array, indexed data property from the child through the parent.', sandboxed(function() {

    /* global org */

    const should = require('should'),
          { c_ctxapi291_parent: Parent } = org.objects,
          parent = Parent.insertOne({
            c_children: [{
              c_property: new Date()
            }]
          }).lean(false).include('c_children').execute()

    Parent
      .updateOne({ _id: parent._id })
      .pathDelete(`c_children/${parent.c_children.data[0]._id}/c_property`)

    should.not.exist(
      Parent
        .readOne({ _id: parent._id })
        .include('c_children')
        .execute()
        .c_children.data[0].c_property
    )

  }))

})
