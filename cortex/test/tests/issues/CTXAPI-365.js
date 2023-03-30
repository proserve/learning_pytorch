'use strict'

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-365 Write directly to locales', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      org.objects.objects.insertOne({
        label: 'c_ctxapi_365',
        name: 'c_ctxapi_365',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [
          {
            name: 'c_string',
            label: 'String',
            type: 'String',
            localization: {
              enabled: true,
              strict: false,
              fallback: true,
              acl: [],
              fixed: '',
              valid: ['en_GB', 'en_US']
            },
            validators: [
              {
                name: 'printableString',
                definition: {
                  min: 0,
                  max: 512,
                  anyFirstLetter: true
                }
              },
              {
                name: 'required'
              }]
          }]
      }).execute()
    }))
  })

  it('Should write to locales directly using the payload locale and not the query locale', sandboxed(function() {
    require('should')
    const firstResult = org.objects.c_ctxapi_365.insertOne({
            locales: {
              c_string: [{
                locale: 'en_GB',
                value: 'cheerio'
              }]
            }
          }).locale('en_GB').lean('modified').execute(),
          secondResult = org.objects.c_ctxapi_365.insertOne({
            locales: {
              c_string: [{
                locale: 'en_GB',
                value: 'cheerio'
              }]
            }
          }).locale('en_US').lean('modified').execute()

    firstResult.locales.should.deepEqual(secondResult.locales)
  }))
})
