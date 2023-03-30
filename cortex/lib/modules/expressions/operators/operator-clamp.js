const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { clamp } = require('../../../utils'),
      { ExpressionFactory } = require('../factory')

class Operator$clamp extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfSize(3)(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {

    const [value, min, max] = await Promise.all(
      this.value.map(expression => expression.evaluate(ec))
    )

    return clamp(value, min, max)

  }

}

module.exports = Operator$clamp
