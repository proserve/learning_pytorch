const Operator = require('../operator'),
      Fault = require('cortex-service/lib/fault'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { rVal } = require('../../../utils')

let Undefined

/**
 * {
 *   $try: {
 *      input: {}, // expression that might throw
 *      as: 'err', // defaults to err
 *      in: {} // expression that catches
 *   }
 * }
 */
class Operator$try extends Operator {

  parse(value, expression) {

    const variableName = rVal(value.as, 'err')

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

    const { value } = this,
          variableName = value.as

    let result

    try {

      result = await value.input.evaluate(ec)

    } catch (err) {

      ec.setVariable(variableName, Fault.from(err, false, true).toJSON({ stack: false }))
      result = await value.in.evaluate(ec)
      ec.setVariable(variableName, Undefined)

    }

    return result
  }

}

module.exports = Operator$try
