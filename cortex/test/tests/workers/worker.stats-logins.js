'use strict'

const server = require('../../lib/server'),
      modules = require('../../../lib/modules')

describe('Workers', function() {

  describe('daily-logins', function() {

    it('should run the job successfully', function(callback) {

      let timeoutId = null

      const doneTest = err => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        server.events.removeListener('worker.done', handler)
        if (callback) {
          callback(err)
          callback = null
        }
      }

      function handler(message, err, result) {
        if (message.name === 'daily-logins') {
          doneTest(err)
        }
      }

      timeoutId = setTimeout(() => {
        doneTest(new Error('timed out waiting for job to run/complete'))
      }, 5000)

      server.events.on('worker.done', handler)

      // install a job and force it to run immediately.
      modules.db.models.message.updateOne({ name: 'daily-logins' }, { $set: { trigger: 0 } }, err => {
        if (err) {
          return doneTest(err)
        }
        modules.workers.mq.poll().catch(e => { void e }) // kick start the internal message queue.
      })

    })

  })

})
