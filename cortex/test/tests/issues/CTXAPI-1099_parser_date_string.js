'use strict'

const should = require('should'),

      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-1099 parser date string', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      const moment = require('moment')
      /* global org */
      org.objects.objects.insertOne({
        label: 'c_ctxapi_date_string',
        name: 'c_ctxapi_date_string',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [
          {
            name: 'c_my_date',
            label: 'my date',
            type: 'Date'
          }
        ]
      }).execute()

      org.objects.c_ctxapi_date_string.insertOne({
        c_my_date: moment.utc('2021-11-09T23:15:00.000Z').toDate()
      }).execute()

    }))
  })

  it('should return date formatted', async function() {
    const result = await promised(null, sandboxed(function() {
      /* global org */
      return org.objects.c_ctxapi_date_string.aggregate([
        {
          $project: {
            'original': {
              $dateToString: [
                '%d/%m/%G',
                'c_my_date'
              ]
            },
            'asia': {
              $dateToString: [
                '%d/%m/%G',
                'c_my_date',
                'Asia/Seoul'
              ]
            }
          }
        }
      ]).toArray()
    }))
    should(result[0].original).equal('09/11/2021')
    should(result[0].asia).equal('10/11/2021')

  })

})
