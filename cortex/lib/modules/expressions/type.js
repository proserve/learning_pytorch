const { equals } = require('../../utils')

class Type {

  static isA(value) {

    void value

    return false
  }

  static cast(value) {

    return value
  }

  static equals(a, b, { cast = true, strict = false, silent = true } = {}) {

    try {

      if (cast) {
        b = this.cast(b)
      }

      return this.$eq(a, b, { strict })

    } catch (err) {

      if (silent) {
        return false
      }
      throw err

    }

  }

  static compare(a, b, { cast = true, strict = false, silent = true } = {}) {

    try {

      if (cast) {
        b = this.cast(b)
      }

      return this.$cmp(a, b, { strict })

    } catch (err) {

      if (silent) {
        return -1
      }
      throw err

    }

  }

  static $eq(a, b, { strict = true } = {}) {

    return equals(a, b, { strict })

  }

  static $cmp(a, b, { strict = true } = {}) {

    if (this.$eq(a, b, { strict })) {
      return 0
    }
    return (a > b) ? 1 : -1

  }

  static get typeName() {

    return this.name.split('$')[1]
  }

}

module.exports = Type
