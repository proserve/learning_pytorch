const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$and extends Operator {

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
      if (!await expression.evaluate(ec)) {
        return false
      }
    }
    return true

  }

}

module.exports = Operator$and
