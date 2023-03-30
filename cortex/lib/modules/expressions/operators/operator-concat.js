const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { isSet } = require('../../../utils')

class Operator$concat extends Operator {

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
          ),
          found = results.filter(v => !isSet(v) || v === null)
    if (found.length) {
      return null
    }

    return results.reduce((memo, result) => `${memo}${result}`, ``)

  }

}

module.exports = Operator$concat
