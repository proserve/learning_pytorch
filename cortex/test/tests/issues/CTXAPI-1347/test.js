'use strict'

/* global before */

const sandboxed = require('../../../lib/sandboxed')

describe('1347 - _id in preMatch for List read/write through', function() {

  before(sandboxed(function() {

    /* global script, org */

    const { environment } = require('developer'),
          docs = [
            {
              label: 'c_ctxapi_1347_parent',
              name: 'c_ctxapi_1347_parent',
              object: 'object',
              uniqueKey: 'c_name',
              defaultAcl: 'account.public.read',
              properties: [{
                label: 'c_name',
                name: 'c_name',
                unique: true,
                indexed: true,
                type: 'String',
                validators: [{ name: 'customName' }]
              }, {
                label: 'c_children',
                name: 'c_children',
                type: 'ObjectId',
                array: true
              }, {
                label: 'c_list',
                name: 'c_list',
                type: 'List',
                skipAcl: true,
                grant: 'update',
                readThrough: true,
                writeThrough: true,
                where: '{ "_id": { "$in": {{{json input.c_children}}} } }',
                inheritPropertyAccess: true,
                sourceObject: 'c_ctxapi_1347_child'
              }]
            },
            {
              label: 'c_ctxapi_1347_child',
              name: 'c_ctxapi_1347_child',
              object: 'object',
              uniqueKey: 'c_name',
              properties: [{
                label: 'c_name',
                name: 'c_name',
                unique: true,
                indexed: true,
                type: 'String',
                validators: [{ name: 'customName' }]
              }, {
                label: 'c_value',
                name: 'c_value',
                type: 'Number',
                writable: true,
                removable: true
              }]
            },
            {
              object: 'c_ctxapi_1347_parent',
              c_name: 'c_ctxapi_1347_parent'
            },
            {
              object: 'c_ctxapi_1347_child',
              c_name: 'c_ctxapi_1347_child_1',
              c_value: 1
            },
            {
              object: 'c_ctxapi_1347_child',
              c_name: 'c_ctxapi_1347_child_2',
              c_value: 2
            },
          ]

    script.as(
      script.principal,
      {
        safe: false,
        principal: {
          grant: 'update',
          skipAcl: true,
          bypassCreateAcl: true
        }
      },
      () => {

        environment.import(docs, { backup: false, triggers: false }).toArray()

        const ids = org.objects.c_ctxapi_1347_child.find({ c_name: 'c_ctxapi_1347_child_1' }).paths('_id').toArray().map(v => v._id)

        org.objects.c_ctxapi_1347_parent.updateMany({
        }, {
          $set: {
            c_children: ids
          }
        }).execute()

      }
    )

  }))

  it('should list a single item through the list', sandboxed(function() {

    const should = require('should')

    should.equal(
      org.objects.c_ctxapi_1347_parent.find().paths('c_list').toArray().length,
      1
    )

  }))

  it('should read child that not filtered out', sandboxed(function() {

    const should = require('should'),
          result = org.objects.c_ctxapi_1347_parent.find({ c_name: 'c_ctxapi_1347_parent' }).pathRead('/c_list/c_ctxapi_1347_child_1')

    should.equal(
      result && result.c_name,
      'c_ctxapi_1347_child_1'
    )

  }))

  it('should not read child that is filtered out', sandboxed(function() {

    const should = require('should'),
      result = org.objects.c_ctxapi_1347_parent.find({ c_name: 'c_ctxapi_1347_parent' }).pathRead('/c_list/c_ctxapi_1347_child_2')


    should.equal(
      result,
      null
    )

  }))

  it('should read child that not filtered out', sandboxed(function() {

    const should = require('should'),
      _id = org.objects.c_ctxapi_1347_child.readOne({ c_name: 'c_ctxapi_1347_child_1' }).grant('read').execute()._id,
      result = org.objects.c_ctxapi_1347_parent.find({ c_name: 'c_ctxapi_1347_parent' }).pathRead(`/c_list/${_id}`)

    should.equal(
      result && result.c_name,
      'c_ctxapi_1347_child_1'
    )

  }))

  it('should not read child that is filtered out', sandboxed(function() {

    const should = require('should'),
      _id = org.objects.c_ctxapi_1347_child.readOne({ c_name: 'c_ctxapi_1347_child_2' }).grant('read').execute()._id,
      result = org.objects.c_ctxapi_1347_parent.find({ c_name: 'c_ctxapi_1347_parent' }).pathRead(`/c_list/${_id}`)

    should.equal(
      result,
      null
    )

  }))

  it('should update child that not filtered out', sandboxed(function() {

    const should = require('should'),
      { _id, c_value } = org.objects.c_ctxapi_1347_child.readOne({ c_name: 'c_ctxapi_1347_child_1' }).grant('read').execute()

     org.objects.c_ctxapi_1347_parent.updateOne({ c_name: 'c_ctxapi_1347_parent' }).pathUpdate(
        'c_list', [
          { _id, c_value: c_value + 1 }
        ]
      )


    should.equal(
      org.objects.c_ctxapi_1347_child.readOne({ c_name: 'c_ctxapi_1347_child_1' }).grant('read').execute().c_value,
      c_value + 1
    )

  }))

  it('should not update child that is filtered out', sandboxed(function() {

    const should = require('should'),
      { _id, c_value } = org.objects.c_ctxapi_1347_child.readOne({ c_name: 'c_ctxapi_1347_child_2' }).grant('read').execute()

    let err

    try {
      org.objects.c_ctxapi_1347_parent.updateOne({ c_name: 'c_ctxapi_1347_parent' }).pathUpdate(
        'c_list', [
          { _id, c_value: c_value + 1 }
        ]
      )
    } catch(e) {
      err = e
    }

    should.equal(
      err && err.errCode,
      'cortex.error.listWriteThrough'
    )

    should.equal(
      org.objects.c_ctxapi_1347_child.readOne({ c_name: 'c_ctxapi_1347_child_2' }).grant('read').execute().c_value,
      c_value
    )

  }))

  it('should remove child value that not filtered out', sandboxed(function() {

    const should = require('should'),
      { _id } = org.objects.c_ctxapi_1347_child.readOne({ c_name: 'c_ctxapi_1347_child_1' }).grant('read').execute()

    org.objects.c_ctxapi_1347_parent.updateOne({ c_name: 'c_ctxapi_1347_parent' }).pathDelete(`c_list.${_id}.c_value`)

    should.equal(
      org.objects.c_ctxapi_1347_child.readOne({ c_name: 'c_ctxapi_1347_child_1' }).grant('read').execute().c_value,
      null
    )

  }))

  it('should not remove child value that is filtered out', sandboxed(function() {

    const should = require('should'),
      { _id, c_value } = org.objects.c_ctxapi_1347_child.readOne({ c_name: 'c_ctxapi_1347_child_2' }).grant('read').execute()

    let err

    try {
      org.objects.c_ctxapi_1347_parent.updateOne({ c_name: 'c_ctxapi_1347_parent' }).pathDelete(`c_list.${_id}.c_value`)
    } catch(e) {
      err = e
    }

    should.equal(
      err && err.errCode,
      'cortex.notFound.instance'
    )

    should.equal(
      org.objects.c_ctxapi_1347_child.readOne({ c_name: 'c_ctxapi_1347_child_2' }).grant('read').execute().c_value,
      c_value
    )

  }))

})
