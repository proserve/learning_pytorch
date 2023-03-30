const Type = require('../type'),
      { isRegExp, isString } = require('underscore'),
      { isSet } = require('../../../utils'),
      Fault = require('cortex-service/lib/fault')

class Type$RegExp extends Type {

  static isA(value) {

    return isRegExp(value)
  }

  static cast(value, { ac, path, allowRegExp = false } = {}) {

    if (!isSet(value)) {
      return value
    }

    if (isString(value)) {
      try {
        const match = value.match(/^\/(.*)\/(.*)/)
        if (match) {
          value = new RegExp(match[1], match[2])
        }
      } catch (err) {
        void err
      }
    }

    if (value instanceof RegExp) {
      return value
    }

    throw Fault.create('cortex.invalidArgument.castError', { resource: ac && ac.getResource(), reason: `Could not cast "${value}" to String.`, path })
  }

  static $eq(a, b) {

    return a.toString() === (b && b.toString())

  }

  static $cmp(a, b) {

    return a.toString().localeCompare(b && b.toString())

  }

}

module.exports = Type$RegExp
