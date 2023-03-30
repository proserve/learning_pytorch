const Expression = require('../expression'),
      { isLiteral } = require('../expression-utils')

class Expression$literal extends Expression {

  static isA(value) {

    return isLiteral(value)
  }

}

module.exports = Expression$literal
