'use strict'

/* global org, before, after */

const sandboxed = require('../../lib/sandboxed'),
      should = require('should'),
      _ = require('underscore'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-382 - Faults within list write through operations', function() {

  before(sandboxed(function() {
    org.objects.objects.insertOne({
      label: 'CTXAPI-382 Child',
      name: 'c_ctxapi_382_child',
      defaultAcl: 'role.administrator.delete',
      createAcl: 'account.public',
      properties: [{
        label: 'Name',
        name: 'c_name',
        type: 'String',
        indexed: true,
        validators: [{
          name: 'required'
        }]
      }, {
        label: 'Number',
        name: 'c_number',
        type: 'Number',
        indexed: true,
        removable: true
      }]
    }).execute()

    org.objects.objects.insertOne({
      label: 'CTXAPI-382',
      name: 'c_ctxapi_382_parent',
      defaultAcl: 'role.administrator.delete',
      createAcl: 'account.public',
      properties: [{
        label: 'Name',
        name: 'c_name',
        type: 'String',
        indexed: true
      }, {
        label: 'Children List',
        name: 'c_list',
        type: 'List',
        sourceObject: 'c_ctxapi_382_child',
        readThrough: true,
        writeThrough: true
      }]
    }).execute()
  }))

  after(sandboxed(function() {
    org.objects.c_ctxapi_382_child.deleteMany().execute()
    org.objects.c_ctxapi_382_parent.deleteMany().execute()
    org.objects.objects.deleteMany({ name: 'c_ctxapi_382_parent' }).execute()
    org.objects.objects.deleteMany({ name: 'c_ctxapi_382_child' }).execute()
  }))

  it('should fail and show the correct index', async function() {
    let result, error, faults

    try {

      result = await promised(null, sandboxed(function() {
        let parentId, children
        parentId = org.objects.c_ctxapi_382_parent.insertOne({ c_name: 'The name is Bond' }).execute()

        children = org.objects.c_ctxapi_382_child.insertMany([
          { c_name: 'Robert' },
          { c_name: 'John Paul' },
          { c_name: 'Bonzo' },
          { c_name: 'Jimmy' }
        ]).execute()

        parentId = org.objects.c_ctxapi_382_parent.updateOne({ _id: parentId })
          .pathUpdate(
            `c_list`,
            [
              { _id: children.insertedIds[0]._id, c_name: 'Rob' },
              { _id: children.insertedIds[2]._id, c_name: 'Johnny', c_age: 35 },
              { c_name: 'John' },
              { c_na: 'Paul' },
              {},
              { c_name: 'George' },
              { c_number: 5 }
            ]
          )

        return org.objects.c_ctxapi_382_parent.find({ _id: parentId }).include('c_list').next()
      }))
    } catch (e) {
      error = e
    }

    should.not.exist(result)
    should.exist(error)

    error.errCode.should.equal('cortex.error.listWriteThrough')
    error.statusCode.should.equal(500)
    error.name.should.equal('db')
    error.path.should.equal('c_list')
    error.faults.length.should.equal(4)

    faults = _.sortBy(error.faults, f => f.index)

    faults[0].errCode.should.equal('cortex.notFound.property')
    faults[0].statusCode.should.equal(404)
    faults[0].path.should.equal('c_age')
    faults[0].name.should.equal('db')
    faults[0].index.should.equal(1)

    faults[1].errCode.should.equal('cortex.notFound.property')
    faults[1].statusCode.should.equal(404)
    faults[1].path.should.equal('c_na')
    faults[1].name.should.equal('db')
    faults[1].index.should.equal(3)

    faults[2].errCode.should.equal('cortex.invalidArgument.validation')
    faults[2].statusCode.should.equal(400)
    faults[2].name.should.equal('error')
    faults[2].index.should.equal(4)

    faults[3].errCode.should.equal('cortex.invalidArgument.validation')
    faults[3].statusCode.should.equal(400)
    faults[3].name.should.equal('error')
    faults[3].index.should.equal(6)
  })
})
