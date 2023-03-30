/* global script, Fault */

const Runtime = require('runtime.script'),
      { rNum } = require('util.values'),
      accessor = require('util.paths.accessor')

module.exports = {

  Runtime: class extends Runtime {

    constructor(Class, handler, params) {

      let options

      if (typeof params[0] === 'string') {
        const [method, path] = params[0].split(' ')
        options = Object.assign(params[1] || {}, { method, path })
      } else {
        options = params[0]
      }

      super(Class, handler, options)
    }

    static get runtimeType() {
      return 'route'
    }

    static _run(registered, options) {

      const {
              name, type, principal, environment, weight,
              configuration: {
                method, path, authValidation, urlEncoded, plainText, apiKey, priority, acl
              },
              metadata: {
                resource, className, methodName, static: isStatic, loc: { line, column } = {}
              }
            } = options,
            optionsSignature = `${className}.${methodName}.${rNum(weight, 0)}`,
            req = require('request'),
            res = require('response')

      let selected

      for (const candidate of registered) {

        const { Class, handler, options } = candidate,
              signature = `${isStatic ? Class.name : Class.constructor.name}.${handler}.${rNum(options.weight, 0)}`

        if (optionsSignature === signature) {
          selected = candidate
          break
        }
      }

      function next(err) {
        script.api.route.next(err)
        script.exit()
      }

      if (selected) {
        const { Class, handler } = selected,
              methodOptions = {
                req,
                res,
                body: accessor(script.api.body, { extra: script.api.body }),
                next,
                runtime: {
                  name,
                  type,
                  principal,
                  environment,
                  weight,
                  configuration: {
                    method, path, authValidation, urlEncoded, plainText, apiKey, priority, acl
                  },
                  metadata: {
                    resource, className, methodName, static: isStatic, loc: { line, column }
                  }
                }
              }

        return this.callHandler(Class, handler, isStatic, methodOptions)

      }

      throw Fault.create('cortex.notFound.route', { resource })

    }

  }
}
