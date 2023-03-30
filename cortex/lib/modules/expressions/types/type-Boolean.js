let Undefined

const Type = require('../type'),
      { isBoolean } = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      { stringToBoolean } = require('../../../utils'),
      valid = new Set([null, Undefined, true, false])

class Type$Boolean extends Type {

  static isA(value) {

    return isBoolean(value)
  }

  static cast(value, { ac, path } = {}) {

    if (valid.has(value)) {
      return value
    }

    const casted = stringToBoolean(value, false)
    if (casted == null) {
      throw Fault.create('cortex.invalidArgument.castError', { resource: ac && ac.getResource(), reason: `Could not cast "${value}" to Boolean.`, path })
    }
    return casted

  }

}

module.exports = Type$Boolean
