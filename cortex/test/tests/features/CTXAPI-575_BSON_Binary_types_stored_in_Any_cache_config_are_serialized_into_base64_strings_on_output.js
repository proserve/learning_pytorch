'use strict'

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Features - CTXAPI-575 - BSON Binary types stored in Any/cache/config are serialized into base64' +
  ' strings on output', function() {

  before(sandboxed(function() {
    /* global org, consts */
    org.objects.objects.insertOne({
      label: 'CTXAPI-575',
      name: 'c_ctxapi_575',
      description: 'CTXAPI-575 description',
      defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
      createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
      properties: [
        {
          label: 'Binary Prop',
          name: 'ctx__bin',
          type: 'Binary',
          outputEncoding: 'base64'
        }
      ]
    }).execute()
  })
  )

  after(sandboxed(function() {
    org.objects.objects.deleteOne({ name: 'c_ctxapi_575' }).execute()
  }))

  it('Binary stored in config key should be serialized to base64', async function() {

    const result = await promised(null, sandboxed(function() {
      const config = require('config'),
            base64 = require('base64'),
            logo = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            buffer = base64.decode(logo, true)
      config.set('config_575_png_logo', buffer)
      return config.get('config_575_png_logo')
    }))

    should.equal(result, 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
  })

  it('Binary stored in cache key should be serialized to base64', async function() {

    const result = await promised(null, sandboxed(function() {
      const cache = require('cache'),
            base64 = require('base64'),
            logo = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            buffer = base64.decode(logo, true)
      cache.set('cache_575_png_logo', buffer, 60000)
      return cache.get('cache_575_png_logo')
    }))

    should.equal(result, 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
  })

  it('Binary prop should be serialized to base64', async function() {
    const result = await promised(null, sandboxed(function() {
      const base64 = require('base64'),
            logo = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            buffer = base64.decode(logo, true),
            objectId = org.objects.c_ctxapi_575.insertOne({ ctx__bin: buffer }).lean(true).execute()
      return org.objects.c_ctxapi_575.find().pathRead(objectId)
    }))
    should.equal(result.ctx__bin, 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
  })

})
