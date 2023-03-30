'use strict'

require('should')

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-346 - Adding transform to cursor changes the value of hasMore', function() {

  before(sandboxed(function() {

    /* global org */

    const { Objects, c_ctxapi_346: Model } = org.objects

    Objects.insertOne({
      label: 'c_ctxapi_346',
      name: 'c_ctxapi_346',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      shareAcl: []
    }).execute()

    Model.insertMany(new Array(10).fill({})).execute()

  }))

  it('transformed cursor with hasMore matching original cursor.', async() => {

    let cursor

    cursor = await promised(null, sandboxed(function() {

      /* global org */

      const { c_ctxapi_346: Model } = org.objects
      return Model.find().limit(1)
    }))

    await promised(cursor, 'forEach', () => {})
    cursor.hasMore().should.be.true()

    cursor = await promised(null, sandboxed(function() {

      /* global org */

      const { c_ctxapi_346: Model } = org.objects
      return Model.find().limit(1).transform(`
        each(obj) {
          return obj.created     
        }
      `)
    }))

    await promised(cursor, 'forEach', () => {})
    cursor.hasMore().should.be.true()

  })

})
