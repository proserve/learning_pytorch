const should = require('should'),
      supertest = require('supertest'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      sandboxed = require('../../lib/sandboxed'),
      { sleep } = require('../../../lib/utils'),
      _ = require('underscore'),

      getNotification = async(orgLockDuration, lockAccount) => {
        let done = false,
            data = null,
            err

        function handler(body, error) {
          if (body.worker === 'notification' && body._doc.payload.variables.durationMinutes === orgLockDuration) {
            data = body
            server.events.removeListener('worker.done', handler)
            done = true
          }
          err = error
        }

        server.events.on('worker.done', handler)

        await lockAccount()

        while (!done) { // eslint-disable-line no-unmodified-loop-condition
          await sleep(250)
        }

        if (err) {
          return err
        }

        return data
      }

describe('Account lock duration', function() {

  before(async() => {

    const newUserAgent = supertest.agent(server.api.expressApp)

    await newUserAgent.post(server.makeEndpoint('/accounts/register'))
      .set(server.getSessionHeaders())
      .send({
        name: {
          first: 'Drew',
          last: 'Username'
        },
        email: 'drew+email@medable.com',
        username: 'drewUsername',
        mobile: '15055555555',
        password: 'myPa$$word123'
      }, {
        skipVerification: true,
        skipActivation: true,
        skipNotification: true
      })
  })

  after(sandboxed(function() {
    /* global org */
    org.objects.accounts.deleteOne({ email: 'drew+email@medable.com' }).skipAcl().grant(8).execute()
  }))

  after(function() {
    modules.workers.runNow('instance-reaper')
  })

  it('should trigger worker with notification payload lock duration equal to org lock duration', async() => {
    const { org } = server,
          orgLockDuration = org.security.unauthorizedAccess.lockDuration,
          notification = await getNotification(orgLockDuration, lockAccount),
          notificationLockDuration = notification._doc.payload.variables.duration,
          notificationLockDurationMinutes = notification._doc.payload.variables.durationMinutes

    async function lockAccount() {
      let newUserAgent = supertest.agent(server.api.expressApp),
          maxAttempts = org.security.unauthorizedAccess.lockAttempts

      for (let i = 0; i < maxAttempts; i++) {
        await newUserAgent
          .post(server.makeEndpoint('/accounts/login'))
          .set(server.getSessionHeaders())
          .send({
            email: 'drew+email@medable.com',
            password: 'invalidPassword'
          })
      }
    }

    _.isString(notificationLockDuration).should.be.true()
    notificationLockDuration.should.equal(`${orgLockDuration} minutes`)

    _.isNumber(notificationLockDurationMinutes).should.be.true()
    notificationLockDurationMinutes.should.equal(orgLockDuration)

  })

})
