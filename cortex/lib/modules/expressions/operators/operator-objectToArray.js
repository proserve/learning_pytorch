const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$objectToArray extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {

    const obj = await this.value.evaluate(ec)

    return Object.keys(obj).map(k => ({ 'k': k, 'v': obj[k] }))

  }

}

module.exports = Operator$objectToArray
