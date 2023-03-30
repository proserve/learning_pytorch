'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Features', function() {

  describe('Unique key', function() {

    before(sandboxed(function() {

      /* global org, consts */

      org.objects.objects.insertOne({
        label: 'CTXAPI-uniqueKey',
        name: 'c_ctxapi_uniquekey',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        uniqueKey: 'c_name',
        properties: [
          {
            label: 'Name',
            name: 'c_name',
            type: 'String',
            unique: true,
            indexed: true,
            validators: [{
              name: 'customName'
            }]
          },
          {
            label: 'Docs',
            name: 'c_docs_uuid',
            type: 'Document',
            array: true,
            uniqueKey: 'c_key',
            properties: [{
              label: 'Key',
              name: 'c_key',
              type: 'UUID',
              autoGenerate: true,
              uuidVersion: 4,
              writable: true,
              indexed: true,
              validators: [{
                name: 'uniqueInArray'
              }]
            }]
          },
          {
            label: 'Docs',
            name: 'c_docs_string',
            type: 'Document',
            array: true,
            uniqueKey: 'c_key',
            properties: [{
              label: 'Key',
              name: 'c_key',
              type: 'String',
              validators: [{
                name: 'customName'
              }, {
                name: 'uniqueInArray'
              }]
            }]
          }
        ],
        objectTypes: [
          {
            label: 'Dog',
            name: 'c_dog',
            properties: [
              {
                label: 'Doc',
                name: 'c_type_doc',
                type: 'Document',
                array: true,
                uniqueKey: 'c_key',
                properties: [{
                  label: 'Key',
                  name: 'c_key',
                  type: 'UUID',
                  autoGenerate: true,
                  uuidVersion: 4,
                  writable: true,
                  validators: [{
                    name: 'uniqueInArray'
                  }]
                }]
              }
            ]
          },
          {
            label: 'Cat',
            name: 'c_cat',
            properties: [
              {
                label: 'Doc',
                name: 'c_type_doc',
                type: 'Document',
                array: true,
                uniqueKey: 'c_key',
                properties: [{
                  label: 'Key',
                  name: 'c_key',
                  type: 'String',
                  validators: [{
                    name: 'required'
                  }, {
                    name: 'customName'
                  }, {
                    name: 'uniqueInArray'
                  }]
                }]
              }
            ]
          }
        ]
      }).execute()

    }))

    it('catch incorrectly configured unique keys', sandboxed(function() {

      /* global org, consts */

      require('should')

      const { tryCatch } = require('util.values'),
            pathTo = require('util.paths.to')

      function expectValidationError(err, path = 'object.uniqueKey', code = 'kInvalidArgument') {
        if (pathTo(err, 'errCode') === 'cortex.invalidArgument.validation' &&
          pathTo(err, 'faults.0.code') === code &&
          pathTo(err, 'faults.0.path') === path
        ) {
          return true
        }
        throw err
      }

      // remove unique key for configured exports
      tryCatch(() => {
        org.objects.objects.updateOne(
          { name: 'c_ctxapi_uniquekey' },
          { $pull: { properties: ['c_name'] } }
        ).execute()
      }, err => expectValidationError(err))

      tryCatch(() => {
        org.objects.objects.updateOne(
          { name: 'c_ctxapi_uniquekey' },
          { $pull: { 'properties.c_docs_uuid.properties': ['c_key'] } }
        ).execute()
      }, err => expectValidationError(err, 'object.properties[]#Document.uniqueKey'))

      tryCatch(() => {
        org.objects.objects.updateOne(
          { name: 'c_ctxapi_uniquekey' },
          { $pull: { 'objectTypes.c_dog.properties.c_type_doc.properties': ['c_key'] } }
        ).execute()
      }, err => expectValidationError(err, 'object.objectTypes[].properties[]#Document.uniqueKey'))

      // change dependent properties.
      tryCatch(() => {
        org.objects.objects.updateOne(
          { name: 'c_ctxapi_uniquekey' },
          { $set: { properties: { name: 'c_name', unique: false } } }
        ).execute()
      }, err => expectValidationError(err))

      tryCatch(() => {
        org.objects.objects.updateOne(
          { name: 'c_ctxapi_uniquekey' },
          { $set: { properties: { name: 'c_docs_uuid', properties: { name: 'c_key', validators: [] } } } }
        ).lean(false).execute()
      }, err => expectValidationError(err, 'object.properties[]#Document.uniqueKey'))

      tryCatch(() => {
        org.objects.objects.updateOne(
          { name: 'c_ctxapi_uniquekey' },
          { $set: { properties: { name: 'c_docs_string', properties: { name: 'c_key', localization: { enabled: true } } } } }
        ).lean(false).execute()
      }, err => expectValidationError(err, 'object.properties[]#Document.uniqueKey'))

    }))

    it('export using unique keys', sandboxed(function() {

      /* global org, consts */

      require('should')

      org.objects.c_ctxapi_uniquekey.deleteMany({}).execute()

      org.objects.c_ctxapi_uniquekey.insertMany([{
        type: 'c_dog',
        c_name: 'c_one',
        c_docs_uuid: [{}, {}, {}],
        c_docs_string: [{ c_key: 'c_foo' }, { c_key: 'c_bar' }, { c_key: 'c_baz' }],
        c_type_doc: [{}, {}, {}]
      }, {
        type: 'c_cat',
        c_name: 'c_two',
        c_docs_uuid: [{}, {}, {}],
        c_docs_string: [{ c_key: 'c_who' }, { c_key: 'c_are' }, { c_key: 'c_you' }],
        c_type_doc: [{ c_key: 'c_a' }, { c_key: 'c_b' }, { c_key: 'c_c' }]
      }]).execute()

      const docs = require('developer').environment.export({
        manifest: {
          c_ctxapi_uniquekey: {
            includes: ['*']
          }
        }
      }).filter(v => v.object === 'c_ctxapi_uniquekey')

      docs.length.should.equal(2)

      let doc = docs.find(v => v.c_name === 'c_one')

      doc.c_docs_string.length.should.equal(3)
      doc.c_docs_uuid.length.should.equal(3)
      doc.c_type_doc.length.should.equal(3)

      doc = docs.find(v => v.c_name === 'c_two')

      doc.c_type_doc.length.should.equal(3)

    }))

    it('manipulating documents using unique keys', sandboxed(function() {

      /* global org, consts */

      require('should')

      org.objects.c_ctxapi_uniquekey.deleteMany({}).execute()

      org.objects.c_ctxapi_uniquekey.insertOne({
        type: 'c_dog',
        c_name: 'c_one',
        c_docs_uuid: [{}, {}, {}],
        c_docs_string: [{ c_key: 'c_foo' }, { c_key: 'c_bar' }, { c_key: 'c_baz' }],
        c_type_doc: [{}, {}, {}]
      }).execute()

      const doc = org.objects.c_ctxapi_uniquekey.updateOne({
        type: 'c_dog',
        c_name: 'c_one'
      }, {
        $pull: {
          c_docs_string: ['c_foo']
        }
      }).lean(false).execute()

      doc.c_docs_string.length.should.equal(2)

    }))

  })

})
