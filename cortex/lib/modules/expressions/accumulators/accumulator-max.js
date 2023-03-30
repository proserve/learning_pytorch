const Accumulator = require('../accumulator'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      { Empty } = require('../expression-utils'),
      { isSet } = require('../../../utils')

class Accumulator$max extends Accumulator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec, state) {

    if (!isSet(state)) {
      state = {
        type: null,
        value: null
      }
    }

    const result = await this.value.evaluate(ec)

    if (result !== Empty && isSet(result)) {
      if (state.type) {
        if (state.type.compare(result, state.value, { }) > 0) {
          state.value = result
        }
      } else {
        state.type = TypeFactory.guess(result)
        state.value = result
      }
    }

    return state
  }

  getValue(state) {

    return state.value
  }

}

module.exports = Accumulator$max
