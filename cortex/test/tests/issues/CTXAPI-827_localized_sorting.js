'use strict'
const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Issues - CTXAPI-827 - Localized sorting', function() {

  before(sandboxed(function() {

    /* global org */
    org.objects.objects.insertOne({
      label: 'Localized String',
      name: 'c_ctxapi_827_localized',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [{
        name: 'c_name',
        label: 'c_name',
        type: 'String',
        indexed: true,
        localization: {
          enabled: true,
          strict: false,
          fallback: false,
          fixed: ''
        }
      }, {
        name: 'c_number',
        label: 'c_number',
        type: 'Number',
        indexed: true
      }, {
        name: 'c_string',
        label: 'c_string',
        type: 'String',
        indexed: true
      }]
    }).execute()
  }))

  it('should sort results based on localized prop', async function() {
    let result

    result = await promised(null, sandboxed(function() {
      let instances
      const { c_ctxapi_827_localized: Model } = org.objects

      instances = Model.insertMany([{
        c_name: 'test_insert_many1',
        c_number: 465,
        c_string: 'Z'
      }, {
        c_name: 'test_insert_many2',
        c_number: 68,
        c_string: 'A'
      }, {
        c_name: 'test_insert_many3',
        c_number: -33,
        c_string: 'Q'
      }, {
        c_name: 'test_insert_many4',
        c_number: 0,
        c_string: 'G'
      }]).execute()

      Model.updateOne({ _id: instances.insertedIds[3]._id }, {
        $set: {
          c_name: 'aaa_value'
        }
      }).locale('fr_FR').execute()

      return {
        localizedAsc: Model.find().sort({ c_name: 1 }).paths('c_name', 'c_number', 'c_string').toArray(),
        localizedDesc: Model.find().sort({ c_name: -1 }).paths('c_name', 'c_number', 'c_string').toArray(),
        numberAsc: Model.find().sort({ c_number: 1 }).paths('c_name', 'c_number', 'c_string').toArray(),
        numberDesc: Model.find().sort({ c_number: -1 }).paths('c_name', 'c_number', 'c_string').toArray(),
        nonLocalizedAsc: Model.find().sort({ c_string: 1 }).paths('c_name', 'c_number', 'c_string').toArray(),
        nonLocalizedDesc: Model.find().sort({ c_string: -1 }).paths('c_name', 'c_number', 'c_string').toArray()
      }
    }))

    should.exist(result)
    should.exist(result.localizedAsc)
    should.exist(result.localizedDesc)
    should.exist(result.numberAsc)
    should.exist(result.numberDesc)
    should.exist(result.nonLocalizedAsc)
    should.exist(result.nonLocalizedDesc)

    result.localizedAsc.should.containDeepOrdered([{
      c_name: 'test_insert_many1',
      c_number: 465,
      c_string: 'Z',
      object: 'c_ctxapi_827_localized'
    }, {
      c_name: 'test_insert_many2',
      c_number: 68,
      c_string: 'A',
      object: 'c_ctxapi_827_localized'
    }, {
      c_name: 'test_insert_many3',
      c_number: -33,
      c_string: 'Q',
      object: 'c_ctxapi_827_localized'
    }, {
      c_name: 'test_insert_many4',
      c_number: 0,
      c_string: 'G',
      object: 'c_ctxapi_827_localized'
    }])

    result.localizedDesc.should.containDeepOrdered([
      {
        c_name: 'test_insert_many4',
        c_number: 0,
        c_string: 'G',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many3',
        c_number: -33,
        c_string: 'Q',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many2',
        c_number: 68,
        c_string: 'A',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many1',
        c_number: 465,
        c_string: 'Z',
        object: 'c_ctxapi_827_localized'
      }
    ])

    result.numberAsc.should.containDeepOrdered([
      {
        c_name: 'test_insert_many3',
        c_number: -33,
        c_string: 'Q',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many4',
        c_number: 0,
        c_string: 'G',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many2',
        c_number: 68,
        c_string: 'A',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many1',
        c_number: 465,
        c_string: 'Z',
        object: 'c_ctxapi_827_localized'
      }
    ])

    result.numberDesc.should.containDeepOrdered([
      {
        c_name: 'test_insert_many1',
        c_number: 465,
        c_string: 'Z',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many2',
        c_number: 68,
        c_string: 'A',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many4',
        c_number: 0,
        c_string: 'G',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many3',
        c_number: -33,
        c_string: 'Q',
        object: 'c_ctxapi_827_localized'
      }
    ])

    result.nonLocalizedAsc.should.containDeepOrdered([
      {
        c_name: 'test_insert_many2',
        c_number: 68,
        c_string: 'A',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many4',
        c_number: 0,
        c_string: 'G',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many3',
        c_number: -33,
        c_string: 'Q',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many1',
        c_number: 465,
        c_string: 'Z',
        object: 'c_ctxapi_827_localized'
      }
    ])

    result.nonLocalizedDesc.should.containDeepOrdered([
      {
        c_name: 'test_insert_many1',
        c_number: 465,
        c_string: 'Z',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many3',
        c_number: -33,
        c_string: 'Q',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many4',
        c_number: 0,
        c_string: 'G',
        object: 'c_ctxapi_827_localized'
      },
      {
        c_name: 'test_insert_many2',
        c_number: 68,
        c_string: 'A',
        object: 'c_ctxapi_827_localized'
      }
    ])
  })
})
