const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$cos extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {
    return Math.cos(
      await this.value.evaluate(ec)
    )
  }

}

module.exports = Operator$cos
