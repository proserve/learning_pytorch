const Runtime = require('runtime.script'),
      { rNum } = require('util.values'),
      { env: { events: { load: loadRuntimeListeners } } } = require('runtime')

module.exports = {

  Runtime: class extends Runtime {

    constructor(Class, handler, params) {

      let options

      if (typeof params[0] === 'string') {
        const event = params[0]
        options = Object.assign(params[1] || {}, { event })
      } else {
        options = params[0]
      }

      super(Class, handler, options)
    }

    static get runtimeType() {
      return 'event'
    }

    static fire({ source, event, params } = {}) {

      const listeners = loadRuntimeListeners(event)

      listeners.forEach(listener => {

        const module = { exports: {} }
        this.run(
          require,
          module.exports,
          module,
          () => require(listener.metadata.scriptExport),
          { ...listener, source, event, params }

        )

      })

    }

    static callHandler(Class, handler, isStatic, params, info) {

      if (isStatic) {
        return Class[handler](...params, info)
      }

      const Constructor = Class.constructor,
            instance = new Constructor()

      return instance[handler](...params, info)

    }

    static _run(registered, options) {

      const {
              weight,
              metadata,
              params,
              source,
              event
            } = options,
            {
              context
            } = script,
            {
              className, methodName, static: isStatic
            } = metadata,
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

        const { Class, handler } = selected
        return this.callHandler(Class, handler, isStatic, params, { weight, source, metadata, event, context })

      }

    }

  }
}
