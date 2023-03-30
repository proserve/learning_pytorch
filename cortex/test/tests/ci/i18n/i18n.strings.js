const server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      { waitForWorker } = require('../../../lib/utils')(),
      should = require('should')

describe('String translations using i18n bundles', function() {

  before(async() => {
    // create some bundles
    await promised(null, sandboxed(function() {
      // create i18n objects to then after create the bundles.
      global.org.objects.i18n.insertMany([
        {
          locale: 'en_US',
          namespace: 'cortex',
          name: 'test__en_US_cortex',
          data: {
            object: {
              c_test_i18n: {
                label: 'Test i18n',
                description: 'Testing i18n bundles',
                properties: {
                  c_key: {
                    label: 'Key',
                    description: ''
                  },
                  c_translated_string: {
                    label: 'Translated String',
                    description: ''
                  }
                }
              }
            }
          }
        },
        {
          locale: 'es_ES',
          namespace: 'cortex',
          name: 'test__es_ES_cortex',
          data: {
            object: {
              c_test_i18n: {
                label: 'Prueba i18n',
                description: 'Probando paquetes i18n',
                properties: {
                  c_key: {
                    label: 'Llave',
                    description: ''
                  },
                  c_translated_string: {
                    label: 'Texto traducido',
                    description: ''
                  }
                }
              }
            }
          }
        },
        {
          locale: 'en_US',
          namespace: 'app2',
          assets: [{
            key: 'com.medable.my_asset_file',
            value: {
              content: {
                source: 'buffer',
                buffer: 'my_asset_file'
              }
            }
          }],
          name: 'test__en_US_app2',
          data: {
            '23697a1f-6dd8-445e-9230-ad35f3ff1fb5': {
              com: {
                medable: {
                  my_string_app: 'app2 my string'
                }
              }
            }
          }
        },
        {
          locale: 'es_ES',
          namespace: 'app2',
          name: 'test__es_ES_app2',
          data: {
            '23697a1f-6dd8-445e-9230-ad35f3ff1fb5': {
              com: {
                medable: {
                  my_string_app: 'app2 texto'
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
        name: 'c_test_i18n',
        label: 'c_test_i18n',
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
        }, {
          type: 'String',
          name: 'c_translated_string',
          label: 'c_translated_string',
          localization: {
            enabled: true,
            translationKey: 'com.medable.my_string_app',
            namespace: 'app2'
          }
        }]
      }).execute()

      global.org.objects.c_test_i18n.insertOne({
        c_key: '23697a1f-6dd8-445e-9230-ad35f3ff1fb5',
        c_translated_string: 'something'
      }).execute()

    }))
  })

  after(async() => {
    // delete bundles / i18n objects.
    await waitForWorker(server, 'instance-reaper',
      () => promised(null, sandboxed(function() {
        const action1 = global.org.objects.objects.deleteMany({ name: 'c_test_i18n' }).skipAcl().grant(8).execute()
        const action2 = global.org.objects.i18n.deleteMany().skipAcl().grant(8).execute()
        const action3 = global.org.objects.i18nbundle.deleteMany().skipAcl().grant(8).execute()
        return [action1, action2, action3]
      })), { forceWorkerRun: true })
  })

  it('should return a translated string properties', async function() {

    const [enUS, esES] = await promised(null, sandboxed(function() {
      // return template render
      global.script.locale = 'en_US'
      const [first] = global.org.objects.c_test_i18n.find().toArray()
      global.script.locale = 'es_ES'
      const [second] = global.org.objects.c_test_i18n.find().toArray()
      return [first, second]
    }))

    should(enUS.c_translated_string).equal('app2 my string')
    should(esES.c_translated_string).equal('app2 texto')

  })

  it('should return a translated string properties for object def', async function() {

    const [enUS, esES] = await promised(null, sandboxed(function() {
      // return template render
      const [first] = global.org.objects.objects.find({ name: 'c_test_i18n' }).toArray()
      global.script.locale = 'es_ES'
      const [second] = global.org.objects.objects.find({ name: 'c_test_i18n' }).toArray()
      return [first, second]
    }))

    should(enUS.label).equal('Test i18n')
    should(enUS.description).equal('Testing i18n bundles')
    should(enUS.properties[0].label).equal('Key')
    should(enUS.properties[1].label).equal('Translated String')

    should(esES.label).equal('Prueba i18n')
    should(esES.description).equal('Probando paquetes i18n')
    should(esES.properties[0].label).equal('Llave')
    should(esES.properties[1].label).equal('Texto traducido')

  })

})
