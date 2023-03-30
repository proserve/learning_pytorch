const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$abs extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {
    return Math.abs(
      await this.value.evaluate(ec)
    )
  }

}

module.exports = Operator$abs
