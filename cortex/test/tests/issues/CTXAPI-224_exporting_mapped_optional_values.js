'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-224 - Exporting optional properties not present in mapped instances.', function() {

  before(sandboxed(function() {

    /* global org */

    org.objects.objects.insertOne({
      label: 'CTXAPI-224 Ref',
      name: 'c_ctxapi_224_ref',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      uniqueKey: 'c_ref_key',
      properties: [
        {
          label: 'c_ref_key',
          name: 'c_ref_key',
          type: 'UUID',
          autoGenerate: true,
          indexed: true,
          unique: true,
          writable: false
        },
        {
          label: 'c_optional',
          name: 'c_optional',
          type: 'String',
          defaultValue: { type: 'static', value: 'foo' }
        }
      ]
    }).execute()

    org.objects.objects.insertOne({
      label: 'CTXAPI-224',
      name: 'c_ctxapi_224',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      uniqueKey: 'c_key',
      properties: [
        {
          label: 'c_key',
          name: 'c_key',
          type: 'UUID',
          autoGenerate: true,
          indexed: true,
          unique: true,
          writable: false
        },
        {
          label: 'c_ref',
          name: 'c_ref',
          type: 'Reference',
          sourceObject: 'c_ctxapi_224_ref'
        }
      ]
    }).execute()

  }))

  after(sandboxed(function() {

    /* global org */

    const { Objects } = org.objects
    Objects.deleteOne({ name: 'c_ctxapi_224' }).execute()
    Objects.deleteOne({ name: 'c_ctxapi_224_ref' }).execute()

  }))

  it('Exporting top-level instances include optional properties.', sandboxed(function() {

    /* global org */

    require('should')

    const { environment: { export: exportEnvironment } } = require('developer'),
          { c_ref_key: refKey } = org.objects.c_ctxapi_224_ref.insertOne({}).lean(false).execute(),
          manifest = {
            object: 'manifest',
            c_ctxapi_224_ref: {
              includes: [
                refKey
              ]
            }
          },
          array = exportEnvironment({ manifest }).toArray()

    array.find(v => v.c_ref_key === refKey).c_optional.should.equal('foo')

  }))

  it('Exporting mapped instances should include optional properties.', sandboxed(function() {

    /* global org */

    require('should')

    const { environment: { export: exportEnvironment } } = require('developer'),
          { c_ref_key: refKey, _id: refId } = org.objects.c_ctxapi_224_ref.insertOne({}).lean(false).execute(),
          { c_key: key } = org.objects.c_ctxapi_224.insertOne({ c_ref: refId }).lean(false).execute(),
          manifest = {
            object: 'manifest',
            c_ctxapi_224: {
              includes: [
                key
              ]
            }
          },
          array = exportEnvironment({ manifest }).toArray()

    array.find(v => v.c_ref_key === refKey).c_optional.should.equal('foo')

  }))

})
