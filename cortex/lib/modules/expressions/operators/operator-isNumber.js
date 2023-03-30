const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      { isNumber } = require('underscore')

class Operator$isNumber extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {

    const val = await this.value.evaluate(ec)

    return isNumber(val)
  }

}

module.exports = Operator$isNumber
