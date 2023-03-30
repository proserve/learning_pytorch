const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      moment = require('moment-timezone'),
      { isSet } = require('../../../utils'),
      { expressions: { TypeFactory } } = require('../../../modules'),
      TypeDate = TypeFactory.create('Date')

let Undefined

class Operator$dateToString extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    super.parse(
      {
        date: ExpressionFactory.guess(value.date, { parent: expression }),
        format: ExpressionFactory.guess(value.format, { parent: expression }),
        timezone: ExpressionFactory.guess(value.timezone, { parent: expression }),
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
          [ date, format, timezone ] = await Promise.all([
            value.date.evaluate(ec),
            value.format.evaluate(ec),
            value.timezone.evaluate(ec)
          ])
    let casted, result
    try {
      casted = TypeDate.cast(date, { ac, path: ec.getFullPath(this.expression) })
    } catch (e) {
      void e
    }

    if (casted) {
      result = moment(casted)
      if (timezone) {
        result.tz(timezone)
      }
      return result.format(format)
    }
    if (isSet(value.onNull)) {
      return value.onNull.evaluate(ec)
    }
    return Undefined
  }

}

module.exports = Operator$dateToString
