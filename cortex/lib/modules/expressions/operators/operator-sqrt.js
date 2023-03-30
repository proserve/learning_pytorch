const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$sqrt extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {
    return Math.sqrt(
      await this.value.evaluate(ec)
    )
  }

}

module.exports = Operator$sqrt
