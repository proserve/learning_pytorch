'use strict'

/* global afterEach, before */

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      { promised } = require('../../../lib/utils'),
      should = require('should'),
      cleanInstances = function() {
        const should = require('should')
        org.objects.c_ctxapi_213.deleteMany({}).execute()
        org.objects.c_ctxapi_213_father.deleteMany({}).execute()
        org.objects.c_ctxapi_213_public.deleteMany({}).skipAcl().grant('delete').execute()

        should.equal(org.objects.c_ctxapi_213.find().count(), 0)
        should.equal(org.objects.c_ctxapi_213_father.find().count(), 0)
        should.equal(org.objects.c_ctxapi_213_public.find().skipAcl().grant('read').count(), 0)
      }

describe('Features - Bulk operations', function() {

  before(sandboxed(function() {

    /* global consts, org */

    org.objects.objects.insertOne({
      label: 'CTXAPI-213',
      name: 'c_ctxapi_213',
      defaultAcl: ['owner.delete'],
      createAcl: ['account.public'],
      properties: [
        { name: 'c_string', label: 'A string', type: 'String', indexed: true },
        { name: 'c_number', label: 'Number', type: 'Number', indexed: true },
        { name: 'c_boolean', label: 'Boolean', type: 'Boolean', indexed: true },
        { name: 'c_string_b', label: 'Another string', type: 'String', removable: true },
        { name: 'c_string_array', label: 'String Array', type: 'String', array: true },
        { name: 'c_boolean_array', label: 'Boolean Array', type: 'Boolean', array: true },
        { name: 'c_number_array', label: 'Number Array', type: 'Number', array: true },
        { name: 'c_doc_array',
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
      label: 'CTXAPI-213 Father',
      name: 'c_ctxapi_213_father',
      defaultAcl: ['owner.delete'],
      createAcl: ['account.public'],
      properties: [{
        name: 'c_reference',
        label: 'Reference',
        type: 'Reference',
        expandable: true,
        writeThrough: true,
        sourceObject: 'c_ctxapi_213'
      }]
    }).execute()

    org.objects.objects.insertOne({
      label: 'CTXAPI-213 Public',
      name: 'c_ctxapi_213_public',
      defaultAcl: ['owner.public'],
      createAcl: ['account.public'],
      properties: [{
        label: 'Public',
        name: 'c_public',
        type: 'String',
        indexed: true,
        readAccess: consts.accessLevels.public
      }, {
        label: 'Connected',
        name: 'c_connected',
        type: 'String',
        indexed: true,
        readAccess: consts.accessLevels.connected
      }]
    }).execute()

  }))

  after(sandboxed(function() {
    const should = require('should')

    org.objects.objects.deleteOne({ name: 'c_ctxapi_213_public' }).skipAcl().grant('delete').execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_213_father' }).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_213' }).execute()
    org.objects.accounts.deleteOne({ email: 'ctxapi213+admin@medable.com' }).skipAcl().grant('script').execute()

    should.equal(org.objects.objects.find({ name: 'c_ctxapi_213_public' }).count(), 0)
    should.equal(org.objects.objects.find({ name: 'c_ctxapi_213_father' }).count(), 0)
    should.equal(org.objects.objects.find({ name: 'c_ctxapi_213' }).count(), 0)
  }))

  describe('HTTP Driver Interface', function() {

    afterEach(sandboxed(cleanInstances))

    it('should insert many, delete one, update one and find it', async() => {

      let ops, response, instances

      ops = await promised(null, sandboxed(function() {

        /* global org */

        const insertManyOp = {
                ...org.objects.c_ctxapi_213.insertMany([{
                  c_number: 4,
                  c_boolean: true,
                  c_string: 'stringA',
                  c_string_b: 'stringB',
                  c_string_array: ['first', 'second'],
                  c_boolean_array: [true, false, true],
                  c_number_array: [1, 9, 8, 55],
                  c_doc_array: [{
                    c_string: 'first_doc'
                  }, {
                    c_string: 'second_doc'
                  }]
                }, { c_string: 'deleteMe' }]).getOptions(),
                name: 'Insert two',
                halt: true,
                wrap: true,
                output: true
              },
              deleteOneOp = {
                ...org.objects.c_ctxapi_213.deleteOne({ c_string: 'deleteMe' }).getOptions(),
                name: 'Delete one',
                halt: true,
                wrap: true,
                output: false
              },
              updateOp = {
                ...org.objects.c_ctxapi_213.updateOne({ c_string: 'stringA' }, {
                  $set: {
                    c_number: 42,
                    c_boolean: false,
                    c_doc_array: [{
                      c_string: 'third_doc'
                    }, {
                      c_string: 'fourth_doc'
                    }]
                  },
                  $unset: {
                    'c_string_b': 1
                  },
                  $push: {
                    c_string_array: ['third', 'fourth']
                  },
                  $remove: {
                    c_number_array: [1, 55]
                  }
                }).getOptions(),
                name: 'Update it',
                halt: true,
                wrap: true,
                output: false
              },
              alreadyDeleted = {
                ...org.objects.c_ctxapi_213.deleteOne({ c_string: 'deleteMe' }).getOptions(),
                name: 'AlreadyDeleted',
                halt: false,
                wrap: false,
                output: true
              },
              findOp = {
                ...org.objects.c_ctxapi_213.find({ c_string: 'stringA' }).getOptions(),
                name: 'Find it',
                halt: true,
                wrap: true,
                output: true
              }

        return [insertManyOp, deleteOneOp, updateOp, alreadyDeleted, findOp]
      }, 'admin'))

      response = await callHTTPBulkOp(ops)

      should.exist(response.body)
      should.exist(response.body.data)
      should.equal(response.body.data.length, 3)

      response.body.data[0].object.should.equal('operationResult')
      response.body.data[0].path.should.equal('Insert two[0][0]')
      response.body.data[0].data.insertedCount.should.equal(2)
      should.exist(response.body.data[0].data.writeErrors)
      response.body.data[0].data.writeErrors.should.be.empty()

      should.equal(response.body.data[1].object, 'fault')
      should.equal(response.body.data[1].errCode, 'cortex.notFound.instance')
      should.equal(response.body.data[1].status, 404)

      response.body.data[2].object.should.equal('operationResult')
      response.body.data[2].path.should.equal('Find it[4][0]')
      validateUpdatedResponse(response.body.data[2].data)

      instances = await fetchObjects('/c_ctxapi_213')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 1)
      validateUpdatedResponse(instances.body.data[0])

      void response
    })

    it('should insert one, then patch and find it', async() => {

      let ops, response, instances

      ops = await promised(null, sandboxed(function() {

        /* global org */

        const insertOneOp = {
                ...org.objects.c_ctxapi_213.insertOne({
                  c_number: 4,
                  c_boolean: true,
                  c_string: 'stringA',
                  c_string_b: 'stringB',
                  c_string_array: ['first', 'second'],
                  c_boolean_array: [true, false, true],
                  c_number_array: [1, 9, 8, 55],
                  c_doc_array: [{
                    c_string: 'first_doc'
                  }, {
                    c_string: 'second_doc'
                  }]
                }).getOptions(),
                name: 'Insert two',
                halt: true,
                wrap: true,
                output: false
              },
              deleteOneOp = {
                ...org.objects.c_ctxapi_213.deleteOne({ c_string: 'deleteMe' }).getOptions(),
                name: 'Delete one',
                halt: false,
                wrap: true,
                output: false
              },
              patchOp = {
                ...org.objects.c_ctxapi_213.patchOne({ c_string: 'stringA' }, [{
                  op: 'set',
                  value: {
                    c_number: 42,
                    c_boolean: false,
                    c_doc_array: [{
                      c_string: 'third_doc'
                    }, {
                      c_string: 'fourth_doc'
                    }]
                  }
                }, {
                  op: 'unset',
                  value: {
                    'c_string_b': 1
                  }
                }, {
                  op: 'push',
                  path: 'c_string_array',
                  value: ['third', 'fourth']
                }, {
                  op: 'remove',
                  path: 'c_number_array',
                  value: [1, 55]
                }]).getOptions(),
                name: 'Patch it',
                halt: true,
                wrap: true,
                output: true
              },
              findOp = {
                ...org.objects.c_ctxapi_213.find({ c_string: 'stringA' }).getOptions(),
                name: 'Find it',
                halt: true,
                wrap: true,
                output: true
              }

        return [insertOneOp, deleteOneOp, patchOp, findOp]
      }, 'admin'))

      response = await callHTTPBulkOp(ops)

      should.exist(response.body)
      should.exist(response.body.data)
      should.equal(response.body.data.length, 2)

      response.body.data[0].object.should.equal('operationResult')
      response.body.data[0].path.should.equal('Patch it[2][0]')

      response.body.data[1].object.should.equal('operationResult')
      response.body.data[1].path.should.equal('Find it[3][0]')
      validateUpdatedResponse(response.body.data[1].data)

      instances = await fetchObjects('/c_ctxapi_213')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 1)
      validateUpdatedResponse(instances.body.data[0])

      void response
    })

    it('should insert many, delete one, patch many and count them', async() => {

      let ops, response, instances

      ops = await promised(null, sandboxed(function() {

        /* global org */

        const insertManyOp = {
                ...org.objects.c_ctxapi_213.insertMany([{
                  c_number: 4,
                  c_boolean: true,
                  c_string: 'stringA',
                  c_string_b: 'stringB',
                  c_string_array: ['first', 'second'],
                  c_boolean_array: [true, false, true],
                  c_number_array: [1, 9, 8, 55],
                  c_doc_array: [{
                    c_string: 'first_doc'
                  }, {
                    c_string: 'second_doc'
                  }]
                }, {
                  c_number: 1,
                  c_boolean: false,
                  c_string: 'stringA',
                  c_string_b: 'anotherString',
                  c_string_array: ['first', 'second'],
                  c_boolean_array: [true, false, true],
                  c_number_array: [1, 9, 8, 55],
                  c_doc_array: [{
                    c_string: 'asdasdasd'
                  }, {
                    c_string: 'qweqweqwe'
                  }]
                }, { c_string: 'deleteMe' }]).getOptions(),
                name: 'Insert two',
                halt: true,
                wrap: true,
                output: false
              },
              deleteOneOp = {
                ...org.objects.c_ctxapi_213.deleteOne({ c_string: 'deleteMe' }).getOptions(),
                name: 'Delete one',
                halt: true,
                wrap: true,
                output: false
              },
              patchManyOp = {
                ...org.objects.c_ctxapi_213.patchMany({ c_string: 'stringA' }, [{
                  op: 'set',
                  value: {
                    c_number: 42,
                    c_boolean: false,
                    c_doc_array: [{
                      c_string: 'third_doc'
                    }, {
                      c_string: 'fourth_doc'
                    }]
                  }
                }, {
                  op: 'unset',
                  value: {
                    'c_string_b': 1
                  }
                }, {
                  op: 'push',
                  path: 'c_string_array',
                  value: ['third', 'fourth']
                }, {
                  op: 'remove',
                  path: 'c_number_array',
                  value: [1, 55]
                }]).getOptions(),
                name: 'Patch them',
                halt: true,
                wrap: true,
                output: true
              },
              findOp = {
                ...org.objects.c_ctxapi_213.aggregate([
                  {
                    $match: {
                      c_string: 'stringA'
                    }
                  }, {
                    $group: {
                      _id: null,
                      count: {
                        $count: '_id'
                      }
                    }
                  }
                ]).getOptions(),
                name: 'Count them',
                halt: true,
                wrap: false,
                output: true
              }

        return [insertManyOp, deleteOneOp, patchManyOp, findOp]
      }, 'admin'))

      response = await callHTTPBulkOp(ops)

      should.exist(response.body)
      should.exist(response.body.data)
      should.equal(response.body.data.length, 2)

      response.body.data[0].object.should.equal('operationResult')
      response.body.data[0].path.should.equal('Patch them[2][0]')

      should.equal(response.body.data[1].count, 2)

      instances = await fetchObjects('/c_ctxapi_213')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 2)
      validateUpdatedResponse(instances.body.data[0])
      validateUpdatedResponse(instances.body.data[1])

      void response
    })

    it('should insert many, delete many, update many, find them and use paths', async() => {

      let ops, response, instances

      ops = await promised(null, sandboxed(function() {

        /* global org */

        const insertManyOp = {
                ...org.objects.c_ctxapi_213.insertMany([{
                  c_number: 4,
                  c_boolean: true,
                  c_string: 'stringA',
                  c_string_b: 'stringB',
                  c_string_array: ['first', 'second'],
                  c_boolean_array: [true, false, true],
                  c_number_array: [1, 9, 8, 55],
                  c_doc_array: [{
                    c_string: 'first_doc'
                  }, {
                    c_string: 'second_doc'
                  }]
                }, {
                  c_number: 1,
                  c_boolean: false,
                  c_string: 'stringA',
                  c_string_b: 'anotherString',
                  c_string_array: ['first', 'second'],
                  c_boolean_array: [true, false, true],
                  c_number_array: [1, 9, 8, 55],
                  c_doc_array: [{
                    c_string: 'asdasdasd'
                  }, {
                    c_string: 'qweqweqwe'
                  }]
                }, {
                  c_string: 'deleteMe',
                  c_number: 86
                }, {
                  c_string: 'deleteMe',
                  c_number: 302.2
                }]).getOptions(),
                name: 'Insert two',
                halt: true,
                wrap: true,
                output: false
              },
              deleteManyOp = {
                ...org.objects.c_ctxapi_213.deleteMany({ c_string: 'deleteMe' }).getOptions(),
                name: 'Delete many',
                halt: true,
                wrap: true,
                output: false
              },
              updateManyOp = {
                ...org.objects.c_ctxapi_213.updateMany({ c_string: 'stringA' }, {
                  $set: {
                    c_number: 42,
                    c_boolean: false,
                    c_doc_array: [{
                      c_string: 'third_doc'
                    }, {
                      c_string: 'fourth_doc'
                    }]
                  },
                  $unset: {
                    'c_string_b': 1
                  },
                  $push: {
                    c_string_array: ['third', 'fourth']
                  },
                  $remove: {
                    c_number_array: [1, 55]
                  }
                }).getOptions(),
                name: 'Update them',
                halt: true,
                wrap: true,
                output: true
              },
              findOp = {
                ...org.objects.c_ctxapi_213
                  .find({ c_string: 'stringA' })
                  .paths('c_doc_array')
                  .limit(1)
                  .getOptions(),
                name: 'Find them',
                halt: true,
                wrap: true,
                output: true
              }

        return [insertManyOp, deleteManyOp, updateManyOp, findOp]
      }, 'admin'))

      response = await callHTTPBulkOp(ops)

      should.exist(response.body)
      should.exist(response.body.data)
      should.equal(response.body.data.length, 2)

      response.body.data[0].object.should.equal('operationResult')
      response.body.data[0].path.should.equal('Update them[2][0]')

      response.body.data[1].object.should.equal('operationResult')
      response.body.data[1].path.should.equal('Find them[3][0]')
      should.exist(response.body.data[1].data)
      should.exist(response.body.data[1].data.c_doc_array)
      should.equal(response.body.data[1].data.c_doc_array.length, 2)
      response.body.data[1].data.c_doc_array.should.containDeep([{
        c_string: 'third_doc'
      }, {
        c_string: 'fourth_doc'
      }])

      instances = await fetchObjects('/c_ctxapi_213')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 2)
      validateUpdatedResponse(instances.body.data[0])
      validateUpdatedResponse(instances.body.data[1])

      void response
    })

    it('should insert many, update one, and make a projection', async() => {

      let ops, response, instances, aggregationOutput, findOutput, soEmpty, stringA, stringB, stringC

      ops = await promised(null, sandboxed(function() {

        /* global org */

        const insertManyOp = {
                ...org.objects.c_ctxapi_213.insertMany([{
                  c_number: 4,
                  c_boolean: true,
                  c_string: 'stringA',
                  c_string_b: 'stringB',
                  c_string_array: ['first', 'second'],
                  c_boolean_array: [true, false, true],
                  c_number_array: [1, 9, 8, 55],
                  c_doc_array: [{
                    c_string: 'first_doc'
                  }, {
                    c_string: 'second_doc'
                  }]
                }, {
                  c_number: 4,
                  c_boolean: true,
                  c_string: 'stringB',
                  c_string_b: 'stringB',
                  c_string_array: ['first', 'second'],
                  c_boolean_array: [true, false, true],
                  c_number_array: [1, 9, 8, 55],
                  c_doc_array: [{
                    c_string: 'first_doc'
                  }, {
                    c_string: 'second_doc'
                  }]
                }, {
                  c_number: 4,
                  c_boolean: true,
                  c_string: 'stringC',
                  c_string_b: 'stringB',
                  c_string_array: ['first', 'second'],
                  c_boolean_array: [true, false, true],
                  c_number_array: [1, 9, 8, 55],
                  c_doc_array: [{
                    c_string: 'first_doc'
                  }, {
                    c_string: 'second_doc'
                  }]
                }, {
                  c_string: 'soEmpty'
                }]).getOptions(),
                name: 'Insert three',
                halt: true,
                wrap: true,
                output: false
              },
              deleteOneOp = {
                ...org.objects.c_ctxapi_213.deleteOne({ c_string: 'deleteMe' }).getOptions(),
                name: 'Delete one',
                halt: false,
                wrap: true,
                output: false
              },
              updateOp = {
                ...org.objects.c_ctxapi_213.updateOne({ c_string: 'stringA' }, {
                  $set: {
                    c_number: 42,
                    c_boolean: false,
                    c_doc_array: [{
                      c_string: 'third_doc'
                    }, {
                      c_string: 'fourth_doc'
                    }]
                  },
                  $unset: {
                    'c_string_b': 1
                  },
                  $push: {
                    c_string_array: ['third', 'fourth']
                  },
                  $remove: {
                    c_number_array: [1, 55]
                  }
                }).getOptions(),
                name: 'Update it',
                halt: true,
                wrap: true,
                output: false
              },
              findOp = {
                ...org.objects.c_ctxapi_213.find({ c_number: 4 }).sort({ c_string: -1 }).paths('c_string', 'c_number', 'c_number_array').limit(1).getOptions(),
                name: 'Find, sort and limit to 1',
                halt: true,
                wrap: false,
                output: true
              },
              aggregateOp = {
                ...org.objects.c_ctxapi_213
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
                        c_string_b: 0,
                        c_the_strings: {
                          $concat: [
                            { $string: 'First string is ' },
                            { $arrayElemAt: ['c_string_array', 0] },
                            { $string: ', and second string is ' },
                            { $arrayElemAt: ['c_string_array', 1] }
                          ]
                        },
                        c_the_numbers: {
                          $add: [
                            { $arrayElemAt: ['c_number_array', 0] },
                            { $arrayElemAt: ['c_number_array', 1] },
                            { $arrayElemAt: ['c_number_array', 2] },
                            { $arrayElemAt: ['c_number_array', 3] }
                          ]
                        }
                      }
                    }
                  ])
                  .getOptions(),
                name: 'The aggregation',
                halt: true,
                wrap: true,
                output: true
              }

        return [insertManyOp, deleteOneOp, updateOp, findOp, aggregateOp]
      }, 'admin'))

      response = await callHTTPBulkOp(ops)

      should.exist(response.body)
      should.exist(response.body.data)
      should.equal(response.body.data.length, 2)

      findOutput = response.body.data[0]
      should.equal(findOutput.c_string, 'stringC')
      should.equal(findOutput.c_number, 4)
      should.exist(findOutput.c_number_array)
      findOutput.c_number_array.should.containDeep([1, 9, 8, 55])

      response.body.data[1].object.should.equal('operationResult')
      response.body.data[1].path.should.equal('The aggregation[4][0]')

      should.exist(response.body.data[1].data)

      aggregationOutput = response.body.data[1].data
      should.equal(aggregationOutput.c_boolean, true)
      should.equal(aggregationOutput.c_number, 4)
      should.equal(aggregationOutput.c_string, 'stringC')
      should.equal(aggregationOutput.c_the_numbers, 73)
      should.equal(aggregationOutput.c_the_strings, 'First string is first, and second string is second')

      instances = await fetchObjects('/c_ctxapi_213?sort={"c_string":1}')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 4)

      soEmpty = instances.body.data[0]
      stringA = instances.body.data[1]
      stringB = instances.body.data[2]
      stringC = instances.body.data[3]

      should.equal(soEmpty.c_string, 'soEmpty')
      soEmpty.c_boolean_array.should.be.empty()
      soEmpty.c_doc_array.should.be.empty()
      soEmpty.c_number_array.should.be.empty()
      soEmpty.c_string_array.should.be.empty()
      should.not.exist(soEmpty.c_number)
      should.not.exist(soEmpty.c_boolean)
      should.not.exist(soEmpty.c_string_b)

      validateUpdatedResponse(stringA)
      validateNonUpdatedResponse(stringB, 'stringB')
      validateNonUpdatedResponse(stringC, 'stringC')

      void response
    })

    it('should insert one, and fail to update with a wrong match', async() => {

      let ops, response, instances

      ops = await promised(null, sandboxed(function() {

        /* global org */

        const insertOneOp = {
                ...org.objects.c_ctxapi_213.insertOne({
                  c_number: 4,
                  c_boolean: true,
                  c_string: 'stringA',
                  c_string_b: 'stringB',
                  c_string_array: ['first', 'second'],
                  c_boolean_array: [true, false, true],
                  c_number_array: [1, 9, 8, 55],
                  c_doc_array: [{
                    c_string: 'first_doc'
                  }, {
                    c_string: 'second_doc'
                  }]
                }).getOptions(),
                name: 'Insert one',
                halt: true,
                wrap: true,
                output: false
              },
              updateOp = {
                ...org.objects.c_ctxapi_213.updateOne({ c_string: 'No Match!' }, {
                  $set: {
                    c_number: 42,
                    c_boolean: false,
                    c_doc_array: [{
                      c_string: 'third_doc'
                    }, {
                      c_string: 'fourth_doc'
                    }]
                  },
                  $unset: {
                    'c_string_b': 1
                  },
                  $push: {
                    c_string_array: ['third', 'fourth']
                  },
                  $remove: {
                    c_number_array: [1, 55]
                  }
                }).getOptions(),
                name: 'Update it',
                halt: true,
                wrap: true,
                output: true
              },
              findOp = {
                ...org.objects.c_ctxapi_213.find().getOptions(),
                name: 'Find it',
                halt: true,
                wrap: true,
                output: true
              }

        return [insertOneOp, updateOp, findOp]
      }, 'admin'))

      response = await callHTTPBulkOp(ops)

      should.exist(response.body)
      if (response.body.data) {
        response.body.data.should.be.empty()
      }
      should.equal(response.body.errCode, 'cortex.notFound.instance')
      should.equal(response.body.object, 'fault')
      should.equal(response.body.code, 'kNotFound')
      should.equal(response.body.status, 404)

      instances = await fetchObjects('/c_ctxapi_213')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 1)

      validateNonUpdatedResponse(instances.body.data[0], 'stringA')

      void response
    })

    it('should insert one, create a reference, and expand it', async() => {

      let sandboxResponse, response, instances

      sandboxResponse = await promised(null, sandboxed(function() {

        /* global org */

        const childId = org.objects.c_ctxapi_213.insertOne({
                c_number: 4,
                c_boolean: true,
                c_string: 'stringA',
                c_string_b: 'stringB',
                c_string_array: ['first', 'second'],
                c_boolean_array: [true, false, true],
                c_number_array: [1, 9, 8, 55],
                c_doc_array: [{
                  c_string: 'first_doc'
                }, {
                  c_string: 'second_doc'
                }]
              }).execute(),
              insertFatherOp = {
                ...org.objects.c_ctxapi_213_father.insertOne({
                  c_reference: childId
                }).getOptions(),
                name: 'Insert Father',
                halt: true,
                wrap: false,
                output: false
              },
              aggregationOp = {
                ...org.objects.c_ctxapi_213_father.aggregate([
                  {
                    $project: {
                      c_reference: {
                        $expand: [
                          'c_number',
                          'c_boolean',
                          'c_string',
                          'c_string_array',
                          'c_doc_array'
                        ]
                      }
                    }
                  }
                ]).getOptions(),
                name: 'Using Aggregation',
                halt: true,
                wrap: true,
                output: true
              },
              projectOp = {
                ...org.objects.c_ctxapi_213_father
                  .aggregate()
                  .project({
                    c_reference: {
                      $expand: [
                        'c_number',
                        'c_boolean',
                        'c_string',
                        'c_string_array',
                        'c_doc_array'
                      ]
                    }
                  })
                  .getOptions(),
                name: 'Using .project()',
                halt: true,
                wrap: true,
                output: true
              },
              expandOp = {
                ...org.objects.c_ctxapi_213_father
                  .find()
                  .expand('c_reference')
                  .getOptions(),
                name: 'Using .find().expand()',
                halt: true,
                wrap: true,
                output: true
              }

        return { childId, ops: [insertFatherOp, aggregationOp, expandOp, projectOp] }
      }, 'admin'))

      response = await callHTTPBulkOp(sandboxResponse.ops)

      should.exist(response.body)
      should.exist(response.body.data)
      should.equal(response.body.data.length, 3)

      response.body.data[0].object.should.equal('operationResult')
      response.body.data[0].path.should.equal('Using Aggregation[1][0]')

      response.body.data[1].object.should.equal('operationResult')
      response.body.data[1].path.should.equal('Using .find().expand()[2][0]')

      response.body.data[2].object.should.equal('operationResult')
      response.body.data[2].path.should.equal('Using .project()[3][0]')

      response.body.data.forEach(output => {
        let childRef = output.data.c_reference

        should.exist(childRef)
        should.equal(childRef.c_boolean, true)
        should.equal(childRef.c_number, 4)
        should.equal(childRef.c_string, 'stringA')

        should.exist(childRef.c_string_array)
        should.exist(childRef.c_doc_array)

        childRef.c_string_array.should.containDeep(['first', 'second'])
        childRef.c_doc_array.should.containDeep([{
          c_string: 'first_doc'
        }, {
          c_string: 'second_doc'
        }])
      })

      instances = await fetchObjects('/c_ctxapi_213_father')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 1)

      should.exist(instances.body.data[0].c_reference)
      should.equal(instances.body.data[0].c_reference._id, sandboxResponse.childId)

      void response
    })
  })

  describe('Scripting', function() {

    afterEach(sandboxed(cleanInstances))

    it('should insert many, delete one, update one and find it', async() => {

      let response, instances

      response = await promised(null, sandboxed(function() {

        /* global org */

        const cursor = org.objects.bulk()
          .add(
            org.objects.c_ctxapi_213.insertMany([{
              c_number: 4,
              c_boolean: true,
              c_string: 'stringA',
              c_string_b: 'stringB',
              c_string_array: ['first', 'second'],
              c_boolean_array: [true, false, true],
              c_number_array: [1, 9, 8, 55],
              c_doc_array: [{
                c_string: 'first_doc'
              }, {
                c_string: 'second_doc'
              }]
            }, { c_string: 'deleteMe' }]),
            {
              name: 'Insert two',
              halt: true,
              wrap: true,
              output: true
            }
          )
          .add(
            org.objects.c_ctxapi_213.deleteOne({ c_string: 'deleteMe' }),
            {
              name: 'Delete one',
              halt: true,
              wrap: true,
              output: false
            }
          )
          .add(
            org.objects.c_ctxapi_213.updateOne({ c_string: 'stringA' }, {
              $set: {
                c_number: 42,
                c_boolean: false,
                c_doc_array: [{
                  c_string: 'third_doc'
                }, {
                  c_string: 'fourth_doc'
                }]
              },
              $unset: {
                'c_string_b': 1
              },
              $push: {
                c_string_array: ['third', 'fourth']
              },
              $remove: {
                c_number_array: [1, 55]
              }
            }),
            {
              name: 'Update it',
              halt: true,
              wrap: true,
              output: false
            }
          )
          .add(
            org.objects.c_ctxapi_213.deleteOne({ c_string: 'deleteMe' }),
            {
              name: 'AlreadyDeleted',
              halt: false,
              wrap: false,
              output: true
            }
          )
          .add(
            org.objects.c_ctxapi_213.find({ c_string: 'stringA' }),
            {
              name: 'Find it',
              halt: true,
              wrap: true,
              output: true
            }
          )

        return cursor.toArray()
      }, 'admin'))

      should.exist(response)
      should.equal(response.length, 3)

      response[0].object.should.equal('operationResult')
      response[0].path.should.equal('Insert two[0][0]')
      response[0].data.insertedCount.should.equal(2)

      if (response[0].data.writeErrors) {
        response[0].data.writeErrors.should.be.empty()
      }

      should.equal(response[1].object, 'fault')
      should.equal(response[1].errCode, 'cortex.notFound.instance')
      should.equal(response[1].status, 404)

      response[2].object.should.equal('operationResult')
      response[2].path.should.equal('Find it[4][0]')
      validateUpdatedResponse(response[2].data)

      instances = await fetchObjects('/c_ctxapi_213')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 1)
      validateUpdatedResponse(instances.body.data[0])

      void response
    })

    it('should insert one, then patch and find it', async() => {

      let response, instances

      response = await promised(null, sandboxed(function() {

        /* global org */

        const cursor = org.objects.bulk()
          .add(
            org.objects.c_ctxapi_213.insertOne({
              c_number: 4,
              c_boolean: true,
              c_string: 'stringA',
              c_string_b: 'stringB',
              c_string_array: ['first', 'second'],
              c_boolean_array: [true, false, true],
              c_number_array: [1, 9, 8, 55],
              c_doc_array: [{
                c_string: 'first_doc'
              }, {
                c_string: 'second_doc'
              }]
            }),
            {
              name: 'Insert two',
              halt: true,
              wrap: true,
              output: false
            })
          .add(
            org.objects.c_ctxapi_213.deleteOne({ c_string: 'deleteMe' }),
            {
              name: 'Delete one',
              halt: false,
              wrap: true,
              output: false
            })
          .add(
            org.objects.c_ctxapi_213.patchOne({ c_string: 'stringA' }, [{
              op: 'set',
              value: {
                c_number: 42,
                c_boolean: false,
                c_doc_array: [{
                  c_string: 'third_doc'
                }, {
                  c_string: 'fourth_doc'
                }]
              }
            }, {
              op: 'unset',
              value: {
                'c_string_b': 1
              }
            }, {
              op: 'push',
              path: 'c_string_array',
              value: ['third', 'fourth']
            }, {
              op: 'remove',
              path: 'c_number_array',
              value: [1, 55]
            }]),
            {
              name: 'Patch it',
              halt: true,
              wrap: true,
              output: true
            })
          .add(
            org.objects.c_ctxapi_213.find({ c_string: 'stringA' }),
            {
              name: 'Find it',
              halt: true,
              wrap: true,
              output: true
            })

        return cursor.toArray()
      }, 'admin'))

      should.exist(response)
      should.equal(response.length, 2)

      response[0].object.should.equal('operationResult')
      response[0].path.should.equal('Patch it[2][0]')

      response[1].object.should.equal('operationResult')
      response[1].path.should.equal('Find it[3][0]')
      validateUpdatedResponse(response[1].data)

      instances = await fetchObjects('/c_ctxapi_213')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 1)
      validateUpdatedResponse(instances.body.data[0])

      void response
    })

    it('should insert many, delete one, patch many and count them', async() => {

      let response, instances

      response = await promised(null, sandboxed(function() {

        /* global org */

        const cursor = org.objects.bulk()
          .add(
            org.objects.c_ctxapi_213.insertMany([{
              c_number: 4,
              c_boolean: true,
              c_string: 'stringA',
              c_string_b: 'stringB',
              c_string_array: ['first', 'second'],
              c_boolean_array: [true, false, true],
              c_number_array: [1, 9, 8, 55],
              c_doc_array: [{
                c_string: 'first_doc'
              }, {
                c_string: 'second_doc'
              }]
            }, {
              c_number: 1,
              c_boolean: false,
              c_string: 'stringA',
              c_string_b: 'anotherString',
              c_string_array: ['first', 'second'],
              c_boolean_array: [true, false, true],
              c_number_array: [1, 9, 8, 55],
              c_doc_array: [{
                c_string: 'asdasdasd'
              }, {
                c_string: 'qweqweqwe'
              }]
            }, { c_string: 'deleteMe' }]),
            {
              name: 'Insert two',
              halt: true,
              wrap: true,
              output: false
            })
          .add(
            org.objects.c_ctxapi_213.deleteOne({ c_string: 'deleteMe' }),
            {
              name: 'Delete one',
              halt: true,
              wrap: true,
              output: false
            })
          .add(
            org.objects.c_ctxapi_213.patchMany({ c_string: 'stringA' }, [{
              op: 'set',
              value: {
                c_number: 42,
                c_boolean: false,
                c_doc_array: [{
                  c_string: 'third_doc'
                }, {
                  c_string: 'fourth_doc'
                }]
              }
            }, {
              op: 'unset',
              value: {
                'c_string_b': 1
              }
            }, {
              op: 'push',
              path: 'c_string_array',
              value: ['third', 'fourth']
            }, {
              op: 'remove',
              path: 'c_number_array',
              value: [1, 55]
            }]),
            {
              name: 'Patch them',
              halt: true,
              wrap: true,
              output: true
            })
          .add(
            org.objects.c_ctxapi_213.aggregate([
              {
                $match: {
                  c_string: 'stringA'
                }
              }, {
                $group: {
                  _id: null,
                  count: {
                    $count: '_id'
                  }
                }
              }
            ]), {
              name: 'Count them',
              halt: true,
              wrap: false,
              output: true
            })

        return cursor.toArray()
      }, 'admin'))

      should.exist(response)
      should.equal(response.length, 2)

      response[0].object.should.equal('operationResult')
      response[0].path.should.equal('Patch them[2][0]')

      should.equal(response[1].count, 2)

      instances = await fetchObjects('/c_ctxapi_213')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 2)
      validateUpdatedResponse(instances.body.data[0])
      validateUpdatedResponse(instances.body.data[1])

      void response
    })

    it('should insert many, delete many, update many, find them and use paths', async() => {

      let response, instances

      response = await promised(null, sandboxed(function() {

        /* global org */

        const cursor = org.objects.bulk()
          .add(
            org.objects.c_ctxapi_213.insertMany([{
              c_number: 4,
              c_boolean: true,
              c_string: 'stringA',
              c_string_b: 'stringB',
              c_string_array: ['first', 'second'],
              c_boolean_array: [true, false, true],
              c_number_array: [1, 9, 8, 55],
              c_doc_array: [{
                c_string: 'first_doc'
              }, {
                c_string: 'second_doc'
              }]
            }, {
              c_number: 1,
              c_boolean: false,
              c_string: 'stringA',
              c_string_b: 'anotherString',
              c_string_array: ['first', 'second'],
              c_boolean_array: [true, false, true],
              c_number_array: [1, 9, 8, 55],
              c_doc_array: [{
                c_string: 'asdasdasd'
              }, {
                c_string: 'qweqweqwe'
              }]
            }, {
              c_string: 'deleteMe',
              c_number: 86
            }, {
              c_string: 'deleteMe',
              c_number: 302.2
            }]),
            {
              name: 'Insert two',
              halt: true,
              wrap: true,
              output: false
            })
          .add(
            org.objects.c_ctxapi_213.deleteMany({ c_string: 'deleteMe' }),
            {
              name: 'Delete many',
              halt: true,
              wrap: true,
              output: false
            })
          .add(
            org.objects.c_ctxapi_213.updateMany({ c_string: 'stringA' }, {
              $set: {
                c_number: 42,
                c_boolean: false,
                c_doc_array: [{
                  c_string: 'third_doc'
                }, {
                  c_string: 'fourth_doc'
                }]
              },
              $unset: {
                'c_string_b': 1
              },
              $push: {
                c_string_array: ['third', 'fourth']
              },
              $remove: {
                c_number_array: [1, 55]
              }
            }), {
              name: 'Update them',
              halt: true,
              wrap: true,
              output: true
            })
          .add(
            org.objects.c_ctxapi_213
              .find({ c_string: 'stringA' })
              .paths('c_doc_array')
              .limit(1),
            {
              name: 'Find them',
              halt: true,
              wrap: true,
              output: true
            })

        return cursor.toArray()
      }, 'admin'))

      should.exist(response)
      should.equal(response.length, 2)

      response[0].object.should.equal('operationResult')
      response[0].path.should.equal('Update them[2][0]')

      response[1].object.should.equal('operationResult')
      response[1].path.should.equal('Find them[3][0]')
      should.exist(response[1].data)
      should.exist(response[1].data.c_doc_array)
      should.equal(response[1].data.c_doc_array.length, 2)
      response[1].data.c_doc_array.should.containDeep([{
        c_string: 'third_doc'
      }, {
        c_string: 'fourth_doc'
      }])

      instances = await fetchObjects('/c_ctxapi_213')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 2)
      validateUpdatedResponse(instances.body.data[0])
      validateUpdatedResponse(instances.body.data[1])

      void response
    })

    it('should insert many, update one, and make a projection', async() => {

      let response, instances, aggregationOutput, findOutput, soEmpty, stringA, stringB, stringC

      response = await promised(null, sandboxed(function() {

        /* global org */

        const cursor = org.objects.bulk()
          .add(org.objects.c_ctxapi_213.insertMany([{
            c_number: 4,
            c_boolean: true,
            c_string: 'stringA',
            c_string_b: 'stringB',
            c_string_array: ['first', 'second'],
            c_boolean_array: [true, false, true],
            c_number_array: [1, 9, 8, 55],
            c_doc_array: [{
              c_string: 'first_doc'
            }, {
              c_string: 'second_doc'
            }]
          }, {
            c_number: 4,
            c_boolean: true,
            c_string: 'stringB',
            c_string_b: 'stringB',
            c_string_array: ['first', 'second'],
            c_boolean_array: [true, false, true],
            c_number_array: [1, 9, 8, 55],
            c_doc_array: [{
              c_string: 'first_doc'
            }, {
              c_string: 'second_doc'
            }]
          }, {
            c_number: 4,
            c_boolean: true,
            c_string: 'stringC',
            c_string_b: 'stringB',
            c_string_array: ['first', 'second'],
            c_boolean_array: [true, false, true],
            c_number_array: [1, 9, 8, 55],
            c_doc_array: [{
              c_string: 'first_doc'
            }, {
              c_string: 'second_doc'
            }]
          }, {
            c_string: 'soEmpty'
          }]),
          {
            name: 'Insert three',
            halt: true,
            wrap: true,
            output: false
          })
          .add(org.objects.c_ctxapi_213.deleteOne({ c_string: 'deleteMe' }),
            {
              name: 'Delete one',
              halt: false,
              wrap: true,
              output: false
            })
          .add(
            org.objects.c_ctxapi_213.updateOne({ c_string: 'stringA' }, {
              $set: {
                c_number: 42,
                c_boolean: false,
                c_doc_array: [{
                  c_string: 'third_doc'
                }, {
                  c_string: 'fourth_doc'
                }]
              },
              $unset: {
                'c_string_b': 1
              },
              $push: {
                c_string_array: ['third', 'fourth']
              },
              $remove: {
                c_number_array: [1, 55]
              }
            }),
            {
              name: 'Update it',
              halt: true,
              wrap: true,
              output: false
            })
          .add(
            org.objects.c_ctxapi_213
              .find({ c_number: 4 })
              .sort({ c_string: -1 })
              .paths('c_string', 'c_number', 'c_number_array')
              .limit(1),
            {
              name: 'Find, sort and limit to 1',
              halt: true,
              wrap: false,
              output: true
            })
          .add(
            org.objects.c_ctxapi_213
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
                    c_string_b: 0,
                    c_the_strings: {
                      $concat: [
                        { $string: 'First string is ' },
                        { $arrayElemAt: ['c_string_array', 0] },
                        { $string: ', and second string is ' },
                        { $arrayElemAt: ['c_string_array', 1] }
                      ]
                    },
                    c_the_numbers: {
                      $add: [
                        { $arrayElemAt: ['c_number_array', 0] },
                        { $arrayElemAt: ['c_number_array', 1] },
                        { $arrayElemAt: ['c_number_array', 2] },
                        { $arrayElemAt: ['c_number_array', 3] }
                      ]
                    }
                  }
                }
              ]),
            {
              name: 'The aggregation',
              halt: true,
              wrap: true,
              output: true
            })

        return cursor.toArray()
      }, 'admin'))

      should.exist(response)
      should.equal(response.length, 2)

      findOutput = response[0]
      should.equal(findOutput.c_string, 'stringC')
      should.equal(findOutput.c_number, 4)
      should.exist(findOutput.c_number_array)
      findOutput.c_number_array.should.containDeep([1, 9, 8, 55])

      response[1].object.should.equal('operationResult')
      response[1].path.should.equal('The aggregation[4][0]')

      should.exist(response[1].data)

      aggregationOutput = response[1].data
      should.equal(aggregationOutput.c_boolean, true)
      should.equal(aggregationOutput.c_number, 4)
      should.equal(aggregationOutput.c_string, 'stringC')
      should.equal(aggregationOutput.c_the_numbers, 73)
      should.equal(aggregationOutput.c_the_strings, 'First string is first, and second string is second')

      instances = await fetchObjects('/c_ctxapi_213?sort={"c_string":1}')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 4)

      soEmpty = instances.body.data[0]
      stringA = instances.body.data[1]
      stringB = instances.body.data[2]
      stringC = instances.body.data[3]

      should.equal(soEmpty.c_string, 'soEmpty')
      soEmpty.c_boolean_array.should.be.empty()
      soEmpty.c_doc_array.should.be.empty()
      soEmpty.c_number_array.should.be.empty()
      soEmpty.c_string_array.should.be.empty()
      should.not.exist(soEmpty.c_number)
      should.not.exist(soEmpty.c_boolean)
      should.not.exist(soEmpty.c_string_b)

      validateUpdatedResponse(stringA)
      validateNonUpdatedResponse(stringB, 'stringB')
      validateNonUpdatedResponse(stringC, 'stringC')

      void response
    })

    it('should insert one, and fail to update with a wrong match', async() => {

      let instances

      await promised(null, sandboxed(function() {

        /* global org */

        const should = require('should'),
              tryCatch = require('util.values').tryCatch,
              cursor = org.objects.bulk()
                .add(org.objects.c_ctxapi_213.insertOne({
                  c_number: 4,
                  c_boolean: true,
                  c_string: 'stringA',
                  c_string_b: 'stringB',
                  c_string_array: ['first', 'second'],
                  c_boolean_array: [true, false, true],
                  c_number_array: [1, 9, 8, 55],
                  c_doc_array: [{
                    c_string: 'first_doc'
                  }, {
                    c_string: 'second_doc'
                  }]
                }),
                {
                  name: 'Insert one',
                  halt: true,
                  wrap: true,
                  output: false
                })
                .add(
                  org.objects.c_ctxapi_213.updateOne({ c_string: 'No Match!' }, {
                    $set: {
                      c_number: 42,
                      c_boolean: false,
                      c_doc_array: [{
                        c_string: 'third_doc'
                      }, {
                        c_string: 'fourth_doc'
                      }]
                    },
                    $unset: {
                      'c_string_b': 1
                    },
                    $push: {
                      c_string_array: ['third', 'fourth']
                    },
                    $remove: {
                      c_number_array: [1, 55]
                    }
                  }),
                  {
                    name: 'Update it',
                    halt: true,
                    wrap: true,
                    output: true
                  })
                .add(org.objects.c_ctxapi_213.insertOne({
                  c_string: 'Should not execute this!'
                }),
                {
                  name: 'Should not reach here',
                  halt: true,
                  wrap: true,
                  output: true
                })

        tryCatch(function() {
          cursor.toArray()
          should.exist(undefined)
        }, function(err, result) {
          should.exist(err)
          should.not.exist(result)

          if (err.data) {
            err.data.should.be.empty()
          }

          should.equal(err.errCode, 'cortex.notFound.instance')
          should.equal(err.object, 'fault')
          should.equal(err.code, 'kNotFound')
          should.equal(err.status, 404)
        })

      }, 'admin'))

      instances = await fetchObjects('/c_ctxapi_213')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 1)

      validateNonUpdatedResponse(instances.body.data[0], 'stringA')

      void instances
    })

    it('should insert one, create a reference, and expand it', async() => {

      let response, instances

      response = await promised(null, sandboxed(function() {

        /* global org */

        const childId = org.objects.c_ctxapi_213.insertOne({
                c_number: 4,
                c_boolean: true,
                c_string: 'stringA',
                c_string_b: 'stringB',
                c_string_array: ['first', 'second'],
                c_boolean_array: [true, false, true],
                c_number_array: [1, 9, 8, 55],
                c_doc_array: [{
                  c_string: 'first_doc'
                }, {
                  c_string: 'second_doc'
                }]
              }).execute(),
              bulkOutput = org.objects.bulk()
                .add(
                  org.objects.c_ctxapi_213_father.insertOne({
                    c_reference: childId
                  }),
                  {
                    name: 'Insert Father',
                    halt: true,
                    wrap: false,
                    output: false
                  })
                .add(
                  org.objects.c_ctxapi_213_father.aggregate([
                    {
                      $project: {
                        c_reference: {
                          $expand: [
                            'c_number',
                            'c_boolean',
                            'c_string',
                            'c_string_array',
                            'c_doc_array'
                          ]
                        }
                      }
                    }
                  ]),
                  {
                    name: 'Using Aggregation',
                    halt: true,
                    wrap: true,
                    output: true
                  })
                .add(
                  org.objects.c_ctxapi_213_father
                    .find()
                    .expand('c_reference'),
                  {
                    name: 'Using .find().expand()',
                    halt: true,
                    wrap: true,
                    output: true
                  })
                .add(
                  org.objects.c_ctxapi_213_father
                    .aggregate()
                    .project({
                      c_reference: {
                        $expand: [
                          'c_number',
                          'c_boolean',
                          'c_string',
                          'c_string_array',
                          'c_doc_array'
                        ]
                      }
                    }),
                  {
                    name: 'Using .project()',
                    halt: true,
                    wrap: true,
                    output: true
                  })
                .toArray()

        return { childId, bulk: bulkOutput }
      }, 'admin'))

      should.exist(response)
      should.equal(response.bulk.length, 3)

      response.bulk[0].object.should.equal('operationResult')
      response.bulk[0].path.should.equal('Using Aggregation[1][0]')

      response.bulk[1].object.should.equal('operationResult')
      response.bulk[1].path.should.equal('Using .find().expand()[2][0]')

      response.bulk[2].object.should.equal('operationResult')
      response.bulk[2].path.should.equal('Using .project()[3][0]')

      response.bulk.forEach(output => {
        let childRef = output.data.c_reference

        should.exist(childRef)
        should.equal(childRef.c_boolean, true)
        should.equal(childRef.c_number, 4)
        should.equal(childRef.c_string, 'stringA')

        should.exist(childRef.c_string_array)
        should.exist(childRef.c_doc_array)

        childRef.c_string_array.should.containDeep(['first', 'second'])
        childRef.c_doc_array.should.containDeep([{
          c_string: 'first_doc'
        }, {
          c_string: 'second_doc'
        }])
      })

      instances = await fetchObjects('/c_ctxapi_213_father')

      should.exist(instances)
      should.exist(instances.body)
      should.exist(instances.body.data)
      should.equal(instances.body.data.length, 1)

      should.exist(instances.body.data[0].c_reference)
      should.equal(instances.body.data[0].c_reference._id, response.childId)

      void response
    })

    it('should insert, update, delete and find (overriding ACL)', async() => {

      let response

      response = await promised(null, sandboxed(function() {
        const cursor = org.objects.bulk()
          .add(
            org.objects.c_ctxapi_213_public.insertMany([{
              c_public: 'c_public_a',
              c_connected: 'c_connected_a'
            }, {
              c_public: 'c_public_b',
              c_connected: 'c_connected_b'
            }, {
              c_public: 'c_public_c',
              c_connected: 'c_connected_c'
            }]).skipAcl().grant('delete'),
            {
              name: 'Insert three',
              halt: true,
              wrap: true,
              output: true
            })
          .add(
            org.objects.c_ctxapi_213_public.updateOne({
              c_public: 'c_public_a',
              c_connected: 'c_connected_a'
            }, {
              $set: {
                c_public: 'c_public_edited',
                c_connected: 'c_connected_edited'
              }
            }).skipAcl().grant('update'),
            {
              name: 'Update one',
              halt: true,
              wrap: true,
              output: true
            })
          .add(
            org.objects.c_ctxapi_213_public.deleteOne({
              c_public: 'c_public_b',
              c_connected: 'c_connected_b'
            }).skipAcl().grant('delete'),
            {
              name: 'Delete one',
              halt: true,
              wrap: true,
              output: true
            })
          .add(
            org.objects.c_ctxapi_213_public.find().sort({ c_public: 1 })
              .skipAcl().grant('read'),
            {
              name: 'Find them all',
              halt: true,
              wrap: true,
              output: true
            })

        return cursor.toArray()
      }))

      should.exist(response)
      should.equal(response.length, 5)

      response[0].object.should.equal('operationResult')
      response[0].path.should.equal('Insert three[0][0]')

      response[1].object.should.equal('operationResult')
      response[1].path.should.equal('Update one[1][0]')

      response[2].object.should.equal('operationResult')
      response[2].path.should.equal('Delete one[2][0]')

      response[3].object.should.equal('operationResult')
      response[3].path.should.equal('Find them all[3][0]')

      response[4].object.should.equal('operationResult')
      response[4].path.should.equal('Find them all[3][1]')

      should.exist(response[0].data)
      should.exist(response[0].data.insertedIds)
      should.equal(response[0].data.insertedCount, 3)
      should.equal(response[0].data.insertedIds.length, 3)

      should.exist(response[1].data)

      should.equal(response[2].data, true)

      should.exist(response[3].data)
      should.equal(response[3].data.c_public, 'c_public_c')
      should.equal(response[3].data.c_connected, 'c_connected_c')

      should.exist(response[4].data)
      should.equal(response[4].data.c_public, 'c_public_edited')
      should.equal(response[4].data.c_connected, 'c_connected_edited')

      void response
    })

    it('should execute operations as another user', async() => {

      let code = function() {
            return org.objects.account.register({
              name: {
                first: 'Administrator',
                last: 'Test'
              },
              email: 'ctxapi213+admin@medable.com',
              mobile: '15055555555',
              roles: [consts.roles.Administrator]
            }, {
              skipVerification: true,
              skipActivation: true,
              skipNotification: true,
              requireMobile: false
            })
          },
          codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
          script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' },
          response

      await server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set(server.getSessionHeaders())
        .send(script)
        .then()

      response = await promised(null, sandboxed(function() {
        const cursor = org.objects.bulk()
          .add(
            org.objects.account.find(),
            {
              name: 'Read account',
              halt: true,
              wrap: true,
              output: true,
              as: 'ctxapi213+admin@medable.com'
            })
          .add(
            org.objects.c_ctxapi_213.insertOne({
              c_string: 'c_string'
            }),
            {
              name: 'Insert one',
              halt: true,
              wrap: true,
              output: true
            }
          )
          .add(
            org.objects.c_ctxapi_213.find(),
            {
              name: 'Cannot Read object',
              halt: false,
              wrap: true,
              output: true,
              as: 'ctxapi213+admin@medable.com'
            })
          .add(
            org.objects.c_ctxapi_213.updateOne({ c_string: 'c_string' }, {
              $set: {
                c_string: 'Tom Bombadil'
              }
            }),
            {
              name: 'Cannot Update object',
              halt: false,
              wrap: true,
              output: true,
              as: 'ctxapi213+admin@medable.com'
            })
          .add(
            org.objects.c_ctxapi_213.deleteOne({ c_string: 'c_string' }),
            {
              name: 'Cannot Delete object',
              halt: false,
              wrap: true,
              output: true,
              as: 'ctxapi213+admin@medable.com'
            })

        return cursor.toArray()
      }))

      should.exist(response)
      should.equal(response.length, 4)

      response[0].object.should.equal('operationResult')
      response[0].path.should.equal('Read account[0][0]')

      response[1].object.should.equal('operationResult')
      response[1].path.should.equal('Insert one[1][0]')

      response[2].object.should.equal('operationResult')
      response[2].path.should.equal('Cannot Update object[3][0]')

      response[3].object.should.equal('operationResult')
      response[3].path.should.equal('Cannot Delete object[4][0]')

      should.exist(response[0].data)
      should.equal(response[0].data.email, 'ctxapi213+admin@medable.com')
      should.equal(response[0].data.mobile, '+15055555555')
      should.equal(response[0].data.object, 'account')
      should.exist(response[0].data.name)
      should.equal(response[0].data.name.first, 'Administrator')
      should.equal(response[0].data.name.last, 'Test')

      should.exist(response[1].data)
      should.exist(response[1].data.id)

      should.exist(response[2].data)
      should.equal(response[2].data.code, 'kAccessDenied')
      should.equal(response[2].data.errCode, 'cortex.accessDenied.instanceUpdate')
      should.equal(response[2].data.object, 'fault')
      should.equal(response[2].data.status, 403)

      should.exist(response[3].data)
      should.equal(response[3].data.code, 'kAccessDenied')
      should.equal(response[3].data.errCode, 'cortex.accessDenied.instanceDelete')
      should.equal(response[3].data.object, 'fault')
      should.equal(response[3].data.status, 403)

      void response
    })
  })
})

