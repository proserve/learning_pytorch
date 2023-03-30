const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$toBool extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )

  }

  async evaluate(ec) {

    return Boolean(await this.value.evaluate(ec))

  }

}

module.exports = Operator$toBool
