'use strict'

const sandboxed = require('../../lib/sandboxed'),
      loadScript = require('../../lib/script.loader'),
      server = require('../../lib/server'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Features - CTXAPI-601 - Support inline after script triggers', function() {

  before(async() => {
    const triggerScript = loadScript('CTXAPI-601_TriggerObject.js')
    await promised(null, sandboxed(function() {
      /* global org, Fault, script */
      const {
        objects: Objects
      } = org.objects

      if (Objects.find({ name: 'account' }).count() === 0) {
        Objects.insertOne({
          name: 'account',
          label: 'Account',
          properties: [{
            name: 'c_axon_string',
            label: 'Axon String',
            type: 'String',
            indexed: true
          }]
        }).execute()
      } else if (Objects.find({ name: 'account' }).count() === 1) {
        Objects.updateOne({ name: 'account' }, {
          $push: {
            properties: [{
              name: 'c_axon_string',
              label: 'Axon String',
              type: 'String',
              indexed: true
            }]
          }
        }).execute()
      } else {
        throw Fault.create('cortex.error.unspecified', { reason: 'Something terrible must have happened' })
      }

      org.objects.scripts.insertOne({
        label: 'CTXAPI-601 TriggerObject Library',
        name: 'c_ctxapi_601_triggerobject_lib',
        description: 'Library to trigger',
        type: 'library',
        script: script.arguments.triggerScript,
        configuration: {
          export: 'c_ctxapi_601_triggerobject_lib'
        }
      }).execute()
    }, {
      runtimeArguments: {
        triggerScript
      }
    }))
  })

  after(sandboxed(function() {

    const { Objects, Scripts, Accounts } = org.objects
    Scripts.deleteOne({ name: 'c_ctxapi_601_triggerobject_lib' }).execute()
    let accProps = Objects.find({ name: 'account' }).next().properties

    Objects.updateOne({ name: 'account' }, {
      $remove: {
        properties: accProps.filter(p => p.name === 'c_axon_string').map(p => p._id)
      }
    }).lean(false).execute()

    Accounts.deleteOne({ email: 'c_ctxapi_601@example.org' }).skipAcl(true).grant('script').execute()
  }))

  it('should execute an inline after trigger correctly', async() => {
    let timeStart = Date.now(),
        timeEnd,
        result,
        resultCache
    resultCache = await promised(null, sandboxed(function() {
      const cache = require('cache')
      script.trigger('ctxapi601__the_event_inline.after')
      return cache.get('ctxapi-601-INLINE')
    }))
    timeEnd = Date.now()
    result = timeEnd - timeStart >= 4000

    should.equal(result, true)
    should.equal(resultCache, 'Done')
  })

  it('should execute a non-inline after trigger correctly', async() => {
    let timeStart = Date.now(),
        timeEnd,
        result,
        resultCache = await promised(null, sandboxed(function() {
          const cache = require('cache')
          script.trigger('ctxapi601__the_event_not_inline.after')
          return cache.get('ctxapi-601-NOT-INLINE')
        }))
    timeEnd = Date.now()
    result = timeEnd - timeStart < 2000
    should.equal(result, true)
    should.equal(resultCache, null)

    resultCache = await promised(null, sandboxed(function() {
      const cache = require('cache'),
            debug = require('debug')

      debug.sleep(4000)
      return cache.get('ctxapi-601-NOT-INLINE')
    }))
    should.equal(resultCache, 'Done')
  })

  it('should execute operations included on inline after trigger correctly', async() => {
    let timeStart = Date.now(),
        timeEnd,
        result,
        resultAccount = await server.sessions.admin
          .get(server.makeEndpoint('/routes/c_ctxapi601'))
          .set(server.getSessionHeaders()).then()
    timeEnd = Date.now()
    result = timeEnd - timeStart > 4000

    should.equal(result, true)
    should.exist(resultAccount.body)
    should.equal(resultAccount.statusCode, 200)
    should.exist(resultAccount.body.c_axon_string)
    should.equal(resultAccount.body.c_axon_string, 'Congratulations CTXAPI_601! You are connected now, yeeey!')
  })

})
