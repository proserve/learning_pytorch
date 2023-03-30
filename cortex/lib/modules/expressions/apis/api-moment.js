const Api = require('../api'),
      moment = require('moment-timezone'),
      { array: toArray } = require('cortex-service/lib/utils/values'),
      { isPlainObject, isSet } = require('../../../utils'),
      { isNumber, isBoolean, isString } = require('underscore'),
      Fault = require('cortex-service/lib/fault')

class Api$moment extends Api {

  static multipleCommands = true
  static chainCommands = true

  async initializeInstance(ec, input) {
    return moment(input)
  }

  async finalizeInstance(ec, instance, result, commands) {

    if (commands.length === 0 || (result instanceof moment)) {
      return instance.toDate()
    }
    return ec.readObject(result)
  }

  validateDateInput(input, operator, ec) {
    if (!(moment.isMoment(input) || moment.isDate(input) || isNumber(input) || Array.isArray(input) || typeof date === 'string')) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `${operator} requires Moment|String|Number|Date|Array`, path: ec.getFullPath() })
    }
  }
  validateNumberInput(input, operator, ec) {
    if (isSet(input) && !isNumber(input)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `${operator} value must be a number`, path: ec.getFullPath() })
    }
  }

  'api@init'(ec, instance, value, type, options) {
    if (!(isString(type) && ['utc', 'tz'].includes(type))) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'api@init can be tz or utc', path: ec.getFullPath() })
    }

    let params = toArray(options, isSet(options))

    if (type === 'tz' && !isString(options[0])) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'api@init tz needs a timezone', path: ec.getFullPath() })
    }

    return moment[type](value, ...params)
  }

  'api@startOf'(ec, instance, unit) {
    if (isSet(unit) && typeof unit !== 'string') {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'api@startOf unit must be string', path: ec.getFullPath() })
    }
    return instance.startOf(unit)
  }

  'api@tz'(ec, instance, tz) {
    return instance.tz(tz)
  }

  'api@utc'(ec, instance, value) {
    return instance.utc(value)
  }

  'api@utcOffset'(ec, instance, value) {
    return instance.utcOffset(value)
  }

  'api@locales'(ec, instance) {
    return instance.locales()
  }

  'api@add'(ec, instance, value, type) {
    if (isPlainObject(value)) {
      return instance.add(value)
    } else if (isNumber(value) && typeof type === 'string') {
      return instance.add(value, type)
    }
    throw Fault.create('cortex.invalidArgument.query', { reason: 'api@add wrong parameters', path: ec.getFullPath() })
  }

  'api@diff'(ec, instance, date, type, strict) {
    this.validateDateInput(date, 'api@diff', ec)
    if (isSet(type) && typeof type !== 'string') {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'api@diff diff type must be string', path: ec.getFullPath() })
    }
    if (isSet(strict) && !isBoolean(strict)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'api@diff strict must be bool value', path: ec.getFullPath() })
    }
    return instance.diff(date, type, strict)
  }

  'api@endOf'(ec, instance, unit) {
    if (isSet(unit) && typeof unit !== 'string') {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'api@endOf unit must be string', path: ec.getFullPath() })
    }
    return instance.endOf(unit)
  }

  'api@format'(ec, instance, format) {
    if (isSet(format) && typeof format !== 'string') {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'api@format format must be string', path: ec.getFullPath() })
    }
    return instance.format(format)
  }

  'api@from'(ec, instance, date) {
    if (isSet(date)) {
      this.validateDateInput(date, 'api@from', ec)
    }
    return instance.from(date)
  }

  'api@fromNow'(ec, instance) {
    return instance.fromNow()
  }

  'api@to'(ec, instance, date) {
    if (isSet(date)) {
      this.validateDateInput(date, 'api@to', ec)
    }
    return instance.to(date)
  }

  'api@toNow'(ec, instance) {
    return instance.toNow()
  }

  'api@isAfter'(ec, instance, date) {
    if (isSet(date)) {
      this.validateDateInput(date, 'api@isAfter', ec)
    }
    return instance.isAfter(date)
  }

  'api@isBefore'(ec, instance, date) {
    if (isSet(date)) {
      this.validateDateInput(date, 'api@isBefore', ec)
    }
    return instance.isBefore(date)
  }

  'api@isBetween'(ec, instance, from, to) {
    this.validateDateInput(from, 'api@isBetween from', ec)
    this.validateDateInput(to, 'api@isBetween to', ec)
    return instance.isBetween(from, to)
  }

  'api@isSame'(ec, instance, date, unit) {
    this.validateDateInput(date, 'api@isSame', ec)
    if (isSet(unit) && typeof unit !== 'string') {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'api@isSame unit must be string', path: ec.getFullPath() })
    }
    return instance.isSame(date, unit)
  }

  'api@isSameOrAfter'(ec, instance, date, unit) {
    this.validateDateInput(date, 'api@isSameOrAfter', ec)
    if (isSet(unit) && typeof unit !== 'string') {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'api@isSameOrAfter unit must be string', path: ec.getFullPath() })
    }
    return instance.isSameOrAfter(date, unit)
  }

  'api@isSameOrBefore'(ec, instance, date, unit) {
    this.validateDateInput(date, 'api@isSameOrBefore', ec)
    if (isSet(unit) && typeof unit !== 'string') {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'api@isSameOrBefore unit must be string', path: ec.getFullPath() })
    }
    return instance.isSameOrBefore(date, unit)
  }

  'api@set'(ec, instance, unit, value) {
    if (!isPlainObject(unit) && !(typeof unit === 'string')) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'api@set unit must be string or object', path: ec.getFullPath() })
    }
    if (isSet(value) && !isNumber(value)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'api@set value must be number', path: ec.getFullPath() })
    }
    if (isPlainObject(unit)) {
      return instance.set(unit)
    }
    return instance.set(unit, value)
  }

  'api@get'(ec, instance, unit) {
    if (!(typeof unit === 'string')) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'api@set unit must be string', path: ec.expression.fullPath })
    }
    return instance.get(unit)
  }

  'api@subtract'(ec, instance, value, type) {
    if (isPlainObject(value)) {
      return instance.subtract(value)
    } else if (isNumber(value) && typeof type === 'string') {
      return instance.subtract(value, type)
    }
    throw Fault.create('cortex.invalidArgument.query', { reason: 'api@add wrong parameters', path: ec.expression.fullPath })
  }

  'api@toArray'(ec, instance) {
    return instance.toArray()
  }

  'api@toObject'(ec, instance) {
    return instance.toObject()
  }

  'api@toDate'(ec, instance) {
    return instance.toDate()
  }

  'api@toISOString'(ec, instance) {
    return instance.toISOString()
  }

  'api@inspect'(ec, instance) {
    return instance.inspect()
  }

  'api@toJSON'(ec, instance) {
    return instance.toJSON()
  }

  'api@toString'(ec, instance) {
    return instance.toString()
  }

  'api@unix'(ec, instance) {
    return instance.unix()
  }

  'api@valueOf'(ec, instance) {
    return instance.valueOf()
  }

  'api@year'(ec, instance, value) {
    this.validateNumberInput(value, 'api@year', ec)
    return instance.year(value)
  }

  'api@years'(ec, instance, value) {
    this.validateNumberInput(value, 'api@years', ec)
    return instance.years(value)
  }

  'api@isLeapYear'(ec, instance) {
    return instance.isLeapYear()
  }

  'api@weekYear'(ec, instance, value) {
    this.validateNumberInput(value, 'api@weekYear', ec)
    return instance.weekYear(value)
  }

  'api@isoWeekYear'(ec, instance, value) {
    this.validateNumberInput(value, 'api@isoWeekYear', ec)
    return instance.isoWeekYear(value)
  }

  'api@quarters'(ec, instance, value) {
    this.validateNumberInput(value, 'api@quarters', ec)
    return instance.quarters(value)
  }

  'api@quarter'(ec, instance, value) {
    this.validateNumberInput(value, 'api@quarter', ec)
    return instance.quarter(value)
  }

  'api@month'(ec, instance, value) {
    this.validateNumberInput(value, 'api@month', ec)
    return instance.month(value)
  }

  'api@months'(ec, instance, value) {
    this.validateNumberInput(value, 'api@months', ec)
    return instance.months(value)
  }

  'api@daysInMonth'(ec, instance) {
    return instance.daysInMonth()
  }

  'api@weeks'(ec, instance, value) {
    this.validateNumberInput(value, 'api@weeks', ec)
    return instance.weeks(value)
  }

  'api@week'(ec, instance, value) {
    this.validateNumberInput(value, 'api@week', ec)
    return instance.week(value)
  }

  'api@isoWeeks'(ec, instance, value) {
    this.validateNumberInput(value, 'api@isoWeeks', ec)
    return instance.isoWeeks(value)
  }

  'api@isoWeek'(ec, instance, value) {
    this.validateNumberInput(value, 'api@isoWeek', ec)
    return instance.isoWeek(value)
  }

  'api@weeksInYear'(ec, instance) {
    return instance.weeksInYear()
  }

  'api@isoWeeksInYear'(ec, instance) {
    return instance.isoWeeksInYear()
  }

  'api@date'(ec, instance, value) {
    this.validateNumberInput(value, 'api@date', ec)
    return instance.date(value)
  }

  'api@day'(ec, instance, value) {
    this.validateNumberInput(value, 'api@day', ec)
    return instance.day(value)
  }

  'api@days'(ec, instance, value) {
    this.validateNumberInput(value, 'api@days', ec)
    return instance.days(value)
  }

  'api@weekday'(ec, instance, value) {
    this.validateNumberInput(value, 'api@weekday', ec)
    return instance.weekday(value)
  }

  'api@isoWeekday'(ec, instance, value) {
    this.validateNumberInput(value, 'api@isoWeekday', ec)
    return instance.isoWeekday(value)
  }

  'api@dayOfYear'(ec, instance, value) {
    this.validateNumberInput(value, 'api@dayOfYear', ec)
    return instance.dayOfYear(value)
  }

  'api@hours'(ec, instance, value) {
    this.validateNumberInput(value, 'api@hours', ec)
    return instance.hours(value)
  }

  'api@hour'(ec, instance, value) {
    this.validateNumberInput(value, 'api@hour', ec)
    return instance.hour(value)
  }

  'api@minutes'(ec, instance, value) {
    this.validateNumberInput(value, 'api@minutes', ec)
    return instance.minutes(value)
  }

  'api@minute'(ec, instance, value) {
    this.validateNumberInput(value, 'api@minute', ec)
    return instance.minute(value)
  }

  'api@seconds'(ec, instance, value) {
    this.validateNumberInput(value, 'api@seconds', ec)
    return instance.seconds(value)
  }

  'api@second'(ec, instance, value) {
    this.validateNumberInput(value, 'api@second', ec)
    return instance.second(value)
  }

  'api@milliseconds'(ec, instance, value) {
    this.validateNumberInput(value, 'api@milliseconds', ec)
    return instance.milliseconds(value)
  }

  'api@millisecond'(ec, instance, value) {
    this.validateNumberInput(value, 'api@millisecond', ec)
    return instance.millisecond(value)
  }

  'api@local'(ec, instance, value) {
    return instance.local(value)
  }

  'api@isDST'(ec, instance) {
    return instance.isDST()
  }

  'api@isLocal'(ec, instance) {
    return instance.isLocal()
  }

  'api@isUtcOffset'(ec, instance) {
    return instance.isUtcOffset()
  }

  'api@isUTC'(ec, instance) {
    return instance.isUTC()
  }

  'api@zoneAbbr'(ec, instance) {
    return instance.zoneAbbr()
  }

  'api@zoneName'(ec, instance) {
    return instance.zoneName()
  }

  // TODO: calendar

}

module.exports = Api$moment
