const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$atanh extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {
    return Math.atanh(
      await this.value.evaluate(ec)
    )
  }

}

module.exports = Operator$atanh
