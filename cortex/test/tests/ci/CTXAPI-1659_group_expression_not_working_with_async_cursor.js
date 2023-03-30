const _ = require('underscore'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Expression $group stage not working properly with async iterables', function() {
  let modifiedPaths

  before(async() => {
    /* global org, script */
    await promised(null, sandboxed(function() {
      global.org.objects.objects.insertOne({
        name: 'c_ctxapi_1659',
        label: 'c_ctxapi_1659',
        defaultAcl: ['owner.delete'],
        createAcl: ['account.public'],
        properties: [
          {
            name: 'c_age',
            label: 'c_age',
            type: 'Number',
            indexed: true
          }
        ]
      }).execute()

      org.objects.c_ctxapi_1659.insertMany([
        { c_age: 1 }, { c_age: 1 }, { c_age: 5 }, { c_age: 5 }, { c_age: 5 }, { c_age: 7 }, { c_age: 7 }
      ]).grant(6).execute()
    }))
  })

  after(sandboxed(function() {
    org.objects.objects.deleteOne({ name: 'c_ctxapi_1659' }).grant(8).execute()
  }))

  it('should group using an async iterator', async function() {
    const result = await promised(null, sandboxed(function() {
      const exp = [{
        $cursor: {
          object: 'c_ctxapi_1659',
          sort: {
            _id: 1
          }
        }
      }, {
        $group: {
          _id: '$$ROOT.c_age',
          total: {
            $sum: 1
          }
        }
      }]
      return require('expressions').pipeline.run(exp).toArray()
    }))

    should(_.sortBy(result, '_id')).deepEqual([
      {
        _id: 1,
        total: 2
      },
      {
        _id: 5,
        total: 3
      },
      {
        _id: 7,
        total: 2
      }
    ])
  })

  it('should group using an sync iterator', async() => {
    const result = await promised(null, sandboxed(function() {
      const exp = [{
        $group: {
          _id: '$$ROOT.c_age',
          total: {
            $sum: 1
          }
        }
      }]
      return require('expressions').pipeline.run(exp, [
        { c_age: 1 }, { c_age: 1 }, { c_age: 5 }, { c_age: 5 }, { c_age: 5 }, { c_age: 7 }, { c_age: 7 }
      ]).toArray()
    }))

    should(result).deepEqual([
      {
        _id: 1,
        total: 2
      },
      {
        _id: 5,
        total: 3
      },
      {
        _id: 7,
        total: 2
      }
    ])
  })
})
