const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      ExpressionRules = require('../expression-rules')

class Operator$pow extends Operator {

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
    const [value, exp] = await Promise.all(
      this.value.map(expression => expression.evaluate(ec))
    )
    return Math.pow(value, exp)
  }

}

module.exports = Operator$pow
