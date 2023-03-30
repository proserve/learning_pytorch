const Type = require('../type'),
      { isNumber, isBoolean } = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      { isNumeric, isValidDate } = require('../../../utils')

class Type$Number extends Type {

  static isA(value) {

    return isNumber(value)
  }

  static cast(value, { ac, path } = {}) {

    if (value == null) {
      return value
    }

    let casted = value

    if (isNumeric(value)) {
      if (typeof casted === 'string') {
        casted = Number(casted)
      }
      if (!(casted instanceof Number) && !(typeof casted === 'number')) {
        if (casted.toString && !Array.isArray(casted) && casted.toString() === Number(casted)) {
          casted = Number(casted)
        }
      }
      if (!isNaN(casted)) {
        return casted
      }
    } else if (isValidDate(value)) {
      return value.getTime()
    } else if (isBoolean(value)) {
      return Number(value)
    }

    throw Fault.create('cortex.invalidArgument.castError', { resource: ac && ac.getResource(), reason: `Could not cast "${value}" to Number.`, path })
  }

}

module.exports = Type$Number
