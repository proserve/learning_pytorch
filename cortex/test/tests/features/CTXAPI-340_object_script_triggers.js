const sandboxed = require('../../lib/sandboxed'),
      loadScript = require('../../lib/script.loader'),
      should = require('should'),
      { promised } = require('../../../lib/utils')

describe('Features -Object Script Triggers', function() {

  before(async() => {
    const triggerScript = loadScript('CTXAPI-340_TriggerObject.js')
    await promised(null, sandboxed(function() {
      /* global script */
      org.objects.objects.insertOne({
        label: 'TriggerObject',
        name: 'c_ctxapi_340_trigger_object',
        defaultAcl: ['owner.delete'],
        createAcl: ['account.public'],
        properties: [{
          label: 'BeforeCreateProp',
          name: 'c_before',
          type: 'String',
          indexed: true
        },
        {
          label: 'AfterCreateProp',
          name: 'c_after',
          type: 'String',
          indexed: true
        }]
      }).execute()

      org.objects.scripts.insertOne({
        label: 'CTXAPI-340 TriggerObject Library',
        name: 'c_ctxapi_340_triggerobject_lib',
        description: 'Library to trigger',
        type: 'library',
        script: script.arguments.triggerScript,
        configuration: {
          export: 'c_ctxapi_340_triggerobject_lib'
        }
      }).execute()
    }, {
      runtimeArguments: {
        triggerScript
      }
    }))
  })

  after(sandboxed(function() {
    /* global org */
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_340_triggerobject_lib' }).execute()
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_340_custom_trigger_object_lib' }).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_340_trigger_object' }).execute()
  }))

  it('check if triggers are properly set', async() => {
    let rObject, rLib, rBeforeCreateTrigger, rAfterCreateTrigger
    const result = await promised(null, sandboxed(function() {
      /* global org */
      const runtimeConfig = org.read('runtime'),
            // lets create an object
            _id = org.objects.c_ctxapi_340_trigger_object.insertOne({}).execute()
      require('debug').sleep(500)
      return { runtimeConfig, object: org.objects.c_ctxapi_340_trigger_object.find({ _id }).next() }
    }))

    rObject = result.runtimeConfig.objects.find(o => o.name === 'c_ctxapi_340_trigger_object')
    should.exist(rObject)
    should.equal(rObject.metadata.className, 'TriggerObject')

    rLib = result.runtimeConfig.libraries.find(o => o.name === 'c_ctxapi_340_triggerobject_lib')
    should.exist(rLib)

    rBeforeCreateTrigger = result.runtimeConfig.triggers.find(t => t.label === 'c_ctxapi_340_original_trigger')
    should.exist(rBeforeCreateTrigger)
    should.equal(rBeforeCreateTrigger.name, 'c_340_before_create_trigger')
    should.equal(rBeforeCreateTrigger.configuration.event, 'create.before')
    should.equal(rBeforeCreateTrigger.configuration.object, 'c_ctxapi_340_trigger_object')
    should.equal(rBeforeCreateTrigger.weight, 1)
    should.equal(rBeforeCreateTrigger.metadata.methodName, 'beforeCreate')
    should.equal(rBeforeCreateTrigger.metadata.className, 'TriggerObject')

    rAfterCreateTrigger = result.runtimeConfig.triggers.find(t => t.name === 'c_340_after_create_trigger')
    should.exist(rAfterCreateTrigger)
    should.equal(rAfterCreateTrigger.configuration.event, 'create.after')
    should.equal(rAfterCreateTrigger.configuration.object, 'c_ctxapi_340_trigger_object')
    should.equal(rAfterCreateTrigger.weight, 1)
    should.equal(rAfterCreateTrigger.metadata.methodName, 'afterCreate')
    should.equal(rAfterCreateTrigger.metadata.className, 'TriggerObject')
    should.notEqual(result.object.c_before, undefined)
    should.notEqual(result.object.c_after, undefined)
    result.object.c_after.should.be.above(result.object.c_before)
  })

  it('check if trigger override works first', async() => {
    let rLib, rBeforeCreateTrigger, rAfterCreateTrigger
    const lib = loadScript('CTXAPI-340_TriggerObjectOverride.js'),
          result = await promised(null, sandboxed(function() {
            org.objects.scripts.insertOne({
              label: 'CTXAPI-340 CustomTriggerObject Library',
              name: 'c_ctxapi_340_custom_trigger_object_lib',
              description: 'Library to trigger',
              type: 'library',
              script: script.arguments.lib,
              configuration: {
                export: 'c_ctxapi_340_custom_trigger_object'
              }
            }).execute()
            /* global org */
            const runtimeConfig = org.read('runtime'),
                  // lets create an object
                  _id = org.objects.c_ctxapi_340_trigger_object.insertOne({}).execute()
            require('debug').sleep(500)
            return { runtimeConfig, object: org.objects.c_ctxapi_340_trigger_object.find({ _id }).next() }
          }, {
            runtimeArguments: {
              lib
            }
          }))
    rLib = result.runtimeConfig.libraries.find(o => o.name === 'c_ctxapi_340_custom_trigger_object_lib')
    should.exist(rLib)

    rBeforeCreateTrigger = result.runtimeConfig.triggers.find(t => t.label === 'c_ctxapi_340_overriding_trigger')
    should.exist(rBeforeCreateTrigger)
    should.equal(rBeforeCreateTrigger.name, 'c_340_before_create_trigger')
    should.equal(rBeforeCreateTrigger.configuration.event, 'create.before')
    should.equal(rBeforeCreateTrigger.configuration.object, 'c_ctxapi_340_trigger_object')
    should.equal(rBeforeCreateTrigger.weight, 2)
    should.equal(rBeforeCreateTrigger.metadata.methodName, 'beforeCreate')
    should.equal(rBeforeCreateTrigger.metadata.className, 'MyCustomTrigger')

    rAfterCreateTrigger = result.runtimeConfig.triggers.find(t => t.name === 'c_340_after_create_trigger')
    should.exist(rAfterCreateTrigger)
    should.equal(rAfterCreateTrigger.configuration.event, 'create.after')
    should.equal(rAfterCreateTrigger.configuration.object, 'c_ctxapi_340_trigger_object')
    should.equal(rAfterCreateTrigger.weight, 1)
    should.equal(rAfterCreateTrigger.metadata.methodName, 'afterCreate')
    should.equal(rAfterCreateTrigger.metadata.className, 'TriggerObject')
    should.notEqual(result.object.c_before, undefined)
    should.notEqual(result.object.c_after, undefined)
    result.object.c_before.should.equal('overwritten data')
  })
})
