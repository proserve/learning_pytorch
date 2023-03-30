
const Runtime = require('runtime.script'),
      { rNum } = require('util.values')

module.exports = {

  Runtime: class extends Runtime {

    constructor(Class, handler, params) {

      let options

      if (typeof params[0] === 'string') {
        if (typeof params[1] === 'string') {
          options = Object.assign(params[2] || {}, { cron: params[0], principal: params[1] })
        } else {
          options = Object.assign(params[1] || {}, { cron: params[0] })
        }
      } else {
        [options] = params
      }

      super(Class, handler, options)
    }

    static get runtimeType() {
      return 'job'
    }

    static _run(registered, options) {

      const {
              name, type, principal, environment, weight,
              configuration: {
                cron
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
                context
              } = script,
              methodOptions = {
                context,
                runtime: {
                  name,
                  type,
                  principal,
                  environment,
                  weight,
                  configuration: {
                    cron
                  },
                  metadata: {
                    resource, className, methodName, static: isStatic, loc: { line, column }
                  }
                }
              }

        return this.callHandler(Class, handler, isStatic, methodOptions)

      }

      try {
        require('logger').warn(`missing job expected in ${resource}`)
      } catch (err) {
      }
    }

  }
}
