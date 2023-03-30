'use strict'

const Fault = require('cortex-service/lib/fault'),
      modules = require('../../../../modules'),
      { visit, array: toArray, promised } = require('../../../../utils')

module.exports = {

  version: '1.0.0',

  operations: {

    find: function(script, message, filter, callback) {

      modules.runtime.clusterFind(
        fixFilter(script, filter),
        callback
      )

    },

    cancel: function(script, message, filter, err, callback) {

      modules.runtime.clusterCancel(
        fixFilter(script, filter),
        err,
        callback
      )
    }

  },

  env: {

    read: async function(script) {

      return script.ac.org.getRuntime()
    },

    events: {

      load: async function(script, message, eventName) {

        const runtime = await script.ac.org.getRuntime(),
              events = []

        for (const event of toArray(runtime.events)) {

          if (event.configuration.event === eventName) {

            if (await modules.sandbox.fulfillsConditions(script.ac, event, { runtime, parentScript: script })) {
              events.push(event)
            }
          }
        }

        return events
      }

    },

    trigger: async function(script, message, event, runtimeArguments) {

      const { sandbox } = modules,
            { ScriptTypes: { trigger: TriggerScriptType } } = sandbox

      if (!TriggerScriptType.isValidCustomEvent(event)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid custom event name. Event name must be namespaced and end with .before/.after' })
      }

      return promised(
        sandbox,
        'triggerScript',
        event,
        script,
        script.ac,
        { object: 'system' },
        runtimeArguments || {}
      )

    }

  }

}

function fixFilter(script, filter) {

  filter = {
    ...(filter || {}),
    envId: script.ac.orgId.toString()
  }

  visit(filter, {
    fnObj: (obj, currentKey, parentObject, parentIsArray, depth, fullpath) => {},
    fnVal: (obj, currentKey, parentObject, parentIsArray, depth, fullpath) => {
      if (currentKey.trim().indexOf('$operation') === 0) {
        throw Fault.create('cortex.invalidArgument.query')
      }
    }
  })

  return filter

}
