const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$stdDevPop extends Operator {

  parse(value, expression) {

    ExpressionRules.mustBeArray(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {
    const arr = await Promise.all(
            this.value.map(expression => expression.evaluate(ec))
          ),
          mean = arr.reduce((acc, val) => acc + val, 0) / arr.length
    return Math.sqrt(
      arr.reduce((acc, val) => acc.concat((val - mean) ** 2), []).reduce((acc, val) => acc + val, 0) /
        arr.length
    )
  }

}

module.exports = Operator$stdDevPop
