'use strict'

/* global before */

const sandboxed = require('../../lib/sandboxed')

describe('Features - Localization', function() {

  describe('CTXAPI-163 - locale option support', function() {

    before(sandboxed(function() {

      /* global org */

      org.objects.objects.insertOne({
        label: 'CTXAPI-163',
        name: 'c_ctxapi_163',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          name: 'c_string',
          label: 'c_string',
          type: 'String',
          localization: {
            enabled: true
          }
        }]
      }).execute()

      org.objects.objects.updateOne({
        name: 'c_ctxapi_163'
      }, {
        $push: {
          properties: [{
            name: 'c_list',
            label: 'c_list',
            type: 'List',
            readThrough: true,
            writeThrough: true,
            sourceObject: 'c_ctxapi_163'
          }, {
            name: 'c_ref',
            label: 'c_ref',
            type: 'Reference',
            expandable: true,
            writeThrough: true,
            sourceObject: 'c_ctxapi_163'
          }]
        }
      }).execute()

    }))

    it('reading and writing through references and lists', sandboxed(function() {

      /* global org, script */

      require('should')

      script.locale = 'en_US'

      let _id, doc, obj

      _id = org.objects.c_ctxapi_163.insertOne({
        locales: {
          c_string: [{
            locale: 'en_US',
            value: 'en_US'
          }, {
            locale: 'en_GB',
            value: 'en_GB'
          }]
        }
      }).execute()

      org.objects.c_ctxapi_163.updateOne({ _id }, {
        $set: {
          c_ref: _id
        }
      }).execute()

      doc = org.objects.c_ctxapi_163
        .aggregate()
        .match({ _id })
        .project({
          c_ref: {
            $expand: ['c_string']
          },
          c_list: {
            // lists can specify new locale option
            $expand: {
              locale: 'en_US',
              paths: ['c_string']
            }
          },
          c_string: 1
        })
        .locale('en_GB')
        .next()

      doc.c_string.should.equal('en_GB')
      doc.c_ref.c_string.should.equal('en_GB')
      doc.c_list.data[0].c_string.should.equal('en_US')

      obj = new org.objects.c_ctxapi_163({ _id })

      // reference write-through test
      obj.update('c_ref/c_string', 'uk', { locale: 'en_GB' })
      org.objects.c_ctxapi_163.find({ _id }).locale('en_GB').next().c_string.should.equal('uk')

      // list write through test.
      obj.update(`c_ref/c_list/${_id}/c_string`, 'québec', { locale: 'fr_CA' })
      org.objects.c_ctxapi_163.find({ _id }).locale('fr_CA').next().c_string.should.equal('québec')

    }))

  })

})
