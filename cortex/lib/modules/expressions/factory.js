const fs = require('fs'),
      path = require('path'),
      isPlainObject = require('cortex-service/lib/utils/objects.is_plain_object'),
      { isCustomName } = require('../../utils'),
      logger = require('cortex-service/lib/logger'),
      Fault = require('cortex-service/lib/fault')

let Undefined

class Factory {

  #type = Undefined
  #dir = Undefined
  #map = Undefined

  #statics = false

  constructor(type, dir, statics = false) {

    this.#type = type
    this.#dir = dir
    this.#statics = !!statics
    this.#map = Undefined

  }

  get _registry() {

    if (!this.#map) {
      this.#map = new Map()
      for (const file of fs.readdirSync(this.#dir)) {
        try {
          const Cls = require(path.join(this.#dir, file))
          this.register(Cls)
        } catch (e) {
          logger.error(`error loading ${this.#type} ${file}`, e.toJSON({ stack: true }))
        }
      }
    }
    return this.#map

  }

  get type() {
    return this.#type
  }

  register(Cls) {

    const [, name] = Cls.name.split('$')
    if (name) {
      this._registry.set(name, Cls)
      if (typeof Cls.registered === 'function') {
        Cls.registered(this, name)
      }
    }
  }

  get(name) {

    return this._registry.get(name)
  }

  has(name) {

    return this._registry.has(name)
  }

  entries() {

    return Array.from(this._registry.entries())
  }

  create(name, ...params) {

    const Cls = this.get(name),
          cls = Cls
            ? this.#statics ? Cls : new Cls(...params)
            : Undefined

    if (cls && cls.initialize) {
      cls.initialize(...params)
    }

    return cls
  }

  require(name, ...params) {

    const value = this.create(name, ...params)

    if (!value) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `Unsupported ${this.#type} $${name}` })
    }

    return value
  }

}

class OperatorFactory extends Factory {

  constructor() {
    super('operator', path.join(__dirname, 'operators'))
  }

  create(name, ...params) {

    if (isCustomName(name, 'c_', true, /^[a-zA-Z0-9-_]{0,}$/)) {
      const Operator$expression = this.get('expression'),
            cls = new Operator$expression({ as: params[0], in: name }, ...params.slice(1))

      return cls
    }

    return super.create(name, ...params)
  }

}

class GuessingFactory extends Factory {

  #fallback = Undefined

  get fallback() {
    return this.#fallback
  }

  set fallback(fallback) {

    if (!this.has(fallback)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `Unregistered ${this.type} type ${fallback}` })
    }
    this.#fallback = fallback
  }

  guess(value, ...params) {

    const matches = this.entries().filter(([, Cls]) => Cls.isA(value)).map(([type]) => type)

    if (!matches[0]) {
      if (this.#fallback) {
        matches[0] = this.#fallback
      } else {
        if (isPlainObject(value)) {
          value = Object.keys(value)[0] || value
        }
        throw Fault.create('cortex.invalidArgument.query', { reason: `Unknown ${this.type} type ${value}` })
      }
    } else if (matches.length > 1) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `Ambiguous ${this.type} matches: ${matches}` })
    }

    return this.require(matches[0], value, ...params)
  }

}

module.exports = {
  ExpressionFactory: new GuessingFactory('expression', path.join(__dirname, 'expressions')),
  TypeFactory: new GuessingFactory('type', path.join(__dirname, 'types'), true),
  StageFactory: new GuessingFactory('stage', path.join(__dirname, 'stages')),
  OperatorFactory: new OperatorFactory(),
  ApiFactory: new Factory('operator', path.join(__dirname, 'apis')),
  AccumulatorFactory: new Factory('accumulator', path.join(__dirname, 'accumulators')),
  SystemVariableFactory: new Factory('system-variable', path.join(__dirname, 'system-variables'))
}
