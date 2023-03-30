const sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      { promised } = require('../../../../lib/utils')

describe('CTXAPI-661 Expressions - Wrapped sandbox API', function() {

  before(async function() {
    await promised(null, sandboxed(function() {
      /* global org, script */
      org.objects.org.patchOne({ code: script.org.code }, {
        op: 'push',
        path: 'apps',
        value: {
          name: 'c_pdf_app',
          label: 'PDF Generation App',
          enabled: true,
          clients: [{
            label: 'c_pdf_app',
            allowNameMapping: true,
            enabled: true,
            csrf: false,
            authDuration: 86400,
            readOnly: false,
            sessions: true,
            CORS: {
              origins: ['*']
            }
          }]
        }
      }).execute()
      let app = org.read('apps').find(app => app.name === 'c_pdf_app')
      org.objects.org.patchOne({ code: script.org.code }, {
        op: 'set',
        path: 'apps',
        value: {
          _id: app._id,
          clients: [{
            _id: app.clients[0]._id,
            rsa: {
              regenerate: true
            }
          }]
        }
      }).execute()
    }))
  })

  after(sandboxed(function() {
    let app = org.read('apps').find(app => app.name === 'c_pdf_app')
    org.objects.org.patchOne({
      code: script.org.code
    }, {
      op: 'remove',
      path: 'apps',
      value: app._id
    }).execute()
  }))

  it('should run api sandbox with expressions (operators $dbPath $dig $encrypt)', async() => {
    let result = await promised(null, sandboxed(function() {

      const { run } = require('expressions')
      return [
        run({ $crypto: { md5: 'foo' } }),
        run({ $crypto: { sha1: 'foo' } }),
        run({
          $let: {
            vars: {
              apiKey: { $dig: [{ $dbPath: `org.${script.org.code}.apps` }, 'c_pdf_app.clients.0.key'] },
              payload: 'foo',
              encrypted: {
                $crypto: { 'rsa.encrypt': ['$$apiKey', '$$payload'] }
              },
              decrypted: {
                $crypto: { 'rsa.decrypt': ['$$apiKey', '$$encrypted'] }
              }
            },
            in: '$$decrypted'
          }
        })
      ]

    }))
    should.equal(result[0], 'acbd18db4cc2f85cedef654fccc4a4d8')
    should.equal(result[1], '0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33')
    should.equal(result[2], 'foo')

  })
})
