const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$isArray extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {

    const array = await this.value.evaluate(ec)

    return Array.isArray(array)
  }

}

module.exports = Operator$isArray
