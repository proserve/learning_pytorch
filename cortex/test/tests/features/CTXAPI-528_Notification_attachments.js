const should = require('should'),
      server = require('../../lib/server'),
      sandboxed = require('../../lib/sandboxed'),
      { promised, sleep } = require('../../../lib/utils'),
      waitUntilWorkerEnds = async() => {
        let done = false, err = null
        const testId = server.mochaCurrentTestUuid,
              handler = (message, e) => {
                if (message.mochaCurrentTestUuid === testId) {
                  if (message.worker === 'media-processor') {
                    done = true
                    err = e
                  }
                }
              }

        server.events.on('worker.done', handler)

        while (!done) { // eslint-disable-line no-unmodified-loop-condition
          await sleep(250)
        }
        server.events.removeListener('worker.done', handler)

        if (err) {
          throw err
        }
        return true
      },
      subscribePerformAndWait = async(fun, runtimeArguments = {}) => {
        let done = false,
            data = null,
            err

        const handler = (error, body) => {
          done = true
          err = error
          data = { body }
        }

        server.events.on('worker.emailer', handler)

        await promised(null, sandboxed(fun, { runtimeArguments }))

        while (!done) { // eslint-disable-line no-unmodified-loop-condition
          await sleep(250)
        }

        server.events.removeListener('worker.emailer', handler)

        if (err) {
          return err
        }

        return data
      }

