const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { array: toArray, isSet, rVal } = require('../../../utils')

let Undefined

class Operator$map extends Operator {

  parse(value, expression) {

    const variableName = rVal(value.as, 'this')

    ExpressionRules.valueMustBeObject(expression, this, value)
    ExpressionRules.mustBeUserVariableFormat(expression, this, variableName, `${expression.fullPath}.as`)

    expression.registerVariable(variableName)

    super.parse(
      {
        input: ExpressionFactory.guess(value.input, { parent: expression, path: 'input' }),
        as: variableName,
        in: ExpressionFactory.guess(value.in, { parent: expression, path: 'in' })
      },
      expression
    )
  }

  async evaluate(ec) {

    const result = await this.value.input.evaluate(ec),
          array = [],
          variableName = this.value.as

    if (!isSet(result)) {
      return []
    }

    for (const variable of toArray(result, true)) {
      ec.setVariable(variableName, variable)
      array.push(await this.value.in.evaluate(ec))
      ec.setVariable(variableName, Undefined)
    }

    return array

  }

}

module.exports = Operator$map
