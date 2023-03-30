const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { expressions: { TypeFactory } } = require('../../index'),
      TypeDate = TypeFactory.create('Date'),
      moment = require('moment-timezone')

let Undefined

class Operator$dateToParts extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    super.parse(
      {
        date: ExpressionFactory.guess(value.date, { parent: expression }),
        timezone: ExpressionFactory.guess(value.timezone, { parent: expression }),
        iso8601: ExpressionFactory.guess(value.iso8601, { parent: expression })
      },
      expression
    )
  }

  async evaluate(ec) {

    const { ac } = ec,
          [date, timezone, iso8601] = await Promise.all([
            this.value.date.evaluate(ec),
            this.value.timezone.evaluate(ec),
            this.value.iso8601.evaluate(ec)
          ])
    let value
    try {
      value = TypeDate.cast(date, { ac, path: ec.getFullPath(this.expression) })
    } catch (e) {
      return Undefined
    }

    // eslint-disable-next-line one-var
    let momentDate = moment(value)
    if (timezone) {
      momentDate = momentDate.tz(timezone)
    }

    // eslint-disable-next-line one-var
    const dateFields = {
      hour: momentDate.hour(),
      minute: momentDate.minute(),
      second: momentDate.second(),
      millisecond: momentDate.millisecond()
    }

    if (iso8601) {
      return {
        isoWeekYear: momentDate.isoWeekYear(),
        isoWeek: momentDate.isoWeek(),
        isoDayOfWeek: momentDate.isoWeekday(),
        ...dateFields
      }
    }

    return {
      year: momentDate.year(),
      month: momentDate.month(),
      day: momentDate.date(),
      ...dateFields
    }

  }

}

module.exports = Operator$dateToParts
