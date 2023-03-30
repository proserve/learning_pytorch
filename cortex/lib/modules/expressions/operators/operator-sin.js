const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$sin extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {
    return Math.sin(
      await this.value.evaluate(ec)
    )
  }

}

module.exports = Operator$sin
