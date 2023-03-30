
const { decorate } = require('decorator-utils'),
      privates = Symbol('privates'),
      registeredTypes = {},
      { matchesEnvironment, rBool } = require('util.values')

module.exports = class Runtime {

  constructor(Class, handler, options) {

    options = options || {}

    this[privates] = {
      Class,
      handler,
      options,
      available: !!(rBool(options.active, true) && matchesEnvironment(options.environment))
    }

  }

  get Class() {
    return this[privates].Class
  }

  get handler() {
    return this[privates].handler
  }

  get options() {
    return this[privates].options
  }

  get runtimeType() {
    return this.constructor.runtimeType
  }

  get isAvailable() {
    return this[privates].available
  }

  static get runtimeType() {
    return ''
  }

  static createDecorator() {
    const Runtime = this
    return function(...args) {
      return decorate(
        (Class, handler, descriptor, options) => {
          if (!(descriptor && typeof descriptor.value === 'function')) {
            throw new TypeError(`@${Runtime.runtimeType} can only be used on class methods`)
          }
          Runtime.initialize(Class, handler, options)
        },
        args
      )
    }
  }

  static callHandler(Class, handler, isStatic, methodOptions) {

    if (isStatic) {
      return Class[handler](methodOptions)
    }

    const Constructor = Class.constructor,
          instance = new Constructor()

    return instance[handler](methodOptions)

  }

  static initialize(Class, handler, options) {

    const Runtime = this,
          { runtimeType } = Runtime,
          registeredType = registeredTypes[runtimeType] || (registeredTypes[runtimeType] = []),
          runtime = new Runtime(Class, handler, options)

    if (runtime.isAvailable) {
      registeredType.push(runtime)
    }

  }

  static run(require, exports, module, main, options) {

    // load the script. in this case, it's a script library.
    main(require, exports, module)

    const Runtime = this,
          { runtimeType } = Runtime,
          registeredType = registeredTypes[runtimeType] || []

    return Runtime._run(registeredType, options) // eslint-disable-line no-underscore-dangle

  }

}
