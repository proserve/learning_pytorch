const Operator = require('../operator'),
      Fault = require('cortex-service/lib/fault'),
      { ExpressionFactory } = require('../factory'),
      { isPlainObject } = require('../../../utils')

class Operator$throw extends Operator {

  parse(value, expression) {

    // accept a literal
    let input = value
    if (isPlainObject(input)) {
      if (!Object.keys(input).find(key => key[0] === '$')) {
        input = { $literal: input }
      }
    }

    super.parse(
      ExpressionFactory.guess(input, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {

    let obj = await this.value.evaluate(ec)
    if (typeof obj === 'string') {
      obj = { errCode: obj, object: 'fault' }
    }

    throw Fault.from(obj, false, true)

  }

}

module.exports = Operator$throw
