const Expression = require('./expression'),
      { ExpressionFactory, TypeFactory } = require('./factory'),
      Fault = require('cortex-service/lib/fault'),
      { isPlainObject, isSet } = require('../../utils'),
      IterableCursor = require('../../classes/iterable-cursor'),
      { Empty } = require('./expression-utils')

class Stage extends Expression {

  #ended = false
  #name
  #path

  static isA(value) {

    const keys = isSet(value) && Object.keys(value),
          key = keys && keys[0],
          name = `$${this.name.split('$')[1]}`

    return isPlainObject(value) && keys.length === 1 && key === name

  }

  parse(value) {

    this.registerVariable('$$ROOT')
    this.registerVariable('$$CURSOR')
    this.registerVariable('$$OUTPUT')

    const keys = isSet(value) && Object.keys(value),
          key = keys && keys[0]

    if (!(isPlainObject(value) && keys.length === 1 && key === this.name)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `${this.name} stage expects a single key named ${this.name}.`, path: this.fullPath })
    }
    if (!isSet(value[this.name])) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `${this.name} stage is empty`, path: this.fullPath })
    }

    super.parse(
      this._parseStage(value[this.name])
    )

  }

  _parseStage(value) {

    return ExpressionFactory.guess(value, { parent: this })

  }

  get ended() {
    return this.#ended
  }

  get path() {

    if (!this.#path) {
      this.#path = [super.path, this.name].join('.')
    }
    return this.#path

  }

  get name() {
    if (!this.#name) {
      this.#name = `$${this.constructor.name.split('$')[1]}`
    }
    return this.#name
  }

  async _next(ec, next) {
    ec.setVariable('$$ROOT', next)
    return this.value.evaluate(ec)
  }

  async _createInputCursor(ec, { input }) {

    void this
    return TypeFactory.create('Cursor').cast(input)
  }

  async _createOutputCursor(ec, { input }) {

    const outputCursor = new IterableCursor({
      iterable: input,
      transform: next => {
        return this._next(ec, next)
      },
      filter: next => next !== Empty,
      name: this.constructor.name
    })

    outputCursor.on('error', (err) => {
      const { ac } = ec
      if (!err.path) {
        err.path = ec.getFullPath(this)
      }
      if (!err.resource) {
        err.resource = ac.getResource()
      }
    })

    outputCursor.on('close', () => {
      input.close(() => {})
    })

    return outputCursor

  }

  async _evaluate(ec, { input } = {}) {

    let inputCursor,
        outputCursor

    const cursor = TypeFactory.create('Cursor').cast(input)
    ec.setVariable('$$CURSOR', cursor)

    inputCursor = await this._createInputCursor(ec, { input: cursor })
    outputCursor = await this._createOutputCursor(ec, { input: inputCursor })

    ec.setVariable('$$OUTPUT', outputCursor)

    return outputCursor

  }

}

module.exports = Stage
