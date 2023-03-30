const Type = require('../type'),
      { isPlainObject, isSet, deepEquals } = require('../../../utils'),
      Fault = require('cortex-service/lib/fault')

class Type$Object extends Type {

  static isA(value) {
    return isPlainObject(value)
  }

  static $eq(a, b) {

    // @todo cast and type each value before comparison?
    return deepEquals(a, b)

  }

  static cast(value, { ac, path } = {}) {

    if (!isSet(value) || isPlainObject(value)) {
      return value
    }

    throw Fault.create('cortex.invalidArgument.castError', { resource: ac && ac.getResource(), reason: `Could not cast "${value}" to Object.`, path })

  }

}

module.exports = Type$Object
