'use strict'

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      should = require('should'),
      moment = require('moment')

describe('CTXAPI-527 - Date only field', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      org.objects.objects.insertOne({
        name: 'c_test_date',
        label: 'c_test_date',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'c_key',
          name: 'c_key',
          type: 'String',
          indexed: true
        }, {
          label: 'c_date',
          name: 'c_date',
          dateOnly: true,
          indexed: true,
          type: 'Date'
        }]
      }).execute()
    }))
  })

  it('should create only date part and query should work with date part only', async() => {

    const result = await promised(null, sandboxed(function() {
      let plainObj, queryObj
      const moment = require('moment')

      org.objects.c_test_date.insertOne({
        c_key: '1',
        c_date: moment().startOf('day').subtract(11, 'days')
      }).execute()

      plainObj = org.objects.c_test_date.find({ c_key: '1' }).next()
      queryObj = org.objects.c_test_date.find({ c_key: '1', c_date: moment().startOf('day').subtract(11, 'days').format() }).next()

      return { plainObj, queryObj }
    }))

    should.equal(result.plainObj.c_date, moment().subtract(11, 'days').format('YYYY-MM-DD'))
    should.exist(result.queryObj)
    should.equal(result.queryObj.c_date, result.plainObj.c_date)

  })

  it('should create only date part with tz and query should work with date part only', async() => {

    const result = await promised(null, sandboxed(function() {
      let plainObj, queryObj
      const moment = require('moment.timezone')

      org.objects.c_test_date.insertOne({
        c_key: '2',
        c_date: moment().tz('Australia/Sydney').subtract(5, 'days').format()
      }).execute()

      plainObj = org.objects.c_test_date.find({ c_key: '2' }).next()
      queryObj = org.objects.c_test_date.find({ c_key: '2', c_date: moment().tz('Australia/Sydney').subtract(5, 'days').format() }).next()

      return { plainObj, queryObj }
    }))

    should.equal(result.plainObj.c_date, moment().tz('Australia/Sydney').subtract(5, 'days').format('YYYY-MM-DD'))
    should.exist(result.queryObj)
    should.equal(result.queryObj.c_date, result.plainObj.c_date)

  })

})
