const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$cond extends Operator {

  parse(value, expression) {

    if (Array.isArray(value)) {
      ExpressionRules.tplMustBeArrayOfSize(3)(expression, this, value)
      value = {
        if: value[0],
        then: value[1],
        else: value[2]
      }
    } else {
      ExpressionRules.valueMustBeObject(expression, this, value)
    }

    super.parse(
      {
        if: ExpressionFactory.guess(value.if, { parent: expression, path: 'if' }),
        then: ExpressionFactory.guess(value.then, { parent: expression, path: 'then' }),
        else: ExpressionFactory.guess(value.else, { parent: expression, path: 'else' })
      },
      expression
    )
  }

  async evaluate(ec) {

    const { value } = this

    if (await value.if.evaluate(ec)) {
      return value.then.evaluate(ec)
    }
    return value.else.evaluate(ec)

  }

}

module.exports = Operator$cond
