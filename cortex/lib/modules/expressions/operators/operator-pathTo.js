const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      safePathTo = require('../../../classes/pather').sandbox

class Operator$pathTo extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfLengthBetween(2, 3)(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {

    const [document, path, value] = await Promise.all(
      this.value.map(expression => expression.evaluate(ec))
    )

    if (this.value.length === 2) {
      return safePathTo(document, path)
    }
    return safePathTo(document, path, value, true)

  }

}

module.exports = Operator$pathTo
