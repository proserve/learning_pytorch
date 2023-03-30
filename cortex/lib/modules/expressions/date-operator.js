const Operator = require('./operator'),
      ExpressionRules = require('./expression-rules'),
      { ExpressionFactory } = require('./factory'),
      { isValidDate, getValidDate } = require('../../utils'),
      { expressions: { TypeFactory } } = require('../index'),
      TypeDate = TypeFactory.create('Date'),
      moment = require('moment-timezone')

let Undefined

class DateOperator extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    super.parse(
      {
        date: ExpressionFactory.guess(value.date, { parent: expression }),
        timezone: ExpressionFactory.guess(value.timezone, { parent: expression })
      },
      expression
    )
  }

  async evaluate(ec) {

    const [date, timezone] = await Promise.all([
            this.value.date.evaluate(ec),
            this.value.timezone.evaluate(ec)
          ]),
          { ac } = ec,
          value = getValidDate(
            TypeDate.cast(date, { ac, path: ec.getFullPath(this.expression) })
          )

    if (!isValidDate(value)) {
      return Undefined
    }
    let result = moment(value)
    if (timezone) {
      result.tz(timezone)
      if (result.tz() === Undefined) {
        return Undefined
      }
    }
    return result
  }

}

module.exports = DateOperator
