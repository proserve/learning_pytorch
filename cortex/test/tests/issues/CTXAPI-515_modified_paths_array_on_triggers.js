'use strict'

const sandboxed = require('../../lib/sandboxed'),
      loadScript = require('../../lib/script.loader'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Issues - CTXAPI-515 - Modified paths array not showing up on triggers', function() {

  before(async() => {
    const triggerScript = loadScript('CTXAPI-515_TriggerObject.js')
    await promised(null, sandboxed(function() {
      /* global script, org */
      org.objects.objects.insertOne({
        label: 'CTXAPI-515 Object',
        name: 'c_ctxapi_515_object',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'String',
          name: 'c_string',
          type: 'String',
          indexed: true
        }]
      }).execute()

      org.objects.objects.insertOne({
        label: 'CTXAPI-515 Object legacy',
        name: 'c_ctxapi_515_object_legacy',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'String',
          name: 'c_string',
          type: 'String',
          indexed: true
        }]
      }).execute()

      org.objects.scripts.insertOne({
        label: 'CTXAPI-515 Trigger Library',
        name: 'c_ctxapi_515_trigger_lib',
        description: 'Trigger Library',
        type: 'library',
        script: script.arguments.triggerScript,
        configuration: {
          export: 'c_ctxapi_515_trigger_lib'
        }
      }
      ).execute()

      org.objects.scripts.insertOne({
        label: 'CTXAPI-515 Legacy Trigger - BC',
        name: 'c_ctxapi_515_legacy_trigger_bc',
        description: 'Legacy trigger BC',
        type: 'trigger',
        script: `
        const cache = require('cache')
        cache.set(
          script.context.object + '.' + script.context._id + '.bc.modified.script',
          JSON.stringify(script.arguments.modified.sort()))
        `,
        configuration: {
          object: 'c_ctxapi_515_object_legacy',
          event: 'create.before'
        }
      }
      ).execute()
      org.objects.scripts.insertOne({
        label: 'CTXAPI-515 Legacy Trigger - AC',
        name: 'c_ctxapi_515_legacy_trigger_ac',
        description: 'Legacy trigger AC',
        type: 'trigger',
        script: `
          const cache = require('cache')
          cache.set(
          script.context.object + '.' + script.context._id + '.ac.modified.script',
          JSON.stringify(script.arguments.modified.sort()))`,
        configuration: {
          object: 'c_ctxapi_515_object_legacy',
          event: 'create.after'
        }
      }
      ).execute()

      org.objects.scripts.insertOne({
        label: 'CTXAPI-515 Legacy Trigger - BU',
        name: 'c_ctxapi_515_legacy_trigger_bu',
        description: 'Legacy trigger BU',
        type: 'trigger',
        script: `
        const cache = require('cache')
        cache.set(
          script.context.object + '.' + script.context._id + '.bu.modified.script',
          JSON.stringify(script.arguments.modified.sort()))
        `,
        configuration: {
          object: 'c_ctxapi_515_object_legacy',
          event: 'update.before'
        }
      }
      ).execute()
      org.objects.scripts.insertOne({
        label: 'CTXAPI-515 Legacy Trigger - AU',
        name: 'c_ctxapi_515_legacy_trigger_au',
        description: 'Legacy trigger AU',
        type: 'trigger',
        script: `
          const cache = require('cache')
          cache.set(
          script.context.object + '.' + script.context._id + '.au.modified.script',
          JSON.stringify(script.arguments.modified.sort()))`,
        configuration: {
          object: 'c_ctxapi_515_object_legacy',
          event: 'update.after'
        }
      }
      ).execute()

    }, {
      runtimeArguments: {
        triggerScript
      }
    }))
  })

  afterEach(sandboxed(function() {
    org.objects.c_ctxapi_515_object.deleteMany().execute()
    org.objects.c_ctxapi_515_object_legacy.deleteMany().execute()
  }))

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_515_trigger_lib' }).execute()
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_515_legacy_trigger_bc' }).execute()
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_515_legacy_trigger_ac' }).execute()
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_515_legacy_trigger_au' }).execute()
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_515_legacy_trigger_bu' }).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_515_object_legacy' }).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_515_object' }).execute()
  }))

  it('should have modified path array on before and after create using runtime triggers', async function() {
    let result
    result = await promised(null, sandboxed(function() {
      let instance, modifiedBC, modifiedAC, modifiedBCScript, modifiedACScript

      const cache = require('cache'),
            debug = require('debug'),
            { c_ctxapi_515_object: Model } = org.objects

      instance = Model.insertOne({ c_string: 'Howard' })
        .lean(false)
        .execute()

      debug.sleep(500)

      modifiedAC = cache.get(`${instance.object}.${instance._id}.ac.modified`)
      modifiedBC = cache.get(`${instance.object}.${instance._id}.bc.modified`)
      modifiedACScript = cache.get(`${instance.object}.${instance._id}.ac.modified.script`)
      modifiedBCScript = cache.get(`${instance.object}.${instance._id}.bc.modified.script`)

      return { instance, modifiedBC, modifiedAC, modifiedBCScript, modifiedACScript }
    }))

    should.exist(result)
    should.exist(result.instance)
    should.not.exist(result.instance.errCode)
    should.equal(result.instance.c_string, 'Howard')
    should.equal(result.modifiedBC, '["c_string","creator","object","org","owner"]')
    should.equal(result.modifiedAC, '["c_string","creator","object","org","owner"]')
    should.equal(result.modifiedBCScript, '["c_string","creator","object","org","owner"]')
    should.equal(result.modifiedACScript, '["c_string","creator","object","org","owner"]')
  })

  it('should have modified path array on before and after update using runtime triggers', async function() {
    let result
    result = await promised(null, sandboxed(function() {
      let _id, instance, modifiedBU, modifiedAU, modifiedBUScript, modifiedAUScript

      const cache = require('cache'),
            debug = require('debug'),
            { c_ctxapi_515_object: Model } = org.objects

      _id = Model.insertOne({ c_string: 'Howard' })
        .execute()

      instance = Model.updateOne({ _id }, {
        $set: {
          c_string: 'Robert'
        }
      }).lean(false)
        .execute()

      debug.sleep(500)

      modifiedAU = cache.get(`${instance.object}.${instance._id}.au.modified`)
      modifiedBU = cache.get(`${instance.object}.${instance._id}.bu.modified`)
      modifiedAUScript = cache.get(`${instance.object}.${instance._id}.au.modified.script`)
      modifiedBUScript = cache.get(`${instance.object}.${instance._id}.bu.modified.script`)

      return { instance, modifiedBU, modifiedAU, modifiedBUScript, modifiedAUScript }
    }))

    should.exist(result)
    should.exist(result.instance)
    should.not.exist(result.instance.errCode)
    should.equal(result.instance.c_string, 'Robert')
    should.equal(result.modifiedBU, '["c_string"]')
    should.equal(result.modifiedAU, '["c_string","updated","updater"]')
    should.equal(result.modifiedBUScript, '["c_string"]')
    should.equal(result.modifiedAUScript, '["c_string","updated","updater"]')
  })

  it('should have modified path array on before and after create using native triggers', async function() {
    let result
    result = await promised(null, sandboxed(function() {
      let instance, modifiedBCScript, modifiedACScript

      const cache = require('cache'),
            debug = require('debug'),
            { c_ctxapi_515_object_legacy: Model } = org.objects

      instance = Model.insertOne({ c_string: 'John Doe' })
        .lean(false)
        .execute()

      debug.sleep(500)

      modifiedACScript = cache.get(`${instance.object}.${instance._id}.ac.modified.script`)
      modifiedBCScript = cache.get(`${instance.object}.${instance._id}.bc.modified.script`)

      return { instance, modifiedBCScript, modifiedACScript }
    }))

    should.exist(result)
    should.exist(result.instance)
    should.not.exist(result.instance.errCode)
    should.equal(result.instance.c_string, 'John Doe')
    should.equal(result.modifiedBCScript, '["c_string","creator","object","org","owner"]')
    should.equal(result.modifiedACScript, '["c_string","creator","object","org","owner"]')
  })

  it('should have modified path array on before and after update using native triggers', async function() {
    let result
    result = await promised(null, sandboxed(function() {

      let _id, instance, modifiedBUScript, modifiedAUScript

      const cache = require('cache'),
            debug = require('debug'),
            { c_ctxapi_515_object: Model } = org.objects

      _id = Model.insertOne({ c_string: 'Robert' })
        .execute()

      instance = Model.updateOne({ _id }, {
        $set: {
          c_string: 'John updated'
        }
      }).lean(false)
        .execute()

      debug.sleep(500)

      modifiedAUScript = cache.get(`${instance.object}.${instance._id}.au.modified.script`)
      modifiedBUScript = cache.get(`${instance.object}.${instance._id}.bu.modified.script`)

      return { instance, modifiedBUScript, modifiedAUScript }
    }))

    should.exist(result)
    should.exist(result.instance)
    should.not.exist(result.instance.errCode)
    should.equal(result.instance.c_string, 'John updated')
    should.equal(result.modifiedBUScript, '["c_string"]')
    should.equal(result.modifiedAUScript, '["c_string","updated","updater"]')
  })

})
