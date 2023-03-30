/* global script, Fault, ObjectID */

const { rNum, rInt, rBool, clamp, isSet, isFunction } = require('util.values'),
      { WritableBufferedApiCursor } = require('util.cursor'),
      { decorate } = require('decorator-utils'),
      { max } = Math,
      Runtime = require('runtime.script'),
      accessor = require('util.paths.accessor'),
      Handlers = ['error', 'result', 'beforeAll', 'before', 'each', 'after', 'afterAll'],
      Properties = {
        opsThreshold: {
          defaultValue: 0.8,
          symbol: Symbol('Transform.opsThreshold')
        },
        msThreshold: {
          defaultValue: 0.8,
          symbol: Symbol('Transform.msThreshold')
        },
        minMs: {
          defaultValue: 0,
          symbol: Symbol('Transform.minMs')
        },
        minOps: {
          defaultValue: 0,
          symbol: Symbol('Transform.minOps')
        },
        useMemoApi: {
          defaultValue: false,
          symbol: Symbol('Transform.useMemoApi')
        }
      },
      PropertyValues = Object.values(Properties)

Object.freeze(Handlers)

let Undefined

class Transform {

  constructor(options, runtime) {

    for (const property of PropertyValues) {
      this[property.symbol] = property.defaultValue
    }
    if (typeof options === 'object') {
      for (const option of Object.keys(options)) {
        const Prop = Properties[option]
        if (isSet(Prop)) {
          this[option] = options[option]
        } else if (Handlers.includes(option) && isFunction(options[option])) {
          this[option] = options[option]
        }
      }
    }

  }

  get opsThreshold() {
    return this[Properties.opsThreshold.symbol]
  }

  get msThreshold() {
    return this[Properties.msThreshold.symbol]
  }

  get minMs() {
    return this[Properties.minMs.symbol]
  }

  get minOps() {
    return this[Properties.minOps.symbol]
  }

  get useMemoApi() {
    return this[Properties.useMemoApi.symbol]
  }

  set opsThreshold(value) {
    this[Properties.opsThreshold.symbol] = clamp(rNum(value, Properties.opsThreshold.defaultValue), 0.0, 1.0)
  }

  set msThreshold(value) {
    this[Properties.msThreshold.symbol] = clamp(rNum(value, Properties.msThreshold.defaultValue), 0.0, 1.0)
  }

  set minMs(value) {
    this[Properties.minMs.symbol] = max(0, rInt(value, Properties.minMs.defaultValue))
  }

  set minOps(value) {
    this[Properties.minOps.symbol] = max(0, rInt(value, Properties.minOps.defaultValue))
  }

  set useMemoApi(value) {
    this[Properties.useMemoApi.symbol] = rBool(value, Properties.useMemoApi.defaultValue)
  }

  static get Handlers() {
    return Handlers
  }

  static create(options, runtime) {

    if (options instanceof Transform) {
      return options
    }

    let Class = Transform
    if (options === Transform || (options && options.prototype instanceof Transform)) {
      Class = options
      options = Undefined
    } else if (typeof options === 'function') {
      Class = options
      return new Class(runtime)
    }
    return new Class(options, runtime)

  }

}

function hasHandler(instance, name) {
  return isFunction(instance[name])
}

function runHandler(instance, name, ...args) {
  if (isFunction(instance[name])) {
    return instance[name](...args)
  }
  return Undefined
}

function getProperty(instance, name) {
  const prop = Properties[name]
  if (instance instanceof Transform) {
    return instance[prop.symbol]
  }
  return prop.defaultValue
}

class Runner {

