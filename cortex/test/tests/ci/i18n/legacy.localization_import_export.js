'use strict'

/* global before, after */

const config = require('cortex-service/lib/config'),
      sandboxed = require('../../../lib/sandboxed')

describe('Features - Localization', function() {

  describe('CTXAPI-166', function() {

    before(function(callback) {
      config('debug')._instantReaping = config('debug').instantReaping
      config('debug').instantReaping = true
      config.flush()
      callback()
    })

    after(function(callback) {
      config('debug').instantReaping = config('debug')._instantReaping
      config.flush()
      callback()
    })

    before(sandboxed(function() {

      const attributes = {
        indexed: true,
        removable: true,
        localization: {
          enabled: true,
          strict: false,
          fallback: true,
          acl: [],
          fixed: '',
          valid: ['en_GB', 'en_US']
        }
      }

      org.objects.objects.insertOne({
        label: 'CTXAPI-166',
        name: 'c_ctxapi_166',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        uniqueKey: 'c_key',
        properties: [{
          name: 'c_key',
          label: 'Key',
          type: 'String',
          indexed: true,
          unique: true,
          validators: [{ name: 'customName' }]
        }, {
          name: 'c_string',
          label: 'String',
          type: 'String',
          ...attributes
        }, {
          name: 'c_strings',
          label: 'Strings',
          type: 'String',
          array: true,
          ...attributes
        }, {
          name: 'c_doc',
          label: 'Doc',
          type: 'Document',
          properties: [{
            name: 'c_string',
            label: 'String',
            type: 'String',
            ...attributes
          }, {
            name: 'c_strings',
            label: 'Strings',
            type: 'String',
            array: true,
            ...attributes
          }]
        }, {
          name: 'c_docs',
          label: 'Docs',
          type: 'Document',
          array: true,
          uniqueKey: 'c_key',
          properties: [{
            name: 'c_key',
            label: 'Key',
            type: 'String',
            validators: [{ name: 'customName' }, { name: 'uniqueInArray' }]
          }, {
            name: 'c_string',
            label: 'String',
            type: 'String',
            ...attributes
          }, {
            name: 'c_strings',
            label: 'Strings',
            type: 'String',
            array: true,
            ...attributes
          }]
        }]
      }).execute()

    }))

    it('export and import localizations', sandboxed(function() {

      /* global org, consts, script */

      require('should')

      script.locale = 'en_GB'

      for (let i = 0; i < 5; i += 1) {

        org.objects.c_ctxapi_166.insertOne({
          c_key: 'c_ctxapi_166_' + i,
          c_string: 'en_US' + i,
          c_strings: ['english us' + i],
          c_doc: {
            c_string: 'en_US' + i,
            c_strings: ['english us' + i]
          },
          c_docs: [{
            c_key: 'c_one' + i,
            c_string: 'en_US one' + i,
            c_strings: ['english us one' + i]
          }, {
            c_key: 'c_two' + i,
            c_string: 'en_US two' + i,
            c_strings: ['english us two' + i]
          }]
        }).locale('en_US').execute()

        org.objects.c_ctxapi_166.updateOne({
          c_key: 'c_ctxapi_166_' + i
        }, {
          $set: {
            c_string: 'en_GB' + i,
            c_strings: ['english gb' + i],
            c_doc: {
              c_string: 'en_GB',
              c_strings: ['english gb' + i]
            },
            c_docs: [{
              c_key: 'c_one' + i,
              c_string: 'en_GB one' + i,
              c_strings: ['english gb one' + i]
            }, {
              c_key: 'c_two' + i,
              c_string: 'en_GB two' + i,
              c_strings: ['english gb two' + i]
            }]
          }
        }).execute()

      }

      const docs = require('developer').environment.export({
        manifest: {
          c_ctxapi_166: {
            includes: ['*']
          },
          objects: [{
            name: 'c_ctxapi_166',
            includes: ['*']
          }]
        }
      }).toArray()

      docs.filter(v => v.object === 'c_ctxapi_166').length.should.equal(5)
      docs.filter(v => v.object === 'object').length.should.equal(1)

      // delete the object and wait a bit for reaping.
      org.objects.object.deleteOne({ name: 'c_ctxapi_166' }).execute()

      require('debug').sleep(1000)
      require('developer').environment.import(docs, { backup: false }).toArray()

      org.objects.c_ctxapi_166.count().should.equal(5)

    }))

  })

})
