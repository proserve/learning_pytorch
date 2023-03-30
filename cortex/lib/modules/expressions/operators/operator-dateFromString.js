const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      moment = require('moment-timezone'),
      { isSet } = require('../../../utils'),
      { expressions: { TypeFactory } } = require('../../../modules'),
      TypeDate = TypeFactory.create('Date')

let Undefined

class Operator$dateFromString extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    super.parse(
      {
        dateString: ExpressionFactory.guess(value.dateString, { parent: expression }),
        format: ExpressionFactory.guess(value.format, { parent: expression }),
        timezone: ExpressionFactory.guess(value.timezone, { parent: expression }),
        onError: isSet(value.onError) ? ExpressionFactory.guess(value.onError, {
          parent: expression,
          path: 'onError'
        }) : Undefined,
        onNull: isSet(value.onNull) ? ExpressionFactory.guess(value.onNull, {
          parent: expression,
          path: 'onNull'
        }) : Undefined
      },
      expression
    )
  }

  async evaluate(ec) {

    const { value } = this,
          { ac } = ec,
          [ dateString, format, timezone ] = await Promise.all([
            value.dateString.evaluate(ec),
            value.format.evaluate(ec),
            value.timezone.evaluate(ec)
          ])
    let casted, result
    try {
      casted = TypeDate.cast(dateString, { ac, path: ec.getFullPath(this.expression) })
    } catch (e) {
      if (isSet(value.onError)) {
        return value.onError.evaluate(ec)
      }
    }

    if (casted) {
      result = moment.utc(casted, format)
      if (timezone) {
        result = result.tz(timezone)
      }
      return result.toDate()
    }
    if (isSet(value.onNull)) {
      return value.onNull.evaluate(ec)
    }
    return Undefined
  }

}

module.exports = Operator$dateFromString
