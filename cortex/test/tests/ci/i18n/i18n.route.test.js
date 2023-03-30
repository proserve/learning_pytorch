const server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      { waitForWorker } = require('../../../lib/utils')(),
      should = require('should')

describe('Route - translation route', function() {

  before(async() => {
    // create some bundles
    await promised(null, sandboxed(function() {
      // create i18n objects to then after create the bundles.
      global.org.objects.i18n.insertMany([
        {
          locale: 'en_US',
          namespace: 'app3',
          name: 'test__en_US_app3',
          data: {
            com: {
              medable: {
                my_string_app: 'app3 my string',
                my_string_message_one: 'there is {{counter}} item.',
                my_string_message_other: 'there are {{counter}} items.',
                my_html_string: '<b>contains html</b> and some other &'
              }
            }
          }
        },
        {
          locale: 'en_US',
          namespace: 'app4',
          name: 'test__en_US_app4',
          data: {
            com: {
              medable: {
                my_string_app: 'app4 my string'
              }
            }
          }
        },
        {
          locale: 'en_US',
          namespace: 'app5',
          name: 'test__en_US_app5',
          data: {
            com: {
              medable: {
                my_string_app: 'app5 my string'
              }
            }
          }
        },
        {
          locale: 'en_CA',
          namespace: 'app3',
          extends: ['en_US'],
          name: 'test__en_CA_app3',
          data: {
            com: {
              medable: {
                my_other_string: 'app3 string'
              }
            }
          }
        },
        {
          locale: 'en_CA',
          namespace: 'app4',
          extends: ['en_US'],
          name: 'test__en_CA_app4',
          data: {
            com: {
              medable: {
                my_other_string: 'app4 string'
              }
            }
          }
        },
        {
          locale: 'en_CA',
          namespace: 'app5',
          name: 'test__en_CA_app5',
          extends: ['en_US'],
          data: {
            com: {
              medable: {
                my_other_string: 'app5 string'
              }
            }
          }
        },
        {
          locale: 'es_ES',
          namespace: 'app3',
          name: 'test__es_ES_app3',
          data: {
            com: {
              medable: {
                my_string: 'app3 texto',
                my_string_message_one: 'hay {counter} item.',
                my_string_message_other: 'hay {counter} items.'
              }
            }
          }
        },
        {
          locale: 'es_ES',
          namespace: 'app4',
          name: 'test__es_ES_app4',
          data: {
            com: {
              medable: {
                my_string: 'app4 texto'
              }
            }
          }
        },
        {
          locale: 'es_ES',
          namespace: 'app5',
          name: 'test__es_ES_app5',
          data: {
            com: {
              medable: {
                my_string: 'app5 texto'
              }
            }
          }
        }
      ]).skipAcl().grant(8).execute()
      const i18n = require('i18n')
      i18n.buildBundles({ namespaces: ['app3', 'app4', 'app5'], locales: ['en_US', 'es_ES'] })
    }))
  })

  after(async() => {
    await waitForWorker(server, 'instance-reaper',
      () => promised(null, sandboxed(function() {
        const action1 = global.org.objects.i18n.deleteMany().skipAcl().grant(8).execute()
        const action2 = global.org.objects.i18nbundle.deleteMany().skipAcl().grant(8).execute()
        return [action1, action2]
      })), { forceWorkerRun: true })
  })

  it('Get en_US translations json', async() => {

    const result = await server.sessions.admin
      .get(server.makeEndpoint('/translations/en_US?namespaces[]=app3'))
      .send()

    should(result.body).deepEqual({
      app3: {
        com: {
          medable: {
            my_string_app: 'app3 my string',
            my_string_message_one: 'there is {{counter}} item.',
            my_string_message_other: 'there are {{counter}} items.',
            my_html_string: '<b>contains html</b> and some other &'
          }
        }
      }
    })

  })

  it('Get en_US translations android', async() => {

    const result = await server.sessions.admin
      .set('Accept', 'application/xml')
      .get(server.makeEndpoint('/translations/en_US?namespaces[]=app3&format=android'))
      .send()

    should(result.text.trim()).equal(`<?xml version="1.0" encoding="utf-8"?><resources><string name="app3.com.medable.my_string_app"><![CDATA[app3 my string]]></string><string name="app3.com.medable.my_html_string"><![CDATA[<b>contains html</b> and some other &]]></string><plurals name="app3.com.medable.my_string_message"><item quantity="one"><![CDATA[there is {{counter}} item.]]></item><item quantity="other"><![CDATA[there are {{counter}} items.]]></item></plurals></resources>`)

  })

})
