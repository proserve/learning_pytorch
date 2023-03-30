'use strict'

/* global before, after */

/* global org */

const sandboxed = require('../../lib/sandboxed')

describe('Issues - Project on versioned objects', function() {

  describe('CTXAPI-177 - Project queries on versioned objects should be able to include version', function() {

    after(sandboxed(function() {
      org.objects.objects.deleteOne({
        name: 'c_ctxapi_177'
      }).execute()
    }))

    before(sandboxed(function() {

      org.objects.objects.insertOne({
        label: 'CTXAPI-177',
        name: 'c_ctxapi_177',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        isVersioned: true,
        properties: [{
          name: 'c_string',
          label: 'c_string',
          type: 'String',
          localization: {
            enabled: true
          }
        }, {
          name: 'c_number',
          label: 'c_number',
          type: 'Number'
        }, {
          name: 'c_boolean',
          label: 'c_boolean',
          type: 'Boolean'
        }]
      }).execute()
    }))

    it('should include version on project queries', sandboxed(function() {

      require('should')

      let _id, doc

      _id = org.objects.c_ctxapi_177.insertOne({
        c_string: 'String value',
        c_number: 42,
        c_boolean: true
      }).execute()

      doc = org.objects.c_ctxapi_177
        .aggregate()
        .match({ _id })
        .project({
          c_string: 1,
          c_number: 1,
          c_boolean: 1,
          version: 1
        })
        .next()

      doc.c_string.should.equal('String value')
      doc.c_number.should.equal(42)
      doc.c_boolean.should.equal(true)
      doc.version.should.equal(0)

      org.objects.c_ctxapi_177.updateOne({ _id }, {
        $set: {
          c_string: 'String value edited',
          c_number: 11,
          c_boolean: false,
          version: 0
        }
      }).execute()

      doc = org.objects.c_ctxapi_177
        .aggregate()
        .match({ _id })
        .project({
          c_string: 1,
          c_number: 1,
          c_boolean: 1,
          version: 1
        })
        .next()

      doc.c_string.should.equal('String value edited')
      doc.c_number.should.equal(11)
      doc.c_boolean.should.equal(false)
      doc.version.should.equal(1)

    }))
  })
})
