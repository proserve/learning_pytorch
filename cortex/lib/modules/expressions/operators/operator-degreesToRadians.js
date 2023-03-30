const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$degreesToRadians extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {
    const value = await this.value.evaluate(ec)
    return value * (Math.PI / 180)
  }

}

module.exports = Operator$degreesToRadians
