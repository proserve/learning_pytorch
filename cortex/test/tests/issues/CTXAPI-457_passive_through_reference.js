'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-457 - Passive through reference readThrough', function() {

  before(sandboxed(function() {

    const { Objects } = org.objects

    Objects.insertOne({
      name: 'c_ctxapi_457_child',
      label: 'c_ctxapi_457_child',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [{
        label: 'c_string',
        name: 'c_string',
        type: 'String'
      }]
    }).execute()

    Objects.insertOne({
      name: 'c_ctxapi_457_parent',
      label: 'c_ctxapi_457_parent',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [{
        label: 'c_string',
        name: 'c_string',
        type: 'String'
      }, {
        label: 'c_ctxapi_457_child',
        name: 'c_ctxapi_457_child',
        type: 'Reference',
        expandable: true,
        sourceObject: 'c_ctxapi_457_child'
      }]
    }).execute()

    Objects.updateOne({
      name: 'c_ctxapi_457_parent'
    }, {
      $push: {
        properties: [{
          label: 'c_ctxapi_457_parents',
          name: 'c_ctxapi_457_parents',
          type: 'List',
          readThrough: true,
          sourceObject: 'c_ctxapi_457_parents'
        }]
      }
    }).execute()

  }))

  it('should be able read passively through a reference.', sandboxed(function() {

    /* global org */

    const { tryCatch } = require('util.values'),
          pathTo = require('util.paths.to'),
          { c_ctxapi_457_parent: Parent, c_ctxapi_457_child: Child } = org.objects,
          childId = Child.insertOne({ c_string: 'string' }).execute(),
          parentId = Parent.insertOne({ c_ctxapi_457_child: childId }).execute()

    tryCatch(
      () => Parent.readOne(parentId).paths('c_ctxapi_457_child.c_not_a_prop').execute(),
      err => {
        if (!(pathTo(err, 'errCode') === 'cortex.notFound.property')) {
          throw new Error('expecting property not found error')
        }
      }
    )

    Parent.readOne(parentId).passive().paths('c_ctxapi_457_child.c_not_a_prop').execute()

  }))

  it('should be able read passively through a reference using a prefix.', sandboxed(function() {

    const { tryCatch } = require('util.values'),
          pathTo = require('util.paths.to'),
          { c_ctxapi_457_parent: Parent, c_ctxapi_457_child: Child } = org.objects,
          childId = Child.insertOne({ c_string: 'child' }).execute(),
          parentId = Parent.insertOne({ c_string: 'parent', c_ctxapi_457_child: childId }).execute()

    tryCatch(
      () => Parent.find().prefix(`${parentId}.c_ctxapi_457_parents.${parentId}`).paths('c_ctxapi_457_child.c_not_a_prop').next(),
      err => {
        if (!(pathTo(err, 'errCode') === 'cortex.notFound.property')) {
          throw new Error('expecting property not found error')
        }
      }
    )

    Parent.find().prefix(`${parentId}.c_ctxapi_457_parents.${parentId}`).paths('c_ctxapi_457_child.c_string').next()
    Parent.find().prefix(`${parentId}.c_ctxapi_457_parents.${parentId}`).passive().paths('c_ctxapi_457_child.c_not_a_prop').next()

  }))

})
