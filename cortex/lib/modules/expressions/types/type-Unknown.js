const Type = require('../type')

class Type$Unknown extends Type {

  static isA() {
    return false
  }

  static cast(value) {
    return value
  }

  static registered(factory, name) {
    factory.fallback = name
  }

}

module.exports = Type$Unknown
