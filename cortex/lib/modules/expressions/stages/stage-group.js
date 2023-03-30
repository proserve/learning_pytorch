const Stage = require('../stage'),
      IterableCursor = require('../../../classes/iterable-cursor'),
      { Empty } = require('../expression-utils'),
      Fault = require('cortex-service/lib/fault'),
      { without, pick } = require('underscore'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory, AccumulatorFactory, TypeFactory } = require('../factory'),
      { isPlainObject, isSet, deepEquals, promised } = require('../../../utils')

let Undefined

class StageIds {

  #ec
  #stage
  #idExpression
  #idKeys
  #states = new Set()

  constructor(ec, stage, idExpression) {
    this.#ec = ec
    this.#stage = stage
    this.#idExpression = idExpression
    this.#idKeys = isPlainObject(idExpression) && Object.keys(idExpression)
  }

  async get() {

    const expr = this.#idExpression

    if (!isSet(expr)) {
      return this.findOrCreate(Empty, false)
    }

    let _id

    if (this.#idKeys) {
      _id = {}
      await Promise.all(this.#idKeys.map(key => {
        return this.#idExpression[key].evaluate(this.#ec)
          .then(value => {
            _id[key] = value
          })
      }))
    } else {
      _id = await expr.evaluate(this.#ec)
    }

    return this.findOrCreate(_id)
  }

  findOrCreate(_id, withId = true) {

    let obj = this.find(_id, withId)
    if (!obj) {
      this.#states.add(obj = withId ? { _id } : {})
    }
    return obj
  }

  find(_id, withId = true) {

    for (const obj of this.#states.values()) {
      if (withId) {
        if (deepEquals(_id, obj._id)) {
          return obj
        }
      } else {
        return obj
      }
    }
    return Undefined

  }

  toOutput() {

    const { value: accumulatorExpressions } = this.#stage,
          keys = without(Object.keys(accumulatorExpressions), '_id')

    return new IterableCursor({
      name: this.#stage.name,
      iterable: this.#states,
      transform: state =>
        state === Empty
          ? state
          : keys.reduce(
            (memo, key) => {
              memo[key] = accumulatorExpressions[key].getValue(state[key])
              return memo
            },
            pick(state, '_id')
          ),
      filter: value => value !== Empty
    })

  }

}

// @todo max memory size. store in cache or output object

class Stage$group extends Stage {

  _parseStage(value) {

    ExpressionRules.valueMustBeObjectWithSubstance(this, this, value, `${this.fullPath}`, 'Stage')

    let _id = value._id

    if (!isSet(_id)) {
      _id = null
    } else if (isPlainObject(_id) && !ExpressionFactory.get('operator').isA(_id)) {
      _id = Object.keys(_id).reduce(
        (object, propertyName) => {
          ExpressionRules.mustBeUserVariableFormat(this, this, propertyName, `${this.fullPath}._id`, 'Stage')
          Object.assign(
            object, {
              [propertyName]: ExpressionFactory.guess(value._id[propertyName], { parent: this, path: `_id.${propertyName}` })
            })
          return object
        }, {})
    } else {
      _id = ExpressionFactory.guess(_id, { parent: this, path: '_id' })
    }

    return without(Object.keys(value), '_id').reduce(
      (object, propertyName) => {

        ExpressionRules.mustBeUserVariableFormat(this, this, propertyName, this.fullPath, 'Stage')

        const propertyKeys = isSet(value[propertyName]) && Object.keys(value[propertyName]),
              accumulatorName = propertyKeys && propertyKeys[0]

        if (!(isPlainObject(value[propertyName]) && propertyKeys.length === 1)) {
          throw Fault.create('cortex.invalidArgument.query', {
            reason: `A group accumulator must be an object with a single key.`,
            path: `${this.fullPath}.${propertyName}`
          })
        }

        Object.assign(
          object, {
            [propertyName]: AccumulatorFactory.require(accumulatorName.slice(1), value[propertyName][accumulatorName], this)
          })

        return object
      },
      { _id }
    )

  }

  async _next(ec, next) {
    return next
  }

  async _createInputCursor(ec, { input }) {

    const cursor = TypeFactory.create('Cursor').cast(input),
          inputCursor = await super._createOutputCursor(ec, { input: cursor })

    return this._accumulate(ec, inputCursor)
  }

  async _accumulate(ec, cursor) {

    const { value } = this,
          keys = without(Object.keys(value), '_id')

    let ids = new StageIds(ec, this, this.value._id)

    for await (const result of cursor) {

      if (result !== Empty) {

        ec.setVariable('$$ROOT', result)

        const state = await ids.get()

        await Promise.all(keys.map(key => {
          return value[key].evaluate(ec, state[key])
            .then(value => {
              state[key] = value
            })
        }))

      }

    }

    return ids.toOutput(value)

  }

}

module.exports = Stage$group
