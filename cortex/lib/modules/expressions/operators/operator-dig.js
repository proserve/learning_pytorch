const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { digIntoResolved } = require('../../../utils')

class Operator$dig extends Operator {

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

    const [document, path] = await Promise.all(
      this.value.map(expression => expression.evaluate(ec))
    )

    return digIntoResolved(document, path, false, false, true)
  }

}

module.exports = Operator$dig