describe('Features - CTXAPI-528 Notifications attachments', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      org.objects.objects.insertOne({
        label: 'CTXAPI_528 Object with file',
        name: 'c_ctxapi_528_object_with_file',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          name: 'c_file',
          label: 'c_file',
          type: 'File',
          processors: [{
            allowUpload: true,
            label: 'Content',
            maxFileSize: 10000000,
            mimes: ['*'],
            name: 'content',
            passMimes: false,
            private: false,
            required: true,
            source: 'content',
            type: 'passthru'
          }]
        }]
      }).execute()
    }))
  })

  it('send a notification with path facet attachment', async() => {
    let result
    const _id = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_528_object_with_file.insertOne({
        c_file: {
          content: { filename: 'test.txt', buffer: new Buffer('testing buffer') } // eslint-disable-line node/no-deprecated-api
        }
      }).execute()
    }))
    await waitUntilWorkerEnds()
    result = await subscribePerformAndWait(function() {
      /* global script */
      const notifications = require('notifications'),
            _id = script.arguments._id
      return notifications.send({}, {
        endpoints: {
          email: {
            recipients: [
              'gaston@medable.com'
            ],
            subject: 'Medable',
            message: 'Testing...',
            html: '<html><p>Medable&nbsp;rocks&#33;<p></html>',
            attachments: [{
              content: `path://c_ctxapi_528_object_with_file.${_id}.c_file.content`,
              filename: 'text.txt',
              type: 'plain/text'
            }]
          }
        }
      })
    }, {
      _id
    })

    should.not.exist(result.errCode)
    should.equal(Buffer.from(result.body.attachments[0].content, 'base64').toString(), 'testing buffer')

  })

  it('send a notification with buffer attachment', async() => {
    const result = await subscribePerformAndWait(function() {
      /* global script */
      const notifications = require('notifications')
      return notifications.send({}, {
        endpoints: {
          email: {
            recipients: [
              'gaston@medable.com'
            ],
            subject: 'Medable',
            message: 'Testing...',
            html: '<html><p>Medable&nbsp;rocks&#33;<p></html>',
            attachments: [{
              content: 'buffer://testing buffer',
              filename: 'text.txt',
              type: 'plain/text'
            }]
          }
        }
      })
    })

    should.not.exist(result.errCode)
    should.equal(Buffer.from(result.body.attachments[0].content, 'base64').toString(), 'testing buffer')
  })

  it('send a notification with cache attachment', async() => {
    const result = await subscribePerformAndWait(function() {
      /* global script */
      const notifications = require('notifications'),
            cache = require('cache')

      cache.set('ctxapi_528_cache_key', new Buffer('testing buffer')) // eslint-disable-line node/no-deprecated-api

      return notifications.send({}, {
        endpoints: {
          email: {
            recipients: [
              'gaston@medable.com'
            ],
            subject: 'Medable',
            message: 'Testing...',
            html: '<html><p>Medable&nbsp;rocks&#33;<p></html>',
            attachments: [{
              content: `cache://ctxapi_528_cache_key`,
              filename: 'text.txt',
              type: 'plain/text'
            }]
          }
        }
      })
    })

    should.not.exist(result.errCode)
    should.equal(Buffer.from(result.body.attachments[0].content, 'base64').toString(), 'testing buffer')
  })

  it('send a notification with config attachment', async() => {
    const result = await subscribePerformAndWait(function() {
      /* global script */
      const notifications = require('notifications'),
            config = require('config')
      config.set('ctxapi_528_config_key', { text: 'testing buffer' })

      return notifications.send({}, {
        endpoints: {
          email: {
            recipients: [
              'gaston@medable.com'
            ],
            subject: 'Medable',
            message: 'Testing...',
            html: '<html><p>Medable&nbsp;rocks&#33;<p></html>',
            attachments: [{
              content: `config://ctxapi_528_config_key`,
              filename: 'text.txt',
              type: 'plain/text'
            }]
          }
        }
      })
    })

    should.not.exist(result.errCode)
    should.equal(Buffer.from(result.body.attachments[0].content, 'base64').toString(), '{"text":"testing buffer"}')
  })

  it('send a notification with multiple attachment', async() => {
    let result
    const _id = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_528_object_with_file.insertOne({
        c_file: {
          content: { filename: 'test_multiple.txt', buffer: new Buffer('testing buffer on facet') } // eslint-disable-line node/no-deprecated-api
        }
      }).execute()
    }))

    await waitUntilWorkerEnds()

    result = await subscribePerformAndWait(function() {
      /* global script */
      const notifications = require('notifications'),
            config = require('config'),
            cache = require('cache'),
            _id = script.arguments._id
      config.set('ctxapi_528_config_key', { text: 'testing buffer on config' })
      cache.set('ctxapi_528_cache_key', new Buffer('testing buffer on cache')) // eslint-disable-line node/no-deprecated-api

      return notifications.send({}, {
        endpoints: {
          email: {
            recipients: [
              'gaston@medable.com'
            ],
            subject: 'Medable',
            message: 'Testing...',
            html: '<html><p>Medable&nbsp;rocks&#33;<p></html>',
            attachments: [{
              content: `path://c_ctxapi_528_object_with_file/${_id}/c_file/content`,
              filename: 'test_multiple.txt',
              type: 'plain/text'
            }, {
              content: {
                type: 'config',
                config: 'ctxapi_528_config_key'
              },
              filename: 'text_config.txt',
              type: 'plain/text'
            }, {
              content: {
                type: 'cache',
                cache: 'ctxapi_528_cache_key',
                dispose: true
              },
              filename: 'text_cache.txt',
              type: 'plain/text'
            }, {
              content: {
                type: 'buffer',
                encode: false,
                buffer: 'dGVzdGluZyBidWZmZXI='
              },
              filename: 'text.txt',
              type: 'plain/text'
            }]
          }
        }
      })
    }, {
      _id
    })

    should.not.exist(result.errCode)
    should.equal(Buffer.from(result.body.attachments[0].content, 'base64').toString(), 'testing buffer on facet')
    should.equal(Buffer.from(result.body.attachments[1].content, 'base64').toString(), '{"text":"testing buffer on config"}')
    should.equal(Buffer.from(result.body.attachments[2].content, 'base64').toString(), 'testing buffer on cache')
    should.equal(Buffer.from(result.body.attachments[3].content, 'base64').toString(), 'testing buffer')
  })
})
