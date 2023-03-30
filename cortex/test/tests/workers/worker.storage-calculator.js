'use strict'

const server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      { sleep } = require('../../../lib/utils')

describe('Workers', function() {

  describe('storage-calculator', function() {

    it('should run the job successfully', async() => {

      let done = false, err = null

      const testId = server.mochaCurrentTestUuid,
            handler = (message, e) => {
              if (message.mochaCurrentTestUuid === testId && message.worker === 'storage-calculator') {
                done = true
                err = e
              }
            },
            { workers } = modules

      server.events.on('worker.done', handler)

      workers.runNow('storage-calculator')
      workers.mq.poll().catch(e => { void e })

      while (!done) { // eslint-disable-line no-unmodified-loop-condition
        await sleep(250)
      }
      server.events.removeListener('worker.done', handler)
      if (err) {
        throw err
      }

    })

  })

})
