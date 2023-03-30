const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$radiansToDegrees extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {
    const value = await this.value.evaluate(ec)
    return value * (180 / Math.PI)
  }

}

module.exports = Operator$radiansToDegrees
