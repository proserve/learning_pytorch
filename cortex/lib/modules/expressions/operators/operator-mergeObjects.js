const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { isPlainObject } = require('../../../utils')

class Operator$mergeObjects extends Operator {

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

    return (
      await Promise.all(
        this.value.map(expression => expression.evaluate(ec))
      ))
      .reduce((memo, value) => {
        if (isPlainObject(value)) {
          Object.assign(memo, value)
        }
        return memo
      }, {})

  }

}

module.exports = Operator$mergeObjects
