'use strict'

/* global afterEach, before */

const sandboxed = require('../../lib/sandboxed')

describe('Features - Recreate operations from options', function() {

  before(sandboxed(function() {

    /* global org, consts */

    org.objects.objects.insertOne({
      label: 'CTXAPI-307',
      name: 'c_ctxapi_307',
      defaultAcl: ['owner.delete'],
      createAcl: ['account.public'],
      properties: [
        { name: 'c_string', label: 'A string', type: 'String', indexed: true },
        { name: 'c_number', label: 'Number', type: 'Number', indexed: true },
        { name: 'c_boolean', label: 'Boolean', type: 'Boolean', indexed: true },
        {
          name: 'c_doc_array',
          label: 'Document Array',
          type: 'Document',
          array: true,
          properties: [{
            name: 'c_string',
            label: 'String',
            type: 'String'
          }]
        }]
    }).execute()

    org.objects.objects.insertOne({
      label: 'CTXAPI-307 Public',
      name: 'c_ctxapi_307_public',
      defaultAcl: 'owner.public',
      createAcl: 'account.public',
      properties: [{
        name: 'c_string',
        label: 'A string',
        type: 'String',
        indexed: true,
        readAccess: consts.accessLevels.public
      }]
    }).execute()
  }))

  after(sandboxed(function() {
    org.objects.objects.deleteOne({
      name: 'c_ctxapi_307'
    }).execute()
  }))

  describe('Recreate operations from options', function() {

    afterEach(sandboxed(function() {
      const should = require('should')
      org.objects.c_ctxapi_307.deleteMany({}).execute()
      should.equal(org.objects.c_ctxapi_307.find().count(), 0)
    }))

    it('should recreate a cursor (find)', sandboxed(function() {

      /* global org */
      let cursor,
          instance

      const db = require('db'),
            should = require('should'),
            Model = org.objects.c_ctxapi_307,
            options = Model.find().getOptions()

      org.objects.c_ctxapi_307.insertOne({
        c_string: 'string',
        c_number: 4,
        c_boolean: true,
        c_doc_array: [{
          c_string: 'doc_string'
        }]
      }).execute()

      options.operation.should.equal('cursor')

      cursor = db.createOperation(options)
      cursor.getOptions().should.containDeep(options)
      should.equal(cursor.count(), 1)

      instance = cursor.next()
      instance.c_string.should.equal('string')
      instance.c_number.should.equal(4)
      instance.c_boolean.should.equal(true)
      instance.c_doc_array.length.should.equal(1)
      instance.c_doc_array[0].should.containDeep({ c_string: 'doc_string' })

    }))

    it('should recreate an insertOne operation', sandboxed(function() {

      /* global org */
      let insertOne,
          _id,
          instance

      const db = require('db'),
            should = require('should'),
            options = org.objects.c_ctxapi_307.insertOne({
              c_string: 'string',
              c_number: 4,
              c_boolean: true,
              c_doc_array: [{
                c_string: 'doc_string'
              }]
            }).getOptions()

      options.operation.should.equal('insertOne')
      options.object.should.equal('c_ctxapi_307')
      options.document.should.containDeep({
        c_string: 'string',
        c_number: 4,
        c_boolean: true,
        c_doc_array: [{
          c_string: 'doc_string'
        }]
      })

      insertOne = db.createOperation(options)
      insertOne.getOptions().should.containDeep(options)

      _id = insertOne.execute()

      should.equal(org.objects.c_ctxapi_307.find({ _id }).count(), 1)
      instance = org.objects.c_ctxapi_307.find({ _id }).next()
      instance.c_string.should.equal('string')
      instance.c_number.should.equal(4)
      instance.c_boolean.should.equal(true)
      instance.c_doc_array.length.should.equal(1)
      instance.c_doc_array[0].should.containDeep({ c_string: 'doc_string' })
    }))

    it('should recreate an insertMany operation', sandboxed(function() {

      /* global org */

      let insertMany,
          result,
          instances

      const should = require('should'),
            options = org.objects.c_ctxapi_307
              .insertMany([
                { c_string: 'test_insert_many1' },
                { c_string: 'test_insert_many2' },
                { c_string: 'test_insert_many3' },
                { c_string: 'test_insert_many4' }
              ])
              .getOptions(),
            db = require('db')

      options.operation.should.equal('insertMany')
      should.exist(options.documents)
      options.documents.length.should.equal(4)

      options.documents.map(d => d.c_string).should.containDeep(
        ['test_insert_many1',
          'test_insert_many2',
          'test_insert_many3',
          'test_insert_many4'])

      insertMany = db.createOperation(options)
      insertMany.getOptions().should.containDeep(options)
      result = insertMany.execute()
      result.insertedCount.should.equal(4)
      result.insertedIds.length.should.equal(4)

      instances = org.objects.c_ctxapi_307.find().toArray()
      instances.length.should.equal(4)

      instances[0].c_string.should.equal('test_insert_many1')
      instances[1].c_string.should.equal('test_insert_many2')
      instances[2].c_string.should.equal('test_insert_many3')
      instances[3].c_string.should.equal('test_insert_many4')
    }))

    it('should recreate a deleteOne operation', sandboxed(function() {

      /* global org */
      let instances,
          deleteOne,
          result

      org.objects.c_ctxapi_307
        .insertMany([
          { c_string: 'test_delete_one1' },
          { c_string: 'test_delete_one2' },
          { c_string: 'test_delete_one3' }
        ]).execute()

      const should = require('should'),
            options = org.objects.c_ctxapi_307.deleteOne({
              c_string: 'test_delete_one1'
            }).getOptions(),
            db = require('db')

      options.operation.should.equal('deleteOne')
      should.exist(options.match)
      should.exist(options.match.c_string)
      options.match.c_string.should.equal('test_delete_one1')

      deleteOne = db.createOperation(options)
      deleteOne.getOptions().should.containDeep(options)
      result = deleteOne.execute()
      result.should.equal(true)

      instances = org.objects.c_ctxapi_307.find().toArray()
      instances.length.should.equal(2)

      instances[0].c_string.should.equal('test_delete_one2')
      instances[1].c_string.should.equal('test_delete_one3')
    }))

    it('should recreate a deleteMany operation', sandboxed(function() {

      /* global org */
      let deleteMany,
          result,
          instances

      const should = require('should'),
            Model = org.objects.c_ctxapi_307,
            options = Model.deleteMany({
              $or: [
                { c_string: 'test_delete_many1' },
                { c_string: 'test_delete_many2' },
                { c_string: 'test_delete_many3' }
              ]
            }).getOptions(),
            db = require('db')

      Model
        .insertMany([
          { c_string: 'test_delete_many1' },
          { c_string: 'test_delete_many2' },
          { c_string: 'test_delete_many3' },
          { c_string: 'test_delete_many4' },
          { c_string: 'test_delete_many5' }
        ]).execute()

      options.operation.should.equal('deleteMany')
      should.exist(options.match)
      should.exist(options.match.$or)
      options.match.$or.map(or => or.c_string).should.containDeep([
        'test_delete_many1', 'test_delete_many2', 'test_delete_many3'])

      deleteMany = db.createOperation(options)
      deleteMany.getOptions().should.containDeep(options)

      result = deleteMany.execute()
      result.should.equal(3)

      instances = Model.find().toArray()
      instances.length.should.equal(2)
      instances[0].c_string.should.equal('test_delete_many4')
      instances[1].c_string.should.equal('test_delete_many5')
    }))

    it('should recreate a patchOne operation', sandboxed(function() {

      /* global org */
      require('should')
      let patchOne,
          result,
          instance

      const Model = org.objects.c_ctxapi_307,
            options = Model.patchOne({ c_string: 'stringA' }, {
              op: 'set',
              value: {
                c_number: 8,
                c_boolean: false,
                c_string: 'stringB',
                c_doc_array: [{
                  c_string: 'patched_doc'
                }]
              }
            }).getOptions(),
            db = require('db')

      Model.insertOne({
        c_number: 4,
        c_boolean: true,
        c_string: 'stringA',
        c_doc_array: [{
          c_string: 'first_doc'
        }, {
          c_string: 'second_doc'
        }]
      }).execute()

      options.object.should.equal('c_ctxapi_307')
      options.match.c_string.should.equal('stringA')
      options.operation.should.equal('patchOne')
      options.ops.should.containDeep({
        op: 'set',
        value: {
          c_boolean: false,
          c_doc_array: [
            {
              c_string: 'patched_doc'
            }
          ],
          c_number: 8,
          c_string: 'stringB'
        }
      })

      patchOne = db.createOperation(options)
      patchOne.getOptions().should.containDeep(options)

      result = patchOne.execute()

      instance = Model.find({ _id: result }).next()
      instance.should.containDeep({
        c_boolean: false,
        c_doc_array: [
          {
            c_string: 'patched_doc'
          }
        ],
        c_number: 8,
        c_string: 'stringB'
      })
    }))

    it('should recreate a patchMany operation', sandboxed(function() {

      /* global org */
      require('should')
      let patchMany,
          result,
          patchedInstances,
          nonPatchedInstances

      const Model = org.objects.c_ctxapi_307,
            options = Model.patchMany({ c_string: 'stringA' }, {
              op: 'set',
              value: {
                c_number: 8,
                c_boolean: false,
                c_string: 'stringB',
                c_doc_array: [{
                  c_string: 'patched_doc'
                }]
              }
            }).getOptions(),
            db = require('db')

      Model.insertMany([
        {
          c_number: 4,
          c_boolean: true,
          c_string: 'stringA',
          c_doc_array: [{
            c_string: 'first_doc'
          }, {
            c_string: 'second_doc'
          }]
        },
        {
          c_number: 1,
          c_boolean: false,
          c_string: 'stringA',
          c_doc_array: [{
            c_string: 'asdasdasd'
          }, {
            c_string: 'qweqweqwe'
          }]
        }, {
          c_number: 88,
          c_boolean: true,
          c_string: 'doesNotMatch',
          c_doc_array: [{
            c_string: 'documentA'
          }, {
            c_string: 'documentC'
          }]
        }
      ]).execute()

      options.object.should.equal('c_ctxapi_307')
      options.match.c_string.should.equal('stringA')
      options.operation.should.equal('patchMany')
      options.ops.should.containDeep({
        op: 'set',
        value: {
          c_boolean: false,
          c_doc_array: [
            {
              c_string: 'patched_doc'
            }
          ],
          c_number: 8,
          c_string: 'stringB'
        }
      })

      patchMany = db.createOperation(options)
      patchMany.getOptions().should.containDeep(options)

      result = patchMany.execute()
      result.matchedCount.should.equal(2)
      result.modifiedCount.should.equal(2)
      result.updatedIds.length.should.equal(2)
      result.writeErrors.length.should.equal(0)

      patchedInstances = Model.find({ c_string: 'stringB' }).toArray()
      patchedInstances.length.should.equal(2)
      patchedInstances.forEach(i => i.should.containDeep({
        c_boolean: false,
        c_doc_array: [
          {
            c_string: 'patched_doc'
          }
        ],
        c_number: 8,
        c_string: 'stringB'
      }))

      nonPatchedInstances = Model.find({ c_string: 'doesNotMatch' }).toArray()
      nonPatchedInstances.length.should.equal(1)
      nonPatchedInstances[0].should.containDeep({
        c_number: 88,
        c_boolean: true,
        c_string: 'doesNotMatch',
        c_doc_array: [{
          c_string: 'documentA'
        }, {
          c_string: 'documentC'
        }]
      })
    }))

    it('should recreate an updateOne operation', sandboxed(function() {

      /* global org */
      require('should')
      let updateOne,
          result,
          instance

      const Model = org.objects.c_ctxapi_307,
            options = Model.updateOne({ c_string: 'stringA' }, {
              $set: {
                c_number: 8,
                c_boolean: false,
                c_string: 'stringB',
                c_doc_array: [{
                  c_string: 'updated_doc'
                }]
              }
            }).getOptions(),
            db = require('db')

      Model.insertOne({
        c_number: 4,
        c_boolean: true,
        c_string: 'stringA',
        c_doc_array: [{
          c_string: 'first_doc'
        }, {
          c_string: 'second_doc'
        }]
      }).execute()

      options.object.should.equal('c_ctxapi_307')
      options.match.c_string.should.equal('stringA')
      options.operation.should.equal('updateOne')
      options.update.should.containDeep({
        $set: {
          c_boolean: false,
          c_doc_array: [
            {
              c_string: 'updated_doc'
            }
          ],
          c_number: 8,
          c_string: 'stringB'
        }
      })

      updateOne = db.createOperation(options)
      updateOne.getOptions().should.containDeep(options)

      result = updateOne.execute()

      instance = Model.find({ _id: result }).next()
      instance.should.containDeep({
        c_boolean: false,
        c_doc_array: [
          {
            c_string: 'updated_doc'
          }
        ],
        c_number: 8,
        c_string: 'stringB'
      })
    }))

    it('should recreate an updateMany operation', sandboxed(function() {

      /* global org */
      require('should')
      let updateMany,
          result,
          updatedInstances,
          nonUpdatedInstances

      const Model = org.objects.c_ctxapi_307,
            options = Model.updateMany({ c_string: 'stringA' }, {
              $set: {
                c_number: 8,
                c_boolean: false,
                c_string: 'stringB',
                c_doc_array: [{
                  c_string: 'updated_doc'
                }]
              }
            }).getOptions(),
            db = require('db')

      Model.insertMany([
        {
          c_number: 4,
          c_boolean: true,
          c_string: 'stringA',
          c_doc_array: [{
            c_string: 'first_doc'
          }, {
            c_string: 'second_doc'
          }]
        },
        {
          c_number: 1,
          c_boolean: false,
          c_string: 'stringA',
          c_doc_array: [{
            c_string: 'asdasdasd'
          }, {
            c_string: 'qweqweqwe'
          }]
        }, {
          c_number: 88,
          c_boolean: true,
          c_string: 'doesNotMatch',
          c_doc_array: [{
            c_string: 'documentA'
          }, {
            c_string: 'documentC'
          }]
        }
      ]).execute()

      options.object.should.equal('c_ctxapi_307')
      options.match.c_string.should.equal('stringA')
      options.operation.should.equal('updateMany')
      options.update.should.containDeep({
        $set: {
          c_boolean: false,
          c_doc_array: [
            {
              c_string: 'updated_doc'
            }
          ],
          c_number: 8,
          c_string: 'stringB'
        }
      })

      updateMany = db.createOperation(options)
      updateMany.getOptions().should.containDeep(options)

      result = updateMany.execute()
      result.matchedCount.should.equal(2)
      result.modifiedCount.should.equal(2)
      result.updatedIds.length.should.equal(2)
      result.writeErrors.length.should.equal(0)

      updatedInstances = Model.find({ c_string: 'stringB' }).toArray()
      updatedInstances.length.should.equal(2)
      updatedInstances.forEach(i => i.should.containDeep({
        c_boolean: false,
        c_doc_array: [
          {
            c_string: 'updated_doc'
          }
        ],
        c_number: 8,
        c_string: 'stringB'
      }))

      nonUpdatedInstances = Model.find({ c_string: 'doesNotMatch' }).toArray()
      nonUpdatedInstances.length.should.equal(1)
      nonUpdatedInstances[0].should.containDeep({
        c_number: 88,
        c_boolean: true,
        c_string: 'doesNotMatch',
        c_doc_array: [{
          c_string: 'documentA'
        }, {
          c_string: 'documentC'
        }]
      })
    }))

    it('should recreate a cursor (aggregation)', sandboxed(function() {

      /* global org */
      let cursor,
          result

      const db = require('db'),
            should = require('should'),
            Model = org.objects.c_ctxapi_307,
            options = Model
              .aggregate([
                {
                  $match: {
                    c_number: 4
                  }
                },
                {
                  $sort: {
                    c_string: -1
                  }
                },
                {
                  $limit: 1
                },
                {
                  $project: {
                    c_number: 1,
                    c_string: true,
                    c_boolean: 1,
                    c_the_string: {
                      $concat: [
                        { $string: 'The string is ' },
                        'c_string'
                      ]
                    }
                  }
                }
              ]).getOptions()

      Model.insertMany([
        {
          c_number: 4,
          c_boolean: true,
          c_string: 'stringA',
          c_doc_array: [{
            c_string: 'first_doc'
          }, {
            c_string: 'second_doc'
          }]
        },
        {
          c_number: 4,
          c_boolean: false,
          c_string: 'stringB',
          c_doc_array: [{
            c_string: 'This is'
          }, {
            c_string: 'it'
          }]
        }, {
          c_number: 88,
          c_boolean: true,
          c_string: 'stringC',
          c_doc_array: [{
            c_string: 'documentA'
          }, {
            c_string: 'documentC'
          }]
        }
      ]).execute()

      options.operation.should.equal('cursor')

      cursor = db.createOperation(options)
      cursor.getOptions().should.containDeep(options)

      result = cursor.toArray()
      result.length.should.equal(1)

      should.equal(result[0].c_boolean, false)
      should.equal(result[0].c_number, 4)
      should.equal(result[0].c_string, 'stringB')
      should.equal(result[0].c_the_string, 'The string is stringB')
    }))

    it('should recreate an insert with ACL options', sandboxed(function() {
      /* global org */
      require('should')
      let insertOne,
          id,
          instance

      const db = require('db'),
            Model = org.objects.c_ctxapi_307_public,
            options = Model.insertOne({
              c_string: 'string'
            }).skipAcl().grant('update').getOptions()

      options.operation.should.equal('insertOne')
      options.skipAcl.should.equal(true)
      options.grant.should.equal('update')

      insertOne = db.createOperation(options, options)
      insertOne.getOptions().should.containDeep(options)

      id = insertOne.execute()
      instance = org.objects.c_ctxapi_307_public.find({ _id: id }).next()
      instance.c_string.should.equal('string')
    }))
  })
})
