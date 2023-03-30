'use strict'

const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-547 Regex error when localized', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      org.objects.objects.insertOne({
        name: 'c_ctxapi_547',
        label: 'CTXAPI-547 Regex',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          name: 'c_name',
          label: 'c_name',
          type: 'String',
          indexed: true,
          removable: true,
          localization: {
            enabled: true,
            strict: false,
            fallback: true
          }
        }]
      }).execute()

      let _id = org.objects.c_ctxapi_547.insertOne({
        c_name: 'La Panaderia'
      }).locale('es_AR').execute()

      org.objects.c_ctxapi_547.updateOne({ _id }, {
        $set: {
          c_name: 'The Bakery'
        }
      }).locale('en_US').execute()

      _id = org.objects.c_ctxapi_547.insertOne({
        c_name: 'La Torre'
      }).locale('es_AR').execute()

      org.objects.c_ctxapi_547.updateOne({ _id }, {
        $set: {
          c_name: 'The Tower'
        }
      }).locale('en_US').execute()

    }))
  })

  it('should return data when use regex on localized prop', async() => {

    const result = await promised(null, sandboxed(function() {
      const laEsAr = org.objects.c_ctxapi_547.find({
              c_name: {
                $regex: /^La/i
              }
            }).engine('stable').locale('es_AR').toArray(),
            theEnUs = org.objects.c_ctxapi_547.find({
              c_name: {
                $regex: /^Th/i
              }
            }).engine('stable').locale('en_US').toArray(),
            laEsArLatest = org.objects.c_ctxapi_547.find({
              c_name: {
                $regex: /^La/i
              }
            }).engine('latest').locale('es_AR').toArray(),
            theEnUsLatest = org.objects.c_ctxapi_547.find({
              c_name: {
                $regex: /^Th/i
              }
            }).engine('latest').locale('en_US').toArray()
      return { laEsAr, theEnUs, laEsArLatest, theEnUsLatest }
    }))

    should.equal(result.laEsAr.length, 2)
    should.equal(result.theEnUs.length, 2)
    should.equal(result.laEsArLatest.length, 2)
    should.equal(result.theEnUsLatest.length, 2)

  })

})
