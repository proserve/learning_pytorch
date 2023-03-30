const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { isSet } = require('../../../utils')

class Operator$multiply extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfLengthBetween(0, 100)(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {

    const results = await Promise.all(
      this.value.map(expression => expression.evaluate(ec))
    )

    return results.slice(1).reduce(
      (memo, result) => memo * result,
      isSet(results[0]) ? results[0] : NaN
    )

  }

}

module.exports = Operator$multiply
