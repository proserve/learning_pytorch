const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$toArray extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )

  }

  async evaluate(ec) {

    const value = await this.value.evaluate(ec)
    return Array.isArray(value) ? value : [value]

  }

}

module.exports = Operator$toArray
