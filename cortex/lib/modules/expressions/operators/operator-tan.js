const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$tan extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {
    return Math.tan(
      await this.value.evaluate(ec)
    )
  }

}

module.exports = Operator$tan
