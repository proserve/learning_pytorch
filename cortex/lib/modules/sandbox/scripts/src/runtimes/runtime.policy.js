
const Runtime = require('runtime.script'),
      { decorate } = require('decorator-utils'),
      { rNum } = require('util.values'),
      accessor = require('util.paths.accessor')

module.exports = {

  Runtime: class extends Runtime {

    constructor(Class, handler, options) {
      super(Class, handler, options[0])
    }

    static get runtimeType() {
      return 'policy'
    }

    static createDecorator() {
      const Runtime = this
      return function(...args) {
        return decorate(
          (Class, handler, descriptor, options) => {
            // if this is on a class property, assume there's no script component.
            if (descriptor && typeof descriptor.value === 'function') {
              Runtime.initialize(Class, handler, options)
            }
          },
          args
        )
      }
    }

    static _run(registered, options) {

      const {
              name, environment, weight,
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
              methodOptions = {
                runtime: {
                  name,
                  environment,
                  weight,
                  metadata: {
                    resource, className, methodName, static: isStatic, loc: { line, column }
                  }
                }
              }

        // assume this is a policy 'Script' action
        Object.assign(methodOptions, {
          req: require('request'),
          body: accessor(script.api.body, { extra: script.api.body }),
          halt() {
            script.api.policy.halt()
            script.exit()
          }
        })

        return this.callHandler(Class, handler, isStatic, methodOptions)

      }

      throw Fault.create('cortex.notFound.policy', { resource })

    }

  }

}
