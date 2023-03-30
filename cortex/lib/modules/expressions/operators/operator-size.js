const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      Fault = require('cortex-service/lib/fault')

class Operator$size extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {
    const val = await this.value.evaluate(ec)
    if (!Array.isArray(val)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$size expects an Array', path: ec.getFullPath(this.expression) })
    }
    return val.length
  }

}

module.exports = Operator$size
