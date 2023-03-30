const Operator = require('./operator'),
      { getPlainObjectWithSingleKey, isLiteral, literalObjectOrArrayToExpression } = require('./expression-utils'),
      { ExpressionFactory } = require('./factory'),
      Fault = require('cortex-service/lib/fault'),
      { array: toArray, isSet, isPlainObject, promised } = require('../../utils'),
      lazy = require('cortex-service/lib/lazy-loader').from({
        sandboxModules: () => require(`${__dirname}/../../modules/sandbox/apis`).local.module
      }),
      { createAccessor } = require('../../classes/privates'),
      AsyncFunction = Object.getPrototypeOf(async function() {}).constructor,
      modulePrivates = createAccessor()

let Undefined

class Api extends Operator {

  static multipleCommands = false // allow multiple commands
  static chainCommands = false // the instance becomes the result of the last command
  static sandboxModule = null
  static sandboxModuleIsFormatted = false
  static sandboxParamsAsArray = false

  static createExpressionApi(input, into = {}, parent = '', handlerObject = input) {

    return Object.keys(input || {}).reduce((into, name) => {

      const handlerFunction = input[name],
            path = [parent, name].filter(v => v).join('.')

      if (typeof handlerFunction === 'function') {

        const isAsync = handlerFunction instanceof AsyncFunction,
              sandboxParamsAsArray = this.sandboxParamsAsArray,
              expectedLength = isAsync
                ? Math.max(0, handlerFunction.length - 2) // [script], [message], ...
                : handlerFunction.length - 3 // script, message, ..., callback

        into[path] = function(ec, instance, ...payload) {

          const { script, message } = this.getSandboxParams(ec, instance),
                isVarArgs = handlerFunction.$is_var_args || sandboxParamsAsArray,
                payloadArguments = isVarArgs ? [payload] : payload

          if (!isVarArgs) {
            payloadArguments.length = expectedLength // script, message, ..., callback
          }

          if (isAsync) {
            return handlerFunction.call(handlerObject, script, message, ...payloadArguments)
          } else {
            return promised(handlerObject, handlerFunction, script, message, ...payloadArguments)
          }

        }

      } else if (isPlainObject(handlerFunction)) {

        if (this.sandboxModuleIsFormatted && ['classes', 'methods', 'statics'].includes(name)) {
          this.createExpressionApi(handlerFunction, into, parent, input[name])
        } else {
          this.createExpressionApi(handlerFunction, into, name, input)
        }

      }

      return into

    }, into)

  }

  static get api() {

    let api = modulePrivates(this, 'api')
    if (!api) {

      api = {}

      // wrap a sandbox module that is known to be safe.
      if (this.sandboxModule) {
        Object.assign(
          api,
          this.createExpressionApi(lazy.sandboxModules[this.sandboxModule])
        )
      }

      // read local 'api@' exposed methods
      Object.assign(
        api,
        Reflect.ownKeys(this.prototype)
          .filter(v => v.indexOf('api@') === 0)
          .map(v => Reflect.get(this.prototype, v))
          .filter(v => v)
          .filter(v => typeof v === 'function' && isSet(v.name) && v.length >= 2) // ec, instance
          .reduce((api, fn) => Object.assign(api, { [fn.name.slice(4)]: fn }), {})
      )

      api = new Map(Object.entries(api))

      modulePrivates(this, 'api', api)
    }
    return api

  }

  // --------------------------------------------------------

  parse(value, expression) {

    value = toArray(value, isSet(value))

    let input = Undefined,
        commandIndex = 0,
        commands = []

    for (let entry of value) {

      let commandName = getPlainObjectWithSingleKey(entry, /^[^$]/)

      if (!commandName && commandIndex === 0) {
        entry = this.parseInput(entry, expression)
        commandName = getPlainObjectWithSingleKey(entry, /^[^$]/)
        if (!commandName) {
          input = entry
        }
      }

      if (!commandName && commandIndex !== 0) {

        if (typeof entry === 'string' && isLiteral(entry)) {
          commandName = entry
          entry = {
            [commandName]: []
          }
        } else {
          throw Fault.create('cortex.invalidArgument.query', { reason: `${this.name} requires arguments to be objects with a single command as the key.`, path: `${expression.fullPath}.${commandIndex}` })
        }

      }

      if (commandName) {

        if (!this.allowMultipleCommands && commands.length > 0) {
          throw Fault.create('cortex.invalidArgument.query', { reason: `${this.name} does not support multiple commands.`, path: `${expression.fullPath}.${commandIndex}` })
        }

        commands.push(
          this.parseCommand(commandName, entry[commandName], commandIndex, expression)
        )

      }

      commandIndex += 1

    }

    super.parse({ input, commands },
      expression
    )
  }

  parseInput(value, expression) {

    return ExpressionFactory.guess(value, { parent: expression })

  }

  parseCommand(command, value, commandIndex, expression) {

    let cmd = this.api.get(command)

    if (!cmd) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `Unknown command ${command}.`, path: `${expression.fullPath}.${commandIndex}` })
    }

    return {
      name: command,
      params: toArray(value, value !== Undefined).map(
        (param, paramIndex) => ExpressionFactory.guess(literalObjectOrArrayToExpression(param), { parent: expression, path: `${commandIndex}.${command}.${paramIndex}` })
      )
    }

  }

  get allowMultipleCommands() {
    return this.constructor.multipleCommands
  }

  get chainCommands() {
    return this.constructor.chainCommands
  }

  get api() {
    return this.constructor.api
  }

  // this is temporary until we convert everything to contexts.
  getSandboxParams(ec, instance) {

    void instance

    const { ac } = ec,
          script = {
            ac,
            locale: ac.getLocale()
          },
          message = {}

    return { script, message }
  }

  async evaluate(ec) {

    const { api, value: { input, commands } } = this,
          inputValue = input && await input.evaluate(ec)

    let instance = await this.initializeInstance(ec, inputValue, commands),
        result

    for (const command of commands) {

      const method = api.get(command.name)

      if (method) {

        const isAsync = method instanceof AsyncFunction,
              params = await Promise.all(
                command.params.map(expression => expression.evaluate(ec))
              )

        result = method.call(this, ec, instance, ...params)
        if (isAsync || (!!result && (typeof result === 'object' || typeof result === 'function') && typeof result.then === 'function')) {
          result = await result
        }
        if (this.chainCommands) {
          instance = result
        }

      }

    }

    return this.finalizeInstance(ec, instance, result, commands)

  }

  async initializeInstance(ec, input) {

    void ec
    void input
    return Undefined
  }

  async finalizeInstance(ec, instance, result) {

    return result
  }

}

module.exports = Api
