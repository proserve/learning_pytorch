const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$acos extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {
    return Math.acos(
      await this.value.evaluate(ec)
    )
  }

}

module.exports = Operator$acos
