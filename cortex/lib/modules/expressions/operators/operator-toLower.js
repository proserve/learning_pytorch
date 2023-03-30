const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$toLower extends Operator {

  parse(value, expression) {

    super.parse(ExpressionFactory.guess(value, { parent: expression }), expression)
  }

  async evaluate(ec) {

    return (await this.value.evaluate(ec)).toLowerCase()

  }

}

module.exports = Operator$toLower
