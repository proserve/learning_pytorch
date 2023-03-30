const Type = require('../type'),
      { isSet } = require('../../../utils')

class Type$Null extends Type {

  static isA(value) {

    return !isSet(value)
  }

}

module.exports = Type$Null
