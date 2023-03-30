'use strict'

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Features - CTXAPI-600 - Add path to list property result object', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      const childName = 'c_ctxapi_600_child',
            parentName = 'c_ctxapi_600_parent',
            grandParentName = 'c_ctxapi_600_grand_parent',
            {
              objects: Objects
            } = org.objects

      if (Objects.find({ name: childName }).count() === 0) {
        Objects.insertOne({
          label: 'Child',
          name: childName,
          defaultAcl: 'role.administrator.delete',
          createAcl: 'account.public',
          uniqueKey: 'c_key',
          properties: [
            {
              name: 'c_string',
              label: 'A string',
              type: 'String',
              indexed: true
            }, {
              name: 'c_key',
              label: 'Key',
              type: 'UUID',
              autoGenerate: true,
              indexed: true,
              writable: true,
              unique: true,
              uuidVersion: 4
            }
          ]
        }).execute()
      }

      if (Objects.find({ name: parentName }).count() === 0) {

        Objects.insertOne({
          label: 'Parent',
          name: parentName,
          defaultAcl: 'role.administrator.delete',
          createAcl: 'account.public',
          properties: [
            {
              name: 'c_string',
              label: 'A string',
              type: 'String',
              indexed: true
            }, {
              label: 'c_child',
              name: 'c_child',
              type: 'List',
              readThrough: true,
              writeThrough: true,
              sourceObject: childName
            }]
        }).execute()
      }

      if (Objects.find({ name: grandParentName }).count() === 0) {

        Objects.insertOne({
          label: 'Grand Parent',
          name: grandParentName,
          defaultAcl: 'role.administrator.delete',
          createAcl: 'account.public',
          properties: [
            {
              name: 'c_string',
              label: 'A string',
              type: 'String',
              indexed: true
            }, {
              label: 'Parent object',
              name: 'c_child',
              type: 'List',
              readThrough: true,
              writeThrough: true,
              sourceObject: parentName
            }]
        }).execute()
      }

    }))
  })

  afterEach(sandboxed(function() {

    const childName = 'c_ctxapi_600_child',
          parentName = 'c_ctxapi_600_parent',
          grandParentName = 'c_ctxapi_600_grand_parent',
          {
            objects: Objects
          } = org.objects
    Objects.deleteMany({ name: grandParentName }).execute()
    Objects.deleteMany({ name: parentName }).execute()
    Objects.deleteMany({ name: childName }).execute()

  }))

  after(sandboxed(function() {

    org.objects.objects.deleteMany({ name: 'c_ctxapi_600_grand_parent' }).execute()
    org.objects.objects.deleteMany({ name: 'c_ctxapi_600_parent' }).execute()
    org.objects.objects.deleteMany({ name: 'c_ctxapi_600_child' }).execute()

  }))

  it('should have a new path property returned', async function() {
    let result
    result = await promised(null, sandboxed(function() {
      let resultObject, grandParent, parent
      const childName = 'c_ctxapi_600_child',
            parentName = 'c_ctxapi_600_parent',
            grandParentName = 'c_ctxapi_600_grand_parent',
            {
              [childName]: ChildModel,
              [parentName]: ParentModel,
              [grandParentName]: GPModel
            } = org.objects

      GPModel.insertMany([
        { c_string: 'Grand Parent 1' },
        { c_string: 'Grand Parent 2' },
        { c_string: 'Grand Parent 3' }
      ]).execute()

      ChildModel.insertMany([
        { c_string: 'Child 1' },
        { c_string: 'Child 2' },
        { c_string: 'Child 3' }
      ]).execute()

      parent = ParentModel.insertOne({ c_string: 'Parent' }).execute().toString()
      grandParent = GPModel.insertOne({ c_string: 'Grand Parent' }).execute().toString()
      resultObject = GPModel.find().pathRead(`${grandParent}/c_child/${parent}/c_child`)
      return { parent, grandParent, resultObject }
    }))

    should.exist(result.resultObject)
    should.equal(result.resultObject.object, 'list')
    should.not.exist(result.resultObject.errCode)
    should.exist(result.resultObject.path)
    should.equal(result.resultObject.path, `/c_ctxapi_600_grand_parents/${result.grandParent}/c_child/${result.parent}/c_child`)
    should.equal(result.resultObject.data[0].c_string, 'Child 1')
    should.equal(result.resultObject.data[1].c_string, 'Child 2')
    should.equal(result.resultObject.data[2].c_string, 'Child 3')

    // Test for GET request to path generated.
    const resultGet = await server.sessions.admin
      .get(server.makeEndpoint(result.resultObject.path))
      .set(server.getSessionHeaders()).then()

    should.equal(resultGet.statusCode, 200)
    should.exist(resultGet.body)
    should.equal(resultGet.body.object, 'list')
    should.equal(resultGet.body.path, `/c_ctxapi_600_grand_parents/${result.grandParent}/c_child/${result.parent}/c_child`)
    should.equal(resultGet.body.data[0].c_string, 'Child 1')
    should.equal(resultGet.body.data[1].c_string, 'Child 2')
    should.equal(resultGet.body.data[2].c_string, 'Child 3')

  })

})
