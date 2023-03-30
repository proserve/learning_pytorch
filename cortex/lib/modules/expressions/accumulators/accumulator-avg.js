const Accumulator = require('../accumulator'),
      { ExpressionFactory } = require('../factory'),
      { isSet, isNumeric } = require('../../../utils')

class Accumulator$avg extends Accumulator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec, state) {

    if (!isSet(state)) {
      state = {
        total: 0,
        count: 0,
        value: null
      }
    }

    const result = await this.value.evaluate(ec)

    if (isNumeric(result)) {
      state.total += parseFloat(result)
      state.count += 1
      state.value = state.total / state.count
    }

    return state
  }

  getValue(state) {

    return state.value
  }

}

module.exports = Accumulator$avg
