const Type = require('../type'),
      moment = require('moment'),
      { isDate } = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      { equals, couldBeId, createId, idToTimestamp, getValidDate } = require('../../../utils')

class Type$Date extends Type {

  static isA(value) {

    return isDate(value)
  }

  static cast(input, { ac, path, dateOnly = false } = {}) {

    if (input === null) {
      return input
    }

    let value = input,
        casted

    if (couldBeId(value)) {
      value = new Date(idToTimestamp(createId(value)))
    }

    if (dateOnly) {
      casted = moment.utc(value, 'YYYY-MM-DD')
      if (casted.isValid()) {
        return casted.startOf('day').toDate()
      }
      throw Fault.create('cortex.invalidArgument.castError', { resource: ac && ac.getResource(), reason: `Could not cast "${input}" to Date. String expected in YYYY-MM-DD format`, path })
    }

    if (value instanceof Date) {
      if (value.toString() !== 'Invalid Date') {
        return value
      }
    }

    if (typeof value !== 'undefined') {
      if (value instanceof Number || typeof value === 'number' || equals(String(value), Number(value), { strict: false })) {
        casted = new Date(Number(value))
      } else if (value.toString) {
        casted = new Date(value.toString())
      }
      if (casted.toString() !== 'Invalid Date') {
        return casted
      }
    }
    throw Fault.create('cortex.invalidArgument.castError', { resource: ac && ac.getResource(), reason: `Could not cast "${input}" to Date.`, path })
  }

  static $eq(a, b) {

    a = getValidDate(a)
    b = getValidDate(b)
    return a && b && a.getTime() === b.getTime()

  }

}

module.exports = Type$Date
