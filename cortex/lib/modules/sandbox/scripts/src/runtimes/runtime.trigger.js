/* global script */

const Runtime = require('runtime.script'),
      { rNum } = require('util.values'),
      accessor = require('util.paths.accessor'),
      { env: { trigger: triggerCustom } } = require('runtime')

function makeOptions(args, name) {
  const initial = []
  let options = {}
  for (let i = 0; i < args.length; i += 1) {
    if (typeof args[i] === 'string') {
      initial.push(args[i])
    } else {
      options = args[i]
      break
    }
  }
  return { [name]: initial, options }
}

module.exports = {

  Runtime: class extends Runtime {

    constructor(Class, handler, params) {

      const { events, options } = makeOptions(params, 'events')
      options.events = events

      super(Class, handler, options)
    }

    static get runtimeType() {
      return 'trigger'
    }

    static trigger(event, runtimeArguments) {
      return triggerCustom(event, runtimeArguments)
    }

    static _run(registered, options) {

      const {
              name, type, principal, environment, weight,
              configuration: {
                object, event, inline, paths
              },
              metadata: {
                resource, className, methodName, static: isStatic, loc: { line, column } = {}
              }
            } = options,
            optionsSignature = `${className}.${methodName}.${rNum(weight, 0)}`

      let selected

      for (const candidate of registered) {

        const { Class, handler, options } = candidate,
              signature = `${isStatic ? Class.name : Class.constructor.name}.${handler}.${rNum(options.weight, 0)}`

        if (optionsSignature === signature) {
          selected = candidate
          break
        }
      }

      if (selected) {

        const { Class, handler } = selected,
              {
                context, arguments: params = {}, inline: isInline, event: scriptEvent
              } = script,
              { old, new: deprecatedNew, modified, dryRun = false } = params,
              methodOptions = {
                memo: accessor(script.api.memo),
                context,
                old,
                previous: old,
                body: accessor(script.api.body, { extra: script.api.body }),
                new: deprecatedNew,
                current: deprecatedNew,
                modified,
                dryRun,
                params,
                inline: isInline,
                event: scriptEvent,
                runtime: {
                  name,
                  type,
                  principal,
                  environment,
                  weight,
                  configuration: {
                    object, event, inline, paths
                  },
                  metadata: {
                    resource, className, methodName, static: isStatic, loc: { line, column }
                  }
                }
              }

        return this.callHandler(Class, handler, isStatic, methodOptions)

      }

      try {
        require('logger').warn(`missing trigger for "${object}.${event}" expected in ${resource}`)
      } catch (err) {
      }

    }

  }
}