function validateUpdatedResponse(response) {

  should.exist(response)
  should.not.exist(response.errCode)
  response.c_number.should.equal(42)
  response.c_boolean.should.equal(false)
  response.c_string.should.equal('stringA')
  should.not.exist(response.c_string_b)
  response.c_boolean_array.length.should.equal(3)
  response.c_boolean_array.should.containDeep([true, false, true])
  response.c_string_array.length.should.equal(4)
  response.c_string_array.should.containDeep(['first', 'second', 'third', 'fourth'])
  response.c_number_array.length.should.equal(2)
  response.c_number_array.should.containDeep([9, 8])
  response.c_doc_array.length.should.equal(2)
  response.c_doc_array.should.containDeep([{
    c_string: 'third_doc'
  }, {
    c_string: 'fourth_doc'
  }])
}

function validateNonUpdatedResponse(instance, cStringValue) {

  should.equal(instance.c_boolean, true)
  should.exist(instance.c_boolean_array)
  instance.c_boolean_array.should.containDeep([true, false, true])
  should.exist(instance.c_doc_array)
  instance.c_doc_array.should.containDeep([{ c_string: 'first_doc' }, { c_string: 'second_doc' }])
  should.equal(instance.c_number, 4)
  should.exist(instance.c_number_array)
  instance.c_number_array.should.containDeep([1, 9, 8, 55])
  should.equal(instance.c_string, cStringValue)
  should.exist(instance.c_string_array)
  instance.c_string_array.should.containDeep(['first', 'second'])
  should.equal(instance.c_string_b, 'stringB')
}

async function fetchObjects(path) {

  return server.sessions.admin
    .get(server.makeEndpoint(path))
    .set({ 'Medable-Client-Key': server.sessionsClient.key })
    .then()
}

async function callHTTPBulkOp(operations) {

  return server.sessions.admin
    .post(server.makeEndpoint(`/org/db/bulk`))
    .set({ 'Medable-Client-Key': server.sessionsClient.key })
    .send({ ops: operations })
    .then()
}
