const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      moment = require('moment-timezone')

let Undefined

class Operator$dateFromParts extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    super.parse(
      {
        year: ExpressionFactory.guess(value.year, { parent: expression }),
        isoWeekYear: ExpressionFactory.guess(value.isoWeekYear, { parent: expression }),
        month: ExpressionFactory.guess(value.month, { parent: expression }),
        isoWeek: ExpressionFactory.guess(value.isoWeek, { parent: expression }),
        day: ExpressionFactory.guess(value.day, { parent: expression }),
        isoDayOfWeek: ExpressionFactory.guess(value.isoDayOfWeek, { parent: expression }),
        hour: ExpressionFactory.guess(value.hour, { parent: expression }),
        minute: ExpressionFactory.guess(value.minute, { parent: expression }),
        second: ExpressionFactory.guess(value.second, { parent: expression }),
        millisecond: ExpressionFactory.guess(value.millisecond, { parent: expression }),
        timezone: ExpressionFactory.guess(value.timezone, { parent: expression })
      },
      expression
    )
  }

  async evaluate(ec) {

    const { value } = this,
          [ year, isoWeekYear, month, isoWeek, day, isoDayOfWeek, hour, minute, second, millisecond, timezone ] = await Promise.all([
            value.year.evaluate(ec),
            value.isoWeekYear.evaluate(ec),
            value.month.evaluate(ec),
            value.isoWeek.evaluate(ec),
            value.day.evaluate(ec),
            value.isoDayOfWeek.evaluate(ec),
            value.hour.evaluate(ec),
            value.minute.evaluate(ec),
            value.second.evaluate(ec),
            value.millisecond.evaluate(ec),
            value.timezone.evaluate(ec)
          ])

    if (year && isoWeekYear) {
      return Undefined
    }
    if (isoWeek && !isoWeekYear) {
      return Undefined
    }
    if (isoDayOfWeek && !isoWeekYear) {
      return Undefined
    }

    let result
    if (isoWeekYear) {
      result = moment.utc({ hour, minute, second, millisecond })
      result.isoWeekYear(isoWeekYear)
      if (isoWeek) {
        result.isoWeek(isoWeek)
      }
      if (isoDayOfWeek) {
        result.isoWeekday(isoDayOfWeek)
      }
    } else {
      result = moment.utc({ year, month, day, hour, minute, second, millisecond })
    }
    if (timezone) {
      result = moment.tz(result.format(), timezone)
    }

    return result.toDate()

  }

}

module.exports = Operator$dateFromParts
