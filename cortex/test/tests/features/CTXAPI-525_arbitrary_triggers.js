const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      loadScript = require('../../lib/script.loader'),
      { promised, sleep, rString } = require('../../../lib/utils')

describe('Features - CTXAPI-525 - Arbitrary triggers', function() {

  before(async function() {
    const triggerLib = loadScript('CTXAPI-525_trigger_lib.js')

    await promised(null, sandboxed(function() {
      /* global org, script */

      org.objects.scripts.insertOne({
        label: 'CTXAPI-525 Trigger Library',
        name: 'c_ctxapi_525_trigger_lib',
        type: 'library',
        script: script.arguments.triggerLib,
        configuration: {
          export: 'c_ctxapi_525_trigger_lib'
        }
      }).execute()
    }, {
      runtimeArguments: {
        triggerLib
      }
    }))
  })

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_525_trigger_lib' }).execute()
  }))

  it('should trigger an inline before event', async function() {
    let elapsed, runtime
    const start = Date.now()

    runtime = await promised(null, sandboxed(function() {
      script.trigger('ctx525__the_event.before')
      return require('cache').get('ctxapi-525-before-runtime')
    }))

    elapsed = Date.now() - start
    elapsed.should.be.above(1000)

    runtime.should.containDeep({
      name: null,
      type: 'trigger',
      principal: null,
      environment: '*',
      weight: 1,
      configuration: {
        object: 'system',
        event: 'ctx525__the_event.before',
        inline: false,
        paths: []
      },
      metadata: {
        resource: 'script#type(library).name(c_ctxapi_525_trigger_lib).@trigger 9:2',
        className: 'Trigger525Object',
        methodName: 'before525Event',
        static: false,
        loc: {
          line: 9,
          column: 2
        }
      }
    })
  })

  it('should trigger a non inline after event', async function() {
    let elapsed,
        cacheEntry,
        done = false
    const start = Date.now()

    cacheEntry = await promised(null, sandboxed(function() {
      script.trigger('ctx525__the_event.after')
      return require('cache').get('ctxapi-525-after')
    }))

    elapsed = Date.now() - start

    elapsed.should.be.below(500)
    should.not.exist(cacheEntry)

    while (!done) {
      cacheEntry = await promised(null, sandboxed(function() {
        return require('cache').get('ctxapi-525-after')
      }))

      if (rString(cacheEntry, false)) {
        done = true
      } else {
        sleep(250)
      }
    }

    should.equal(cacheEntry, 'After is done!')
  })

  it('should trigger in-context inline events with arguments', async() => {
    let elapsed,
        cacheEntry,
        start = Date.now()

    cacheEntry = await promised(null, sandboxed(function() {
      script.fire('ctx525__the_event.name', 'John', 43)
      return require('cache').get('ctxapi-525-name')
    }))

    elapsed = Date.now() - start

    elapsed.should.be.above(500)

    should.exist(cacheEntry)
    should.equal(cacheEntry, 'Completed! John is 43 years old.')
  })

})
