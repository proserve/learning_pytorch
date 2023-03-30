const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$toUpper extends Operator {

  parse(value, expression) {

    super.parse(ExpressionFactory.guess(value, { parent: expression }), expression)
  }

  async evaluate(ec) {

    return (await this.value.evaluate(ec)).toUpperCase()

  }

}

module.exports = Operator$toUpper
