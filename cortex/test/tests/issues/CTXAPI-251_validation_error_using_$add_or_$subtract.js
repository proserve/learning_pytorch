'use strict'

/* global org */

const sandboxed = require('../../lib/sandboxed'),
      cleanInstances = function() {
        const should = require('should')
        org.objects.c_ctxapi_251.deleteMany({}).execute()
        org.objects.objects.deleteOne({ name: 'c_ctxapi_251' }).execute()
        should.equal(org.objects.objects.find({ name: 'c_ctxapi_251' }).count(), 0)
      }

describe('Issues - Validation error using $add/$subtract operator', function() {

  before(sandboxed(function() {
    org.objects.objects.insertOne({
      label: 'CTXAPI-251',
      name: 'c_ctxapi_251',
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
  }))

  before(sandboxed(function() {
    // add items here
    org.objects.c_ctxapi_251.insertMany([{
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
    }]).execute()
  }))

  after(sandboxed(cleanInstances))

  describe('test validations', function() {

    it('should return proper values using $add and $subtract using Numbers', sandboxed(function() {
      require('should')
      const data = org.objects.c_ctxapi_251.aggregate([
        {
          $match: {
            c_number: 4
          }
        },
        {
          $limit: 1
        },
        {
          $project: {
            c_test: { $size: { $arrayElemAt: [['c_number_array'], 0] } },
            minus: {
              $subtract: [
                10,
                { $arrayElemAt: ['c_number_array', 0] }
              ]
            },
            plus: {
              $add: [
                9,
                { $arrayElemAt: ['c_number_array', 0] }
              ]
            }
          }
        }
      ]).toArray()

      data[0].c_test.should.equal(4)
      data[0].minus.should.equal(9)
      data[0].plus.should.equal(10)
    }))

    it('should return proper values using $add and $subtract using Dates', sandboxed(function() {
      require('should')
      const moment = require('moment'),
            date = moment().toDate(),
            data = org.objects.c_ctxapi_251.aggregate([
              {
                $match: {
                  c_number: 4
                }
              },
              {
                $limit: 1
              },
              {
                $project: {
                  minus: {
                    $subtract: [
                      date,
                      600000
                    ]
                  },
                  plus: {
                    $add: [
                      date,
                      600000
                    ]
                  }
                }
              }
            ]).toArray()
      moment(data[0].minus).format('YYYY-MM-DD HH:mm:ss').should.equal(moment(date).millisecond(-600000).format('YYYY-MM-DD HH:mm:ss'))
      moment(data[0].plus).format('YYYY-MM-DD HH:mm:ss').should.equal(moment(date).millisecond(600000).format('YYYY-MM-DD HH:mm:ss'))
    }))

  })
})
