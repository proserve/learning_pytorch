const should = require('should'),
      modules = require('../../../lib/modules/index'),
      server = require('../../lib/server'),
      sandboxed = require('../../lib/sandboxed'),
      { promised, sleep } = require('../../../lib/utils'),
      subscribePerformAndWait = async(fun, runtimeArguments = {}) => {
        let done = false,
            result = null

        const handler = (message, payload, options, err) => {
          done = true
          result = { message, payload, options, err }
        }

        server.events.on('worker.sms', handler)

        await promised(null, sandboxed(fun, { runtimeArguments }))

        while (!done) { // eslint-disable-line no-unmodified-loop-condition
          await sleep(250)
        }

        server.events.removeListener('worker.sms', handler)

        return result
      }

describe('CTXAPI-1467: Prevent sending SMS to incorrect numbers to Twilio', function() {
  before(async() => {
    // Alternative Implementation using database module
    await modules.db.models.Org.updateOne({ _id: server.org._id }, {
      $set: {
        'configuration.scripting.enableCustomSms': true,
        'configuration.sms.internalOverCustom': true,
        'configuration.sms.customOverInternal': true
      }
    })

    // To refresh sandbox cache
    await promised(null, sandboxed(function() {
      global.org.objects.org.updateOne({ code: script.org.code }, {
        $push: {
          apps: [{
            name: 'c_ctxapi_1567',
            label: 'c_ctxapi_1567',
            enabled: true
          }]
        }
      }).execute()
    }))
    await promised(server, 'updateOrg')
  })

  after(async() => {
    // Alternative Implementation using database module
    await modules.db.models.Org.updateOne({ _id: server.org._id }, {
      $set: {
        'configuration.scripting.enableCustomSms': false,
        'configuration.sms.internalOverCustom': false,
        'configuration.sms.customOverInternal': false
      }
    })

    // To refresh sandbox cache
    await promised(null, sandboxed(function() {
      global.org.objects.org.updateOne({ code: script.org.code }, {
        $pull: {
          apps: ['c_ctxapi_1567']
        }
      }).execute()
    }))
    await promised(server, 'updateOrg')
  })

  it('Given Phone number is not in SMS blocklist, worker should send SMS via Twilio API successfully', async() => {
    const result = await subscribePerformAndWait(function() {

      /* global script */
      const notifications = require('notifications')
      return notifications.send({}, {
        endpoints: {
          sms: {
            message: 'Hey from SMS',
            mobile: '+971555632573'
          }
        }
      })
    })
    should(result.err).be.undefined()
  })

  it('Given Phone number is in SMS blocklist, SMS worker should not send SMS', async() => {
    const result = await subscribePerformAndWait(function() {
      /* global script */
      const notifications = require('notifications')
      return notifications.send({}, {
        endpoints: {
          sms: {
            message: 'Hey from SMS',
            mobile: '+15055555555'
          }
        }
      })
    })
    should.exist(result.err)
    should.equal(result.err.message, 'Cannot send an SMS message to a blocked number')
  })

})
