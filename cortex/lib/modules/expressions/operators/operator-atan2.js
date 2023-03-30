const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$atan2 extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfSize(2)(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {
    const [a, b] = await Promise.all(
      this.value.map(expression => expression.evaluate(ec))
    )
    return Math.atan2(a, b)
  }

}

module.exports = Operator$atan2
