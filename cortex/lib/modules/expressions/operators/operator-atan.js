const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$atan extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {
    return Math.atan(await this.value.evaluate(ec))
  }

}

module.exports = Operator$atan
