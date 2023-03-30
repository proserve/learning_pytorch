const Type = require('../type'),
      { isString, isFunction } = require('underscore'),
      { isSet } = require('../../../utils'),
      Fault = require('cortex-service/lib/fault')

class Type$String extends Type {

  static isA(value) {

    return isString(value)
  }

  static cast(value, { ac, path, allowRegExp = false } = {}) {

    if (!isSet(value)) {
      return value
    }

    if (isString(value)) {
      return value
    }

    if (allowRegExp && value instanceof RegExp) {
      return value
    }

    if (isFunction(value.toString)) {
      return value.toString()
    }

    throw Fault.create('cortex.invalidArgument.castError', { resource: ac && ac.getResource(), reason: `Could not cast "${value}" to String.`, path })
  }

  static $cmp(a, b) {

    return a.localeCompare(b)

  }

}

module.exports = Type$String
