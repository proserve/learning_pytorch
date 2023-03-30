'use strict'

/* global before */

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      { promised, sleep } = require('../../../lib/utils')

let Undefined

describe('Features - Localization', function() {

  describe('CTXAPI-170 - reaping localized data and properties', function() {

    before(sandboxed(function() {

      org.objects.objects.insertOne({
        label: 'CTXAPI-170',
        name: 'c_ctxapi_170',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [{
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
            localization: {
              enabled: true
            }
          }]
        }]
      }).execute()

    }))

    it('removing parent docs should remove all localizations', sandboxed(function() {

      /* global org, consts, script */

      require('should')

      script.locale = 'en_GB'

      let doc, _id

      _id = org.objects.c_ctxapi_170.insertOne({
        c_docs: [{
          c_key: 'c_one',
          c_string: 'en_US one'
        }, {
          c_key: 'c_two',
          c_string: 'en_US two'
        }]
      }).locale('en_US').execute()

      org.objects.c_ctxapi_170.updateOne({ _id }, {
        $set: {
          c_docs: [{
            c_key: 'c_one',
            c_string: 'en_GB one'
          }, {
            c_key: 'c_two',
            c_string: 'en_GB two'
          }]
        }
      }).execute()

      org.objects.c_ctxapi_170.updateOne({ _id }, {
        $pull: {
          c_docs: ['c_one']
        }
      }).execute()

      doc = org.objects.c_ctxapi_170.find({ _id }).include('locales').next()

      doc.c_docs.length.should.equal(1)
      doc.locales.c_docs.length.should.equal(1)

    }))

    it('removing a property should remove all locale document data in history and in-document', async() => {

      require('should')

      let done = false, err = null, result, model, _id

      const name = 'c_ctxapi_170_reap',
            principal = server.principals.admin,
            org = principal.org,
            ObjectModel = await promised(org, 'createObject', 'object'),
            def = {
              label: 'CTXAPI-170a',
              name,
              defaultAcl: 'owner.delete',
              createAcl: 'account.public',
              properties: [{
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
                  localization: {
                    enabled: true
                  }
                }, {
                  name: 'c_strings',
                  array: true,
                  label: 'String',
                  type: 'String',
                  localization: {
                    enabled: true
                  }
                }]
              }]
            },
            testId = server.mochaCurrentTestUuid,
            handler = (message, e) => {
              if (message.mochaCurrentTestUuid === testId) {
                done = true
                err = e
              }
            }

      await promised(ObjectModel, 'aclCreate', principal, def)
      model = await promised(org, 'createObject', name)
      _id = (await promised(model, 'aclCreate', principal, {
        c_docs: [{
          c_key: 'c_one',
          c_string: 'one',
          c_strings: ['one']
        }, {
          c_key: 'c_two',
          c_string: 'two',
          c_strings: ['two']
        }]
      })).ac.subjectId

      server.events.on('worker.done', handler)
      await promised(
        ObjectModel,
        'aclPatch',
        principal,
        { name },
        [{ op: 'remove', path: `properties.c_docs.properties.c_strings` }]
      )

      while (1) {
        if (done) {
          break
        }
        await sleep(250)
      }

      server.events.removeListener('worker.done', handler)

      if (err) {
        throw err
      }

      result = await model.collection.find({ _id }).next()

      for (const doc of result.c_docs) {
        (doc.c_strings === Undefined).should.be.true()
      }
      for (const doc of result.locales.c_docs) {
        (doc.c_strings === Undefined).should.be.true()
      }

    })

    it('removing a property in an object type should remove all locale document data in history and in-document', async() => {

      require('should')

      let done = false, err = null, result, model, _id

      const name = 'c_ctxapi_170_reap_type',
            principal = server.principals.admin,
            org = principal.org,
            ObjectModel = await promised(org, 'createObject', 'object'),
            def = {
              label: 'CTXAPI-170b',
              name,
              defaultAcl: 'owner.delete',
              createAcl: 'account.public',
              objectTypes: [{
                name: 'c_a',
                label: 'Type A',
                properties: [{
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
                    localization: {
                      enabled: true
                    }
                  }, {
                    name: 'c_strings',
                    array: true,
                    label: 'String',
                    type: 'String',
                    localization: {
                      enabled: true
                    }
                  }]
                }]
              }]
            },
            testId = server.mochaCurrentTestUuid,
            handler = (message, e) => {
              if (message.mochaCurrentTestUuid === testId) {
                done = true
                err = e
              }
            }

      await promised(ObjectModel, 'aclCreate', principal, def)
      model = await promised(org, 'createObject', name)
      _id = (await promised(model, 'aclCreate', principal, {
        type: 'c_a',
        c_docs: [{
          c_key: 'c_one',
          c_string: 'one',
          c_strings: ['one']
        }, {
          c_key: 'c_two',
          c_string: 'two',
          c_strings: ['two']
        }]
      })).ac.subjectId

      server.events.on('worker.done', handler)
      await promised(
        ObjectModel,
        'aclPatch',
        principal,
        { name },
        [{ op: 'remove', path: `objectTypes.c_a.properties.c_docs.properties.c_strings` }]
      )

      while (1) {
        if (done) {
          break
        }
        await sleep(250)
      }
      server.events.removeListener('worker.done', handler)

      if (err) {
        throw err
      }

      result = await model.collection.find({ _id }).next()

      for (const doc of result.c_docs) {
        (doc.c_strings === Undefined).should.be.true()
      }
      for (const doc of result.locales.c_docs) {
        (doc.c_strings === Undefined).should.be.true()
      }

    })

  })

})
