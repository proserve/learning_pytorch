const Accumulator = require('../accumulator'),
      { ExpressionFactory } = require('../factory'),
      { Empty } = require('../expression-utils'),
      { isSet, isId } = require('../../../utils'),
      hasher = require('object-hash')

let Undefined

function replacer(value) {

  if (value && isId(value)) {
    return value.toString()
  }
  return value
}

class Accumulator$addToSet extends Accumulator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec, state) {

    if (!isSet(state)) {
      state = new Map()
    }

    const result = await this.value.evaluate(ec)

    if (result !== Empty && result !== Undefined) {
      const hash = hasher(result, { replacer, algorithm: 'sha1', encoding: 'hex' })
      if (!state.has(hash)) {
        state.set(hash, result)
      }
    }

    return state
  }

  getValue(state) {

    return Array.from(state.values())
  }

}

module.exports = Accumulator$addToSet
