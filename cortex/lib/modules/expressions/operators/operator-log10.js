const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$log10 extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {
    const value = await this.value.evaluate(ec)
    return Math.log10(value)
  }

}

module.exports = Operator$log10
