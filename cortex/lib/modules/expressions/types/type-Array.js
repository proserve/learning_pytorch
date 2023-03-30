const Type = require('../type'),
      { isSet, array: toArray, deepEquals } = require('../../../utils')

class Type$Array extends Type {

  static isA(value) {
    return Array.isArray(value)
  }

  static cast(value) {

    return toArray(value, isSet(value))
  }

  static $eq(a, b) {

    // @todo cast and type each value before comparison?
    return deepEquals(a, b)

  }

}

module.exports = Type$Array
