const moment = require('moment')
const should = require('should'),
      config = require('cortex-service/lib/config'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      loadScript = require('../../../lib/script.loader')

describe('Issues - CTXAPI-1262 - Remove soft/hard limit checks from event insert', function() {

  const addEvent = async(withDelay) => {

    const startTime = withDelay ? moment().add(1, 'hour').format('YYYY-MM-DDTHH:mm:ss.000+00:00') : null,
          sandboxExecution = sandboxed(function() {
            /* global org, script, ObjectID */
            const key = `c_ctxapi_1262_event_${new ObjectID()}`,
                  cache = require('cache')

            let document = {
              type: 'script',
              key,
              event: 'c_ctxapi_1262_event',
              principal: script.principal.email,
              retention: 1,
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
            org.objects.event.insertOne(document).grant('update').bypassCreateAcl().execute()

            if (!script.arguments.startTime) {
              require('debug').sleep(2000)
            }
            return {
              success: cache.get(key),
              error: cache.get('ctxapi_1262_error')
            }
          }, {
            runtimeArguments: { startTime }
          })

    return promised(null, sandboxExecution)

  }

  before(async function() {
    const lib = loadScript('CTXAPI-1262_EventHandler.js')

    await promised(null, sandboxed(function() {
      /* global org, script */
      org.objects.scripts.insertOne({
        label: 'c_ctxapi_1262_expressions_trigger_lib',
        name: 'c_ctxapi_1262_expressions_trigger_lib',
        description: 'c_ctxapi_1262_expressions_trigger_lib',
        script: script.arguments.lib,
        type: 'library',
        configuration: {
          export: 'c_ctxapi_1262_expressions_trigger_lib'
        }
      }).execute()
    }, {
      runtimeArguments: { lib }
    }))

  })

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_1262_expressions_trigger_lib' }).execute()
  }))

  it('should not limit event insert if events.enableLimits is false', async function() {
    const promises = []
    for (let i = 0; i < config('events').defaultHardLimit + 1; i++) {
      promises.push(addEvent(true))
    }
    // Let's wait to populate with a limit
    await Promise.all(promises)

    // let's try to add another one exceeding the limit
    // eslint-disable-next-line one-var
    const result = await addEvent(false)

    should.equal(config('events').enableLimits, false)
    should.exist(result)
    should.equal(result.success.theMessage, 'The sun is red')
    should.equal(result.error, null)
  })
})
