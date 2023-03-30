const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { array: toArray, isSet } = require('../../../utils')

let Undefined

class Operator$reduce extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    expression.registerVariable('value')
    expression.registerVariable('this')

    super.parse(
      {
        input: ExpressionFactory.guess(value.input, { parent: expression, path: 'input' }),
        initialValue: ExpressionFactory.guess(value.initialValue, { parent: expression, path: 'initialValue' }),
        in: ExpressionFactory.guess(value.in, { parent: expression, path: 'in' })
      },
      expression
    )
  }

  async evaluate(ec) {

    const result = await this.value.input.evaluate(ec)

    if (!isSet(result)) {
      return Undefined
    }

    let value = await this.value.initialValue.evaluate(ec)

    for (const entry of toArray(result, true)) {

      ec.setVariable('value', value)
      ec.setVariable('this', entry)
      value = await this.value.in.evaluate(ec)
    }

    ec.setVariable('value', Undefined)

    return value

  }

}

module.exports = Operator$reduce
