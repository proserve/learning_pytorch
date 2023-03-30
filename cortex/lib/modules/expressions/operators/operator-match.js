const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$match extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    const match = {
      $and: Object.entries(value).reduce(
        (memo, [key, val]) => memo.concat({ $eq: [key, val] }),
        []
      )
    }

    super.parse(
      ExpressionFactory.guess(match, { parent: expression }),
      expression
    )

  }

  async evaluate(ec) {

    const { value } = this

    return value.evaluate(ec)
  }

}

module.exports = Operator$match
