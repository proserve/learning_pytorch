const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { isDate } = require('underscore')

class Operator$add extends Operator {

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

    const values = await Promise.all(
      this.value.map(expression => expression.evaluate(ec))
    )

    let hasDate = false, total = 0

    for (const value of values) {

      if (isDate(value)) {
        hasDate = true
        total += value.getTime()
      } else {
        total += parseFloat(value)
      }
    }

    return hasDate ? new Date(total) : total
  }

}

module.exports = Operator$add
