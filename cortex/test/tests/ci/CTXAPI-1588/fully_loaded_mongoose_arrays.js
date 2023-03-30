'use strict'

const sandboxed = require('../../../lib/sandboxed')

describe('Issues - CTXAPI-1588 - Push into localized documents.', function() {

  before(sandboxed(function() {

    const locModelName = 'c_ctxapi_1588_loc',
          modelName = 'c_ctxapi_1588',
          {
            org: {
              objects: {
                Objects
              }
            }
          } = global

    Objects.insertOne({
      label: locModelName,
      name: locModelName,
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [{
        name: 'c_document',
        label: 'c_document',
        type: 'Document',
        array: true,
        properties: [
          {
            label: 'String 1',
            name: 'c_string_one',
            type: 'String',
            indexed: true,
            localization: {
              enabled: true,
              fallback: false
            }
          },
          {
            label: 'String 2',
            name: 'c_string_two',
            type: 'String',
            localization: {
              enabled: true,
              fallback: false
            }
          }
        ]
      }]
    }).execute()

    Objects.insertOne({
      label: modelName,
      name: modelName,
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [{
        name: 'c_document',
        label: 'c_document',
        type: 'Document',
        array: true,
        properties: [
          {
            label: 'String 1',
            name: 'c_string_one',
            indexed: true,
            type: 'String'
          },
          {
            label: 'String 2',
            name: 'c_string_two',
            type: 'String'
          }
        ]
      }]
    }).execute()

  }))

  it('pushing into localized document array should not update existing values', sandboxed(function() {

    const should = require('should'),
          {
            org: {
              objects: {
                c_ctxapi_1588_loc: Model
              }
            }
          } = global,
          _id = Model.insertOne({ c_document: [{ c_string_one: 'one_one', c_string_two: 'one_two' }] })
            .lean(true)
            .execute(),
          original = Model.readOne({ _id }).paths('c_document').execute(),
          updated = Model.updateOne({ _id }, { $push: { c_document: [{ c_string_one: 'two_one' }] } }).paths('c_document').execute()

    should.equal(original.c_document[0].c_string_two, 'one_two')
    should.equal(updated.c_document[0].c_string_two, 'one_two')
    should.equal(updated.c_document[1].c_string_one, 'two_one')

  }))

  it('pushing into document array should not update existing values', sandboxed(function() {

    const should = require('should'),
          {
            org: {
              objects: {
                c_ctxapi_1588: Model
              }
            }
          } = global,
          _id = Model.insertOne({ c_document: [{ c_string_one: 'one_one', c_string_two: 'one_two' }] })
            .lean(true)
            .execute(),
          original = Model.readOne({ _id }).paths('c_document').execute(),
          updated = Model.updateOne({ _id }, { $push: { c_document: [{ c_string_one: 'two_one' }] } }).paths('c_document').execute()

    should.equal(original.c_document[0].c_string_two, 'one_two')
    should.equal(updated.c_document[0].c_string_two, 'one_two')
    should.equal(updated.c_document[1].c_string_one, 'two_one')

  }))

})
