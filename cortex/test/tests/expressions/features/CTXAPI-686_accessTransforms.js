'use strict'

const sandboxed = require('../../../lib/sandboxed')

describe('Expressions - CTXAPI-686 - accessTransforms', function() {

  before(sandboxed(function() {

    const {
      org: {
        objects: {
          Objects,
          c_ctxapi_686: Model,
          c_ctxapi_686_child: ChildModel
        }
      }
    } = global

    Objects.insertOne({
      label: 'c_ctxapi_686_child',
      name: 'c_ctxapi_686_child',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [{
        label: 'c_string',
        name: 'c_string',
        type: 'String',
        readAccess: 'script'
      }]
    }).execute()

    Objects.insertOne({
      label: 'c_ctxapi_686',
      name: 'c_ctxapi_686',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [
        {
          label: 'c_list',
          name: 'c_list',
          type: 'List',
          sourceObject: 'c_ctxapi_686_child',
          readThrough: true,
          writeThrough: true,
          accessTransforms: [{
            name: 'expression',
            expression: {
              grant: 'script'
            }
          }]
        },
        {
          label: 'c_ref',
          name: 'c_ref',
          type: 'Reference',
          sourceObject: 'c_ctxapi_686_child',
          expandable: true,
          writeThrough: true,
          accessTransforms: [{
            name: 'expression',
            expression: {
              grant: 'script'
            }
          }]
        }
      ]
    }).execute()

    let inserts = ChildModel.insertMany([{ 'c_string': 'foo' }, { 'c_string': 'foo' }]).execute()

    Model.insertOne({ c_ref: inserts.insertedIds[0]._id }).execute()

  }))

  it('read using an expression access transform. ', sandboxed(function() {

    const should = require('should'),
          { org: { objects: { c_ctxapi_686: Model } } } = global,
          result = Model
            .find()
            .expand('c_ref', 'c_list')
            .limit(1)
            .next(),
          docs = [result.c_ref, ...result.c_list.data]

    for (const doc of docs) {
      should(doc.c_string).equal('foo')
      should(doc.access).equal(8)
    }

  }))

})
