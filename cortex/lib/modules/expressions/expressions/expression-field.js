const Expression = require('../expression'),
      { isString } = require('underscore')

class Expression$field extends Expression {

  static isA(value) {

    return isString(value) && value.length > 1 && value[0] === '$' && value[1] !== '$'
  }

  parse(value) {

    super.parse(String(value).substr(1), this) // eg. $principal.xyz
  }

  async _evaluate(ec) {

    return ec.readObject(ec.getVariable('$$ROOT'), this.value)

  }

}

module.exports = Expression$field
