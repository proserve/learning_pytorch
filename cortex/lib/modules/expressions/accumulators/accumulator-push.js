const Accumulator = require('../accumulator'),
      { ExpressionFactory } = require('../factory'),
      { Empty } = require('../expression-utils'),
      { isSet } = require('../../../utils')

let Undefined

class Accumulator$push extends Accumulator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec, state) {

    if (!isSet(state)) {
      state = []
    }

    const result = await this.value.evaluate(ec)

    if (result !== Empty && result !== Undefined) {
      state.push(result)
    }

    return state
  }

}

module.exports = Accumulator$push
