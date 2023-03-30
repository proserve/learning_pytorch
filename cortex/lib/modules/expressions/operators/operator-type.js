const Operator = require('../operator'),
      { ExpressionFactory, TypeFactory } = require('../factory')

class Operator$type extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {

    return TypeFactory.guess(
      await this.value.evaluate(ec)
    ).typeName

  }

}

module.exports = Operator$type
