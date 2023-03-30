'use strict'

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Issues - CTXAPI-605 - Namespaced props throw error on transforms', function() {

  before(sandboxed(function() {
    /* global org */
    const contextObject = 'c_ctxapi_605',
          {
            [contextObject]: Model,
            Objects
          } = org.objects

    if (Objects.find({ name: contextObject }).count() === 0) {

      Objects.insertOne({
        name: contextObject,
        label: 'CTXAPI-605 context object',
        defaultAcl: 'role.administrator.delete',
        createAcl: 'account.public',
        properties: [{
          name: 'ctx__label',
          label: 'Label',
          type: 'String',
          indexed: true,
          removable: true
        }]
      }).execute()
    }

    Model.insertMany([
      { ctx__label: 'Ardis' },
      { ctx__label: 'Jessika' },
      { ctx__label: 'Jess' },
      { ctx__label: 'Collete' },
      { ctx__label: 'Walt' }
    ]).execute()
  }))

  after(sandboxed(function() {
    org.objects.objects.deleteOne({ name: 'c_ctxapi_605' }).execute()
  }))

  it('should support namespaced props as source on transforms', async function() {

    const result = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_605.aggregate()
        .transform(`each(object)
          { return object.ctx__label }`).toArray()
    }))

    should.exist(result)
    should.equal(result.length, 5)
    should.equal(result[0], 'Ardis')
    should.equal(result[1], 'Jessika')
    should.equal(result[2], 'Jess')
    should.equal(result[3], 'Collete')
    should.equal(result[4], 'Walt')
  })

})
