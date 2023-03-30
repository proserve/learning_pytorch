const server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      { waitForWorker } = require('../../../lib/utils')(),
      should = require('should')

describe('Expressions - Operator$i18n', function() {

  before(async() => {
    // create some bundles
    await promised(null, sandboxed(function() {
      // create i18n objects to then after create the bundles.
      global.org.objects.i18n.insertMany([
        {
          locale: 'en_US',
          namespace: 'app6',
          assets: [{
            key: 'com.medable.my_asset_file',
            value: {
              content: {
                source: 'buffer',
                buffer: 'my_asset_file'
              }
            }
          }],
          name: 'test__en_US_app6_exp',
          data: {
            com: {
              medable: {
                my_string_app: 'app6 my string'
              }
            }
          }
        },
        {
          locale: 'en_US',
          namespace: 'app7',
          name: 'test__en_US_app7_exp',
          data: {
            com: {
              medable: {
                my_string_app: 'app7 my string'
              }
            }
          }
        },
        {
          locale: 'en_US',
          namespace: 'app9',
          name: 'test__en_US_app9_exp',
          data: {
            com: {
              medable: {
                my_string_app: 'app9 my string'
              }
            }
          }
        },
        {
          locale: 'en_CA',
          namespace: 'app6',
          extends: ['en_US'],
          name: 'test__en_CA_app6_exp',
          data: {
            com: {
              medable: {
                my_other_string: 'app6 string'
              }
            }
          }
        },
        {
          locale: 'en_CA',
          namespace: 'app7',
          extends: ['en_US'],
          name: 'test__en_CA_app7_exp',
          data: {
            com: {
              medable: {
                my_other_string: 'app7 string'
              }
            }
          }
        },
        {
          locale: 'en_CA',
          namespace: 'app9',
          name: 'test__en_CA_app9',
          extends: ['en_US'],
          data: {
            com: {
              medable: {
                my_other_string: 'app9 string'
              }
            }
          }
        },
        {
          locale: 'es_ES',
          namespace: 'app6',
          name: 'test__es_ES_app6',
          data: {
            com: {
              medable: {
                my_string: 'app6 texto'
              }
            }
          }
        },
        {
          locale: 'es_ES',
          namespace: 'app7',
          name: 'test__es_ES_app7',
          data: {
            com: {
              medable: {
                my_string: 'app7 texto'
              }
            }
          }
        },
        {
          locale: 'es_ES',
          namespace: 'app9',
          name: 'test__es_ES_app9',
          data: {
            com: {
              medable: {
                my_string: 'app9 texto'
              }
            }
          }
        }
      ]).skipAcl().grant(8).execute()
      const i18n = require('i18n')
      i18n.buildBundles({
        namespaces: ['app6', 'app7', 'app9'], locales: ['en_US', 'es_ES'], onePerNs: true })
    }))
  })

  after(async() => {
    // delete bundles / i18n objects.
    await waitForWorker(server, 'instance-reaper',
      () => promised(null, sandboxed(function() {
        const action1 = global.org.objects.i18n.deleteMany().skipAcl().grant(8).execute()
        const action2 = global.org.objects.i18nbundle.deleteMany().skipAcl().grant(8).execute()
        return [action1, action2]
      })), { forceWorkerRun: true })
  })

  it('Operator$i18n', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $i18n: 'app6:com.medable.my_string_app'
            }
          )

    should(await ec.evaluate()).equal('app6 my string')

  })

  it('Operator$i18n using object entry', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $i18n: {
                key: 'com.medable.my_string',
                locale: 'es_ES',
                namespace: 'app7'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal('app7 texto')

  })

})
