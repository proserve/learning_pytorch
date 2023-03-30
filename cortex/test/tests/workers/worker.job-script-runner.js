'use strict'

const server = require('../../lib/server'),
      should = require('should'),
      modules = require('../../../lib/modules')

describe('Workers', function() {

  describe('job-script-runner', function() {

    it('should run the job successfully', function(callback) {

      let timeoutId = null

      const mochaCurrentTestUuid = server.mochaCurrentTestUuid,
            doneTest = err => {
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
        if (message.mochaCurrentTestUuid === mochaCurrentTestUuid) {
          if (!err) {
            try {
              should.equal(result, 123)
            } catch (e) {
              err = e
            }
          }
          doneTest(err)
        }
      }

      timeoutId = setTimeout(() => {
        doneTest(new Error('timed out waiting for job to run/complete'))
      }, 5000)

      server.events.on('worker.done', handler)

      // install a job and force it to run immediately.
      modules.db.models.script.aclCreate( // aclCreate loads the correct model.
        server.principals.admin, {
          active: true,
          label: 'my job',
          type: 'job',
          script: `
            if ('${mochaCurrentTestUuid}') {
              return 123
            }
            return 'not good'
          `,
          configuration: {
            cron: '0 0 * * *'
          }
        },
        (err, { ac }) => {
          if (err) {
            return doneTest(err)
          }

          modules.workers.runScheduledJob(ac.org, `${ac.org.code}.script#type(job)._id(${ac.subjectId})`)
            .then(() => {
              modules.workers.mq.poll().catch(e => { void e })
            })
            .catch(doneTest)

        }
      )

    })

  })

})
