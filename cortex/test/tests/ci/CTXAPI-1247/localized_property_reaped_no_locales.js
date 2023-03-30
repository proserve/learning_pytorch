'use strict'

const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      should = require('should'),
      { promised, sleep } = require('../../../../lib/utils')

async function waitForWorker(worker, fn) {

  let err,
      done = false

  const testId = server.mochaCurrentTestUuid,
        handler = (message, e) => {
          if (message.mochaCurrentTestUuid === testId) {
            if (message.worker === worker) {
              done = true
            }
            err = e
          }
        }
  server.events.on('worker.done', handler)
  await fn()
  while (!err && !done) { // eslint-disable-line no-unmodified-loop-condition
    await sleep(25)
  }
  server.events.removeListener('worker.done', handler)
  if (err) {
    throw err
  }
}

describe('Issues - CTXAPI-1247 - Properly Reaping localized properties', function() {

  before(sandboxed(function() {

    /* global org */

    const { Objects } = org.objects

    Objects.insertOne({
      label: 'CTXAPI-1247',
      name: 'c_ctxapi_1247',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      uniqueKey: 'c_key',
      properties: [
        {
          label: 'c_string',
          name: 'c_string',
          type: 'String',
          indexed: true,
          localization: {
            enabled: true
          }
        },
        {
          label: 'c_string2',
          name: 'c_string2',
          type: 'String',
          indexed: true,
          localization: {
            enabled: true
          }
        },
        { name: 'c_key', label: 'Key', uuidVersion: 4, autoGenerate: true, type: 'UUID', indexed: true, unique: true }
      ]
    }).execute()

  }))

  after(sandboxed(function() {

    /* global org */

    const { Objects } = org.objects
    Objects.deleteOne({ name: 'c_ctxapi_1247' }).execute()

  }))

  it('should reap locales when reaping a localized property', async function() {

    await promised(null, sandboxed(function() {
      global.org.objects.c_ctxapi_1247.insertMany([{
        c_string: 'My text',
        c_string2: 'My second txt'
      }, {
        c_string: 'another one',
        c_string2: 'another two'
      }]).locale('en_US').execute()
    }))

    await waitForWorker('property-reaper', sandboxed(function() {
      global.org.objects.objects.updateOne(
        { name: 'c_ctxapi_1247' },
        { $pull: { 'properties': ['c_string2'] } }
      ).execute()
    }))

    const locales = await promised(null, sandboxed(function() {
      const [obj] = global.org.objects.objects.find({ name: 'c_ctxapi_1247' }).include('locales')
      return obj.locales
    }))

    should.exist(locales)
    should.equal(locales.properties.length, 2)
    should.deepEqual(locales.properties.map(p => p.name), ['c_string', 'c_key'])

  })

})
