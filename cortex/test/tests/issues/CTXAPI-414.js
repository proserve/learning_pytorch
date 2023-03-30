'use strict'

const should = require('should'),
      uuid = require('uuid'),
      server = require('../../lib/server'),
      sandboxed = require('../../lib/sandboxed'),
      { sleep } = require('../../../lib/utils'),
      modules = require('../../../lib/modules')

describe('Issues - CTXAPI-414 audit notifications', function() {

  it('should audit notifications send', async() => {

    let done = false, recipient, docs, err = null

    const testId = server.mochaCurrentTestUuid,
          handler = (message, e) => {
            if (message.mochaCurrentTestUuid === testId && message.worker === 'notification') {
              done = true
              err = e
            }
          }
    server.events.on('worker.done', handler)

    server.__mocha_test_uuid__ = uuid.v1()

    recipient = await (sandboxed(function() {
      /* global script */
      const notifications = require('notifications')
      notifications.send({ var: 'test' }, {
        endpoints: {
          email: {
            recipient: script.principal.email,
            template: null,
            message: 'testing',
            html: '<html><p>Plain Html<p></html>'
          }
        }
      })
      return script.principal._id
    })())

    while (!done) { // eslint-disable-line no-unmodified-loop-condition
      await sleep(100)
    }
    server.events.removeListener('worker.done', handler)
    if (err) {
      throw err
    }

    docs = await modules.db.models.Audit.find({
      cat: 'notifications',
      'metadata.type': 'email',
      'metadata.recipientId': recipient,
      'metadata.testId': server.__mocha_test_uuid__
    }).exec()
    should.equal(docs.length, 1)

  })

})
