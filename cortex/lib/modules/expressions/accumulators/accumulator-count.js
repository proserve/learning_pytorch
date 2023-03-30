const Accumulator = require('../accumulator'),
      { ExpressionFactory } = require('../factory'),
      { Empty } = require('../expression-utils'),
      { isSet } = require('../../../utils')

let Undefined

class Accumulator$count extends Accumulator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec, state) {

    if (!isSet(state)) {
      state = 0
    }

    const result = await this.value.evaluate(ec)

    if (result !== Empty && result !== Undefined) {
      state += 1
    }

    return state
  }

}

module.exports = Accumulator$count
