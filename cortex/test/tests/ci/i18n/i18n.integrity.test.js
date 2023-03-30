const server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      { waitForWorker } = require('../../../lib/utils')(),
      should = require('should')

describe('I18n Integrity checking', function() {

  before(async() => {
    // create some bundles
    await promised(null, sandboxed(function() {
      // create i18n objects to then after create the bundles.
      global.org.objects.i18n.insertMany([
        {
          locale: 'en_US',
          namespace: 'axon',
          name: 'axon__en_US',
          data: {
            object: {
              account: {
                label: 'Account',
                description: 'Account object definition'
              }
            },
            template: {
              email: {
                axon__invite_email: {
                  title: 'Welcome {{account.name}}',
                  body: 'You have been invited'
                }
              }
            }
          }
        },
        {
          locale: 'es_AR',
          namespace: 'axon',
          name: 'axon__es_AR',
          data: {
            object: {
              account: {
                label: 'Cuenta'
              }
            },
            template: {
              email: {
                axon__invite_email: {
                  title: 'Bienvenido {{account.name}} {{account.last_name}}',
                  body: 'Has sido invitado'
                }
              }
            }
          }
        }
      ]).skipAcl().grant(8).execute()
      const i18n = require('i18n')
      i18n.buildBundles()

      const { environment } = require('developer'),
            data = [
              { 'object': 'manifest', 'templates': { 'includes': ['*'] } },
              {
                'description': 'Template Test',
                'label': 'Template with i18n',
                'localizations': [{
                  'locale': ['*'],
                  'content': [{
                    'data': `<p dir="{{lngDir}}">{{i18n "axon:template.email.axon__invite_email.title" account=account }}</p>`,
                    'name': 'html'
                  }, {
                    'data': '{{i18n "axon:template.email.axon__invite_email.title" account=account }}',
                    'name': 'plain'
                  }, { 'data': 'Subject', 'name': 'subject' }]
                }
                ],
                'name': 'axon__invite_email',
                'object': 'template',
                'partial': false,
                'type': 'email'
              }
            ]
      return environment.import(data, { backup: false, triggers: false }).toArray()
    }))
  })

  after(async() => {
    await waitForWorker(server, 'instance-reaper',
      () => promised(null, sandboxed(function() {
        global.org.objects.i18n.deleteMany().skipAcl().grant(8).execute()
        global.org.objects.i18nbundle.deleteMany().skipAcl().grant(8).execute()
      })), { forceWorkerRun: true })
  })

  it('should return the report of integrity', async() => {
    const result = await promised(null, sandboxed(function() {
      const i18n = require('i18n')
      return i18n.report('en_US') // base locale
    }))

    should.exist(result)
    should.equal(result.numLocales, 2)
    should.deepEqual(result.wrongPlaceholders.es_AR['axon.template.email.axon__invite_email.title'], ['account.last_name'])
    should.deepEqual(result.missingKeys.es_AR, ['axon.object.account.description'])

  })

  it('should trace a i18n key', async() => {
    const result = await promised(null, sandboxed(function() {
      const i18n = require('i18n')
      return i18n.trace('template.email.axon__invite_email.title')
    }))

    should.exist(result)
    result.should.containDeep([
      {
        path: 'en_US.axon.template.email.axon__invite_email.title',
        locale: 'en_US',
        namespace: 'axon'
      },
      {
        path: 'es_AR.axon.template.email.axon__invite_email.title',
        locale: 'es_AR',
        namespace: 'axon'
      }
    ])

  })

  it('should return pseudo localized string accented', async() => {
    const result = await promised(null, sandboxed(function() {
      const i18n = require('i18n')
      return i18n.translate('axon:object.account.description', { pseudo: { enabled: true, limited: true, expand: 50 } }) // base locale
    }))

    should.equal(result, '[ȦȦƈƈǿǿŭŭƞŧ ǿǿƀĵḗḗƈŧ ḓḗḗƒīƞīŧīǿǿƞ.............]')

  })

  it('should return pseudo localized string bidi', async() => {
    const result = await promised(null, sandboxed(function() {
      const i18n = require('i18n')
      return i18n.translate('axon:object.account.description', { pseudo: { enabled: true, mode: 'bidi', limited: true, expand: 50 } }) // base locale
    }))

    should.equal(result, '[‮∀ɔɔonuʇ oqɾǝɔʇ pǝɟıuıʇıou.............‬]')

  })

  it('should return template with translated template properly parsed', async() => {

    await promised(modules.db, 'sequencedUpdate', server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.i18n.pseudoLocalization.enabled': true,
        'configuration.i18n.pseudoLocalization.limited': true
      }
    })
    await promised(server, 'updateOrg')

    let result
    try {
      result = await promised(null, sandboxed(function() {
        const templates = require('templates'),
              renderResult = templates.render('email', 'axon__invite_email', {
                account: {
                  name: 'gaston',
                  last_name: 'robledo'
                }
              })
        return renderResult
      }))
    } finally {
      await promised(modules.db, 'sequencedUpdate', server.org.constructor, { _id: server.org._id }, {
        $set: {
          'configuration.i18n.pseudoLocalization.enabled': false,
          'configuration.i18n.pseudoLocalization.limited': false
        }
      })
      await promised(server, 'updateOrg')
    }

    should.equal(result[0].output, '<p dir="ltr">Ẇḗḗŀƈǿǿḿḗḗ ɠȧȧşŧǿǿƞ</p>')
  })

  it('should return only keys', async() => {
    const result = await promised(null, sandboxed(function() {
      const i18n = require('i18n')
      return i18n.getBundle('en_US', [], { onlyKeys: true })
    }))

    should.deepEqual(result, {
      axon: {
        object: {
          account: {
            label: 'axon.object.account.label',
            description: 'axon.object.account.description'
          }
        },
        template: {
          email: {
            axon__invite_email: {
              title: 'axon.template.email.axon__invite_email.title',
              body: 'axon.template.email.axon__invite_email.body'
            }
          }
        }
      }
    })
  })

})
