const Accumulator = require('../accumulator'),
      { ExpressionFactory } = require('../factory'),
      { Empty } = require('../expression-utils'),
      { isSet } = require('../../../utils')

let Undefined

class Accumulator$last extends Accumulator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec, state) {

    if (!isSet(state)) {
      state = { value: Undefined }
    }

    const result = await this.value.evaluate(ec)
    if (result !== Empty && result !== Undefined) {
      state.value = result
    }

    return state
  }

  getValue(state) {

    return state.value
  }

}

module.exports = Accumulator$last
