'use strict'

/* global org, script */

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('CTXAPI-492 - Sandbox readOne operation expand function', function() {

  before(sandboxed(function() {

    org.objects.objects.insertOne({
      name: 'c_ctxapi_492_child',
      label: 'CTXAPI-492 Child Object',
      defaultAcl: 'role.administrator.delete',
      createAcl: 'account.public',
      properties: [{
        name: 'c_string',
        label: 'String',
        type: 'String',
        indexed: true,
        removable: false
      }, {
        name: 'c_label',
        label: 'Label',
        type: 'String',
        indexed: true,
        removable: false
      }, {
        name: 'c_number',
        label: 'Number',
        type: 'Number',
        indexed: true,
        removable: true
      }]
    }).execute()

    org.objects.objects.insertOne({
      name: 'c_ctxapi_492_father',
      label: 'CTXAPI-492 Parent Object',
      defaultAcl: 'role.administrator.delete',
      createAcl: 'account.public',
      properties: [{
        name: 'c_child',
        label: 'Child ref',
        type: 'Reference',
        sourceObject: 'c_ctxapi_492_child',
        writeThrough: true,
        expandable: true
      }, {
        name: 'c_name',
        label: 'Name',
        type: 'String',
        indexed: true,
        removable: true
      }]
    }).execute()

    org.objects.objects.insertOne({
      name: 'c_ctxapi_492_grand_father',
      label: 'CTXAPI-492 Grandfather',
      defaultAcl: 'role.administrator.delete',
      createAcl: 'account.public',
      properties: [{
        label: 'Father ref',
        name: 'c_father',
        type: 'Reference',
        sourceObject: 'c_ctxapi_492_father',
        writeThrough: true,
        expandable: true
      }, {
        label: 'Grand son ref',
        name: 'c_grand_son',
        type: 'Reference',
        sourceObject: 'c_ctxapi_492_child',
        writeThrough: true,
        expandable: false
      }]
    }).execute()

  }))

  after(sandboxed(function() {
    require('should')
    org.objects.objects.deleteOne({ name: 'c_ctxapi_492_grand_father' }).execute().should.equal(true)
    org.objects.objects.deleteOne({ name: 'c_ctxapi_492_father' }).execute().should.equal(true)
    org.objects.objects.deleteOne({ name: 'c_ctxapi_492_child' }).execute().should.equal(true)
  }))

  afterEach(sandboxed(function() {
    org.objects.c_ctxapi_492_grand_father.deleteMany().execute()
    org.objects.c_ctxapi_492_father.deleteMany().execute()
    org.objects.c_ctxapi_492_child.deleteMany().execute()
  }))

  it('should readOne and expand a child object Reference', async function() {
    let response

    response = await promised(null, sandboxed(function() {
      let fatherId, childId

      childId = org.objects.c_ctxapi_492_child.insertOne({
        c_string: 'Child string',
        c_label: 'Child label',
        c_number: 42
      }).execute()

      fatherId = org.objects.c_ctxapi_492_father.insertOne({
        c_child: childId
      }).execute()

      script.exit(
        org.objects.c_ctxapi_492_father.readOne({ _id: fatherId }).expand('c_child').execute()
      )
    }))

    should.exist(response)
    should.not.exist(response.errCode)
    should.equal(response.object, 'c_ctxapi_492_father')
    should.equal(response.c_child.c_string, 'Child string')
    should.equal(response.c_child.c_label, 'Child label')
    should.equal(response.c_child.c_number, 42)

  })

  it('should readOne and expand a reference within the reference', async function() {
    let response

    response = await promised(null, sandboxed(function() {
      let grandfatherId, fatherId, childId

      childId = org.objects.c_ctxapi_492_child.insertOne({
        c_string: 'Child string 2',
        c_label: 'Child label 2',
        c_number: 1612
      }).execute()

      fatherId = org.objects.c_ctxapi_492_father.insertOne({
        c_child: childId,
        c_name: 'I am the father'
      }).execute()

      grandfatherId = org.objects.c_ctxapi_492_grand_father.insertOne({
        c_father: fatherId
      }).execute()

      script.exit(
        org.objects.c_ctxapi_492_grand_father.readOne({ _id: grandfatherId }).expand('c_father.c_child').execute()
      )
    }))

    should.exist(response)
    should.not.exist(response.errCode)
    should.equal(response.object, 'c_ctxapi_492_grand_father')
    should.equal(response.c_father.c_name, 'I am the father')
    should.equal(response.c_father.c_child.c_string, 'Child string 2')
    should.equal(response.c_father.c_child.c_label, 'Child label 2')
    should.equal(response.c_father.c_child.c_number, 1612)
  })

  it('should not expand when prop is not expandable', async function() {
    let response, error

    try {
      response = await promised(null, sandboxed(function() {
        let grandfatherId, fatherId, childId

        childId = org.objects.c_ctxapi_492_child.insertOne({
          c_string: 'Child string 2',
          c_label: 'Child label 2',
          c_number: 1612
        }).execute()

        fatherId = org.objects.c_ctxapi_492_father.insertOne({
          c_child: childId,
          c_name: 'I am the father'
        }).execute()

        grandfatherId = org.objects.c_ctxapi_492_grand_father.insertOne({
          c_father: fatherId,
          c_grand_son: childId
        }).execute()

        script.exit(
          org.objects.c_ctxapi_492_grand_father.readOne({ _id: grandfatherId }).expand('c_grand_son').execute()
        )
      }))
    } catch (e) {
      error = e
    }

    should.not.exist(response)
    should.exist(error)
    should.equal(error.errCode, 'cortex.invalidArgument.illegalExpansion')
    should.equal(error.code, 'kIllegalExpansion')
    should.equal(error.statusCode, 400)
    should.equal(error.name, 'error')
    should.equal(error.path, 'c_grand_son')
    should.equal(error.reason, 'Expansion not allowed for path: c_grand_son.[]')

  })

})
