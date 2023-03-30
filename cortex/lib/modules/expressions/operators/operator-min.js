const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory, TypeFactory } = require('../factory')

class Operator$min extends Operator {

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

    let min = results[0]

    for (let i = 1; i < results.length; i += 1) {
      if (TypeFactory.guess(min).compare(results[i], min, { }) < 0) {
        min = results[i]
      }
    }

    return min

  }

}

module.exports = Operator$min
