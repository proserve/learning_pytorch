const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$jsonStringify extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {

    return JSON.stringify(await this.value.evaluate(ec))
  }

}

module.exports = Operator$jsonStringify
