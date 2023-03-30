'use strict'

const sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      { promised } = require('../../../../lib/utils')

describe('Feature - do not export locales if useBundles is true', function() {

  before(async() => {
    // create some bundles
    await promised(null, sandboxed(function() {
      // create i18n objects to then after create the bundles.
      global.org.objects.i18n.insertMany([
        {
          locale: 'en_US',
          namespace: 'cortex1',
          name: 'test__en_US_cortex1',
          data: {
            object: {
              c_test_exports_i18n: {
                label: 'Test i18n',
                description: 'Testing i18n bundles',
                properties: {
                  c_key: {
                    label: 'Key',
                    description: ''
                  }
                }
              }
            }
          }
        },
        {
          locale: 'es_ES',
          namespace: 'cortex1',
          name: 'test__es_ES_cortex1',
          data: {
            object: {
              c_test_exports_i18n: {
                label: 'Prueba i18n',
                description: 'Probando paquetes i18n',
                properties: {
                  c_key: {
                    label: 'Llave',
                    description: ''
                  }
                }
              }
            }
          }
        }
      ]).skipAcl().grant(8).execute()

      const i18n = require('i18n')
      i18n.buildBundles()

      global.org.objects.object.insertOne({
        localized: true,
        useBundles: true,
        name: 'c_test_exports_i18n',
        label: 'c_test_exports_i18n',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        uniqueKey: 'c_key',
        properties: [{
          name: 'c_key',
          label: 'c_key',
          uuidVersion: 4,
          autoGenerate: true,
          type: 'UUID',
          indexed: true,
          unique: true
        }],
        locales: {
          description: [
            {
              'locale': 'en_US',
              'value': 'testing i18n bundles'
            },
            {
              'locale': 'es_ES',
              'value': 'testing i18n bundles es'
            }
          ]
        }
      }).execute()

      global.org.objects.object.insertOne({
        localized: true,
        useBundles: false,
        name: 'c_test_exports_i18n_ub_false',
        label: 'c_test_exports_i18n_ub_false',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        uniqueKey: 'c_key',
        properties: [{
          name: 'c_key',
          label: 'c_key',
          uuidVersion: 4,
          autoGenerate: true,
          type: 'UUID',
          indexed: true,
          unique: true
        }],
        locales: {
          description: [
            {
              'locale': 'en_US',
              'value': 'testing i18n bundles should exist'
            },
            {
              'locale': 'es_ES',
              'value': 'testing i18n bundles es should exist'
            }
          ]
        }
      }).execute()
    }))
  })

  after(async() => {
    // delete bundles / i18n objects.
    await promised(null, sandboxed(function() {
      const action1 = global.org.objects.objects.deleteMany({ name: 'c_test_exports_i18n' }).skipAcl().grant(8).execute(),
            action2 = global.org.objects.objects.deleteMany({ name: 'c_test_exports_i18n_ub_false' }).skipAcl().grant(8).execute(),
            action3 = global.org.objects.i18n.deleteMany().skipAcl().grant(8).execute(),
            action4 = global.org.objects.i18nbundle.deleteMany().skipAcl().grant(8).execute()
      return [action1, action2, action3, action4]
    }))
  })

  it('should not export locales for objects if useBundles is true', async function() {
    const result = await promised(null, sandboxed(function() {
      const { environment: { export: exportEnvironment } } = require('developer')
      let manifest = {
        object: 'manifest',
        objects: [
          { includes: ['*'], name: 'c_test_exports_i18n' }
        ]
      }
      return exportEnvironment({ manifest }).toArray()
    }))

    should.not.exist(result[0].locales)
  })

  it('should export locales for objects if useBundles is false', async function() {
    const result = await promised(null, sandboxed(function() {
      const { environment: { export: exportEnvironment } } = require('developer')
      let manifest = {
        object: 'manifest',
        objects: [
          { includes: ['*'], name: 'c_test_exports_i18n_ub_false' }
        ]
      }
      return exportEnvironment({ manifest }).toArray()
    }))

    should.exist(result[0].locales)
  })
})
