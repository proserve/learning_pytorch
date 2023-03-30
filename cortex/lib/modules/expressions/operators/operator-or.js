const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$or extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfAtLeastSize(1)(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {

    for (const expression of this.value) {
      if (await expression.evaluate(ec)) {
        return true
      }
    }
    return false

  }

}

module.exports = Operator$or
