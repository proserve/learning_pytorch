'use strict'

const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      { v4 } = require('uuid')

describe('Issues - CTXAPI-1066 uniqueKeys for doc arrays in locales', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      org.objects.objects.insertOne({
        label: 'c_ctxapi_1066',
        name: 'c_ctxapi_1066',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [
          {
            name: 'c_my_doc',
            label: 'my document',
            type: 'Document',
            uniqueKey: 'c_key',
            array: true,
            properties: [
              {
                name: 'c_string',
                label: 'My String',
                type: 'String',
                indexed: true,
                removable: true,
                localization: {
                  enabled: true,
                  strict: false,
                  fallback: true
                }
              },
              {
                name: 'c_key',
                label: 'key',
                type: 'UUID',
                autoGenerate: true,
                uuidVersion: 4,
                validators: [
                  {
                    name: 'uniqueInArray'
                  }
                ],
                writable: true
              }
            ]
          }
        ]
      }).execute()

      org.objects.c_ctxapi_1066.insertOne({
        c_my_doc: [
          {
            c_string: 'test 1'
          },
          {
            c_string: 'test 2'
          }
        ]
      }).execute()

    }))
  })

  it('updating a uniqueKey of a document array with localized properties is not being updated in locales', async function() {
    const newKey = v4(),
          result = await promised(null, sandboxed(function() {
            /* global org, script */
            const doc = org.objects.c_ctxapi_1066.find().next(),
                  oldDoc = doc.c_my_doc[0],
                  newKey = script.arguments
            // update key
            org.objects.c_ctxapi_1066.updateOne({ _id: doc._id }, { $set: { 'c_my_doc': { _id: oldDoc._id, c_key: newKey } } }).execute()
            return org.objects.c_ctxapi_1066.find({ _id: doc._id }).include('locales').next()
          }, {
            runtimeArguments: newKey
          }))
    should(result.c_my_doc[0].c_key).equal(newKey)
    should(result.locales.c_my_doc[0].c_key).equal(newKey)

  })

})
