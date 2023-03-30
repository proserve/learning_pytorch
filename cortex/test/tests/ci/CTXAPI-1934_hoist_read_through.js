'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-1934 - Hoist with read through', function() {

  before(sandboxed(function() {

    const {
      org: {
        objects: {
          Objects,
          c_ctxapi_1934: Model,
          c_ctxapi_1934_child: ChildModel
        }
      }
    } = global

    Objects.insertOne({
      label: 'c_ctxapi_1934_child',
      name: 'c_ctxapi_1934_child',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [{
        label: 'c_string',
        name: 'c_string',
        type: 'String'
      }]
    }).execute()

    Objects.insertOne({
      label: 'c_ctxapi_1934',
      name: 'c_ctxapi_1934',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [
        {
          label: 'c_list',
          name: 'c_list',
          type: 'List',
          sourceObject: 'c_ctxapi_1934_child',
          readThrough: true,
          writeThrough: true,
          hoistList: true
        }
      ]
    }).execute()

    ChildModel.insertMany([{ 'c_string': 'foo' }, { 'c_string': 'foo' }]).execute()
    Model.insertOne({}).execute()

  }))

  after(sandboxed(function() {

    const { Objects } = org.objects

    Objects.deleteOne({ name: 'c_ctxapi_1934' }).execute()
    Objects.deleteOne({ name: 'c_ctxapi_1934_child' }).execute()
  }))

  it('hoist readthrough list. ', sandboxed(function() {

    const should = require('should'),
          { org: { objects: { c_ctxapi_1934: Model } } } = global,
          result = Model
            .find()
            .expand('c_list')
            .limit(1)
            .next()

    for (const doc of result.c_list) {
      should(doc.c_string).equal('foo')
    }

  }))
})
