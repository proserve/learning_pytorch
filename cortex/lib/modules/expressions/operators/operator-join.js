const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { array: toArray, isSet } = require('../../../utils'),
      { isLiteralArray } = require('../expression-utils')

class Operator$join extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfSize(2)(expression, this, value)

    super.parse(
      [
        ExpressionFactory.guess(isLiteralArray(value[0]) ? { $array: value[0] } : value[0], { parent: expression, path: 0 }),
        ExpressionFactory.guess(value[1], { parent: expression, path: '1' })
      ],
      expression
    )
  }

  async evaluate(ec) {

    const [array, separator] = await Promise.all(
      this.value.map(expression => expression.evaluate(ec))
    )
    return toArray(array, isSet(array)).join(separator)

  }

}

module.exports = Operator$join
