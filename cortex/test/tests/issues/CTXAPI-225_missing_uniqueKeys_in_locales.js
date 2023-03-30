'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-225 - uniqueKey not present for document array elements in locales object under export.', function() {

  before(sandboxed(function() {

    /* global org */

    const { Objects } = org.objects

    Objects.insertOne({
      label: 'CTXAPI-225',
      name: 'c_ctxapi_225',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      uniqueKey: 'c_key',
      properties: [
        { name: 'c_key', label: 'c_key', uuidVersion: 4, autoGenerate: true, type: 'UUID', indexed: true, unique: true },
        { name: 'c_loc_document',
          label: 'c_loc_document',
          type: 'Document',
          array: true,
          uniqueKey: 'c_key',
          properties: [
            { name: 'c_key', label: 'c_key', type: 'UUID', autoGenerate: true, uuidVersion: 4, writable: true, validators: [{ name: 'uniqueInArray' }], optional: false },
            { label: 'Loc String', name: 'c_loc_string', type: 'String', indexed: true, localization: { enabled: true } }
          ]
        }
      ]
    }).execute()

  }))

  after(sandboxed(function() {

    /* global org */

    const { Objects } = org.objects
    Objects.deleteOne({ name: 'c_ctxapi_225' }).execute()

  }))

  it('Exported localized document arrays should include key.', sandboxed(function() {

    /* global org */

    require('should')

    const should = require('should'),
          { c_ctxapi_225: Model } = org.objects,
          { environment: { export: exportEnvironment } } = require('developer'),
          { c_key: uniqueKey } = Model.insertOne({
            c_loc_document: [
              {
                c_loc_string: 'item one loc'
              },
              {
                c_loc_string: 'item two loc'
              },
              {
                c_loc_string: 'item three loc'
              }
            ]
          }).lean(false).execute(),
          instance = exportEnvironment({
            manifest: {
              c_ctxapi_225: {
                includes: [uniqueKey]
              }
            }
          }).toArray()[0]

    should.exist(instance)

    instance.c_loc_document.forEach((doc, i) => {
      instance.locales.c_loc_document[i].c_key.should.equal(doc.c_key)
    })

  }))

})
