const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      { isSet } = require('../../../utils'),
      Fault = require('cortex-service/lib/fault')

let Undefined

class Operator$convert extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    super.parse(
      {
        input: ExpressionFactory.guess(value.input, { parent: expression, path: 'input' }),
        to: ExpressionFactory.guess(value.to, { parent: expression, path: 'to' }),
        onError: isSet(value.onError) ? ExpressionFactory.guess(value.onError, { parent: expression, path: 'onError' }) : Undefined,
        onNull: isSet(value.onNull) ? ExpressionFactory.guess(value.onNull, { parent: expression, path: 'onNull' }) : Undefined
      },
      expression
    )
  }

  async evaluate(ec) {

    let result

    const { value } = this,
          [ input, to ] = await Promise.all([
            value.input.evaluate(ec),
            value.to.evaluate(ec)
          ]),
          type = TypeFactory.has(to) && TypeFactory.create(to)

    result = input

    if (!type) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$convert expects a valid output type`, path: ec.getFullPath(this.expression) })
    }

    if (!isSet(result)) {
      if (isSet(value.onNull)) {
        return value.onNull.evaluate(ec)
      }
      return result
    }

    try {
      result = type.cast(input)
    } catch (err) {
      if (isSet(value.onError)) {
        return value.onError.evaluate(ec)
      }
      throw err
    }

    return result

  }

}

module.exports = Operator$convert
