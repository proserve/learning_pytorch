const Accumulator = require('../accumulator'),
      { ExpressionFactory } = require('../factory'),
      { isSet, isPlainObject } = require('../../../utils')

class Accumulator$mergeObjects extends Accumulator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )

  }

  async evaluate(ec, state) {

    if (!isSet(state)) {
      state = { }
    }

    const result = await this.value.evaluate(ec)
    if (isPlainObject(result)) {
      Object.assign(state, result)
    }

    return state
  }

}

module.exports = Accumulator$mergeObjects
