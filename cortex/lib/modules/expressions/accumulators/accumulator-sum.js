const Accumulator = require('../accumulator'),
      { ExpressionFactory } = require('../factory'),
      { isSet, isNumeric } = require('../../../utils')

class Accumulator$sum extends Accumulator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec, state) {

    if (!isSet(state)) {
      state = {
        value: null
      }
    }

    const result = await this.value.evaluate(ec)

    if (isNumeric(result)) {
      if (state.value === null) {
        state.value = 0
      }
      state.value += parseFloat(result)
    }

    return state
  }

  getValue(state) {
    return state.value
  }

}

module.exports = Accumulator$sum
