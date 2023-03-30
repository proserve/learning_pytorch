const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$jsonParse extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {

    return JSON.parse(await this.value.evaluate(ec))
  }

}

module.exports = Operator$jsonParse
