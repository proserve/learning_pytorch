const should = require('should'),
      moment = require('moment'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils')

describe('Issues - CTXAPI-1281 - Event start', function() {

  const addEvent = async(key, startTime, schedule) => {
    const sandboxExecution = sandboxed(function() {
      /* global org, script */

      let document = {
        type: 'script',
        key: script.arguments.key,
        event: 'c_ctxapi_1281_event',
        principal: script.principal.email,
        if: {
          $eq: ['$$CONTEXT.principal.email', 'james+admin@medable.com']
        },
        param: {
          theMessage: 'The sun is red'
        }
      }

      if (script.arguments.startTime) {
        document.start = script.arguments.startTime
      }

      if (script.arguments.schedule) {
        document.schedule = script.arguments.schedule
      }

      org.objects.event.insertOne(document).grant('update').bypassCreateAcl().execute()

      return org.objects.event.find({ key: script.arguments.key }).skipAcl().grant(8).toList()

    }, {
      runtimeArguments: {
        startTime,
        schedule,
        key
      }
    })

    return promised(null, sandboxExecution)

  }

  after(sandboxed(function() {
    org.objects.event.deleteMany({}).grant('delete').skipAcl().execute()
  }))

  it('should be correctly set', async function() {

    const startTime = moment().format('YYYY-MM-DDTHH:mm:ss.000Z'),
          schedule = null,
          result = await addEvent('event1', startTime, schedule)

    should.exist(result)
    should.exist(result.data)
    should.equal(result.data.length, 1)
    should.equal(moment(result.data[0].start).isSame(moment(startTime)), true)
  })

  it('should not change if schedule is set', async function() {

    const startTime = moment().format('YYYY-MM-DDTHH:mm:ss.000Z'),
          schedule = '0 0 1 1 *',
          result = await addEvent('event2', startTime, schedule)

    should.exist(result)
    should.exist(result.data)
    should.equal(result.data.length, 1)
    should.equal(moment(result.data[0].start).isSame(moment(startTime)), true)
    should.equal(result.data[0].schedule, schedule)
  })

  it('should be set to next schedule date if not set at all', async function() {

    const startTime = null,
          schedule = '0 0 1 1 *',
          nextSchedule = moment().utc().add(1, 'year').format('YYYY-01-01T00:00:00.000Z'),
          result = await addEvent('event3', startTime, schedule)

    should.exist(result)
    should.exist(result.data)
    should.equal(result.data.length, 1)
    should.equal(moment(result.data[0].start).isSame(moment(nextSchedule)), true)
    should.equal(result.data[0].schedule, schedule)
  })
})
