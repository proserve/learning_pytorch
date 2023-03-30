const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$asin extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {
    return Math.asin(
      await this.value.evaluate(ec)
    )
  }

}

module.exports = Operator$asin
