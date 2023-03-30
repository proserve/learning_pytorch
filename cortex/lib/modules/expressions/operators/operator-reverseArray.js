const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      Fault = require('cortex-service/lib/fault')

class Operator$reverseArray extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {

    const value = await this.value.evaluate(ec)
    if (!Array.isArray(value)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$reverseArray expects an Array', path: ec.getFullPath(this.expression) })
    }
    return value.reverse()

  }

}

module.exports = Operator$reverseArray