  static run(instance) {

    const { context, api } = script,
          { kind } = context || {}

    if (context.err) {
      const err = Fault.from(context.err, true)
      runHandler(instance, 'error', err, { context })
      return
    }

    switch (kind) {

      case 'result': {

        const { getResult, setResult } = context

        if (hasHandler(instance, 'result')) {
          const result = runHandler(
            instance, 'result', getResult(), { context }
          )
          if (result !== Undefined) {
            setResult(result)
          }
        }
        break
      }

      case 'cursor': {

        const {
                runtime: runtimeApi,
                memo: memoApi,
                cursor: cursorApi,
                body: bodyApi
              } = api,
              {
                getOpsUsed,
                getOpsRemaining,
                getTimeLeft,
                getElapsedTime
              } = script,
              cursor = new WritableBufferedApiCursor(
                new ObjectID(),
                () => ({}),
                { shared: true, provider: cursorApi }
              ),
              body = accessor(bodyApi, { extra: bodyApi }),
              opsThreshold = getOpsRemaining() * getProperty(instance, 'opsThreshold'),
              msThreshold = getTimeLeft() * getProperty(instance, 'msThreshold'),
              minMs = getProperty(instance, 'minMs'),
              minOps = getProperty(instance, 'minOps'),
              useMemoApi = getProperty(instance, 'useMemoApi'),
              isOverThreshold = () =>
                getOpsUsed() > opsThreshold ||
                getElapsedTime() > msThreshold ||
                getTimeLeft() < minMs ||
                getOpsRemaining() < minOps,
              willExit = () => script.exited || isOverThreshold()

        if (!runtimeApi.ended) {

          const memo = useMemoApi ? memoApi : memoApi.get()

          let count = 0

          script.on('exit', () => {
            if (!useMemoApi) {
              memoApi.set(null, memo)
            }
          })

          if (runtimeApi.count === 1) {
            runHandler(instance, 'beforeAll', memo, { cursor, body, context })
            if (willExit()) {
              return
            }
          }

          runHandler(instance, 'before', memo, { cursor, body, context })

          if (!willExit() && !runtimeApi.ending) {

            const hasEach = hasHandler(instance, 'each')

            if (!hasEach) {
              let hasNext = cursor.hasNext()
              while (hasNext) {
                const { hasNext: resultHasNext, count: pushedCount } = cursorApi.passthru({ count: 1 })
                count += pushedCount
                hasNext = resultHasNext
                if (willExit()) {
                  break
                }
              }
            } else {
              for (let object of cursor) {
                object = runHandler(instance, 'each', object, memo, { cursor, body, context })
                if (object !== Undefined) {
                  cursor.push(object)
                  count += 1
                }
                if (willExit() || !cursor.hasNext()) {
                  break
                }
              }
            }

          }

          runHandler(instance, 'after', memo, { cursor, body, count, context })
          if (willExit()) {
            return
          }

          if (!cursor.hasNext() || runtimeApi.ending) {
            runtimeApi.setEnded()
            runHandler(instance, 'afterAll', memo, { cursor, body, context })
          }

        }

        break
      }
    }

    return null

  }

}

class TransformRuntime extends Runtime {

  constructor(Class, handler, params) {

    let options

    if (typeof params[0] === 'string') {
      const name = params[0]
      options = Object.assign(params[1] || {}, { name })
    } else {
      options = params[0]
    }

    super(Class, handler, options)
  }

  static get runtimeType() {
    return 'transform'
  }

  static createDecorator() {
    const Runtime = this
    return function(...options) {
      const Class = options[0]
      if (Class && options.length === 1 && isFunction(Class)) {
        Runtime.initialize(Class, null, [])
      } else {
        return decorate(
          (Class, args, descriptor) => {
            if (descriptor && typeof descriptor.value === 'function') {
              throw new TypeError(`@${Runtime.runtimeType} can only be used on class declarations`)
            }
            Runtime.initialize(Class, null, options)
          },
          options
        )
      }
    }
  }

  static run(require, exports, module, main, options) {

    if (options && options.metadata && options.metadata.adhoc) {

      main(require, module.exports, module)

      const Class = module.exports,
            instance = new Class()

      return Runner.run(instance, options)
    }

    return super.run(require, exports, module, main, options)

  }

  static _run(registered, options) {

    const {
            name, environment, weight,
            metadata: {
              resource, className, loc: { line, column } = {}, scriptExport
            }
          } = options,
          optionsSignature = `${className}.${name}.${rNum(weight, 0)}`

    let selected

    for (const candidate of registered) {

      const { Class, options } = candidate,
            signature = `${Class.name}.${options.name || scriptExport}.${rNum(options.weight, 0)}`

      if (optionsSignature === signature) {
        selected = candidate
        break
      }
    }

    if (selected) {
      const { Class } = selected,
            transformOptions = {
              runtime: {
                name,
                environment,
                weight,
                metadata: {
                  resource, className, loc: { line, column }
                }
              }
            }

      return Runner.run(
        Transform.create(Class, transformOptions)
      )

    }

    throw Fault.create('cortex.notFound.script', { reason: 'Missing transform.', resource })

  }

}

module.exports = {

  Transform,
  Runtime: TransformRuntime,
  Runner

}
