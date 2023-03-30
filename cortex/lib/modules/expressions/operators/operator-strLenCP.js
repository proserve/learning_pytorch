const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$strLenCP extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression })
      , expression)
  }

  async evaluate(ec) {

    const str = await this.value.evaluate(ec)
    return str.length

  }

}

module.exports = Operator$strLenCP
