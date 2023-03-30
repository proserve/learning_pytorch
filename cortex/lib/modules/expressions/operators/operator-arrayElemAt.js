const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      ExpressionRules = require('../expression-rules'),
      { isNumber } = require('underscore'),
      Fault = require('cortex-service/lib/fault')

class Operator$arrayElemAt extends Operator {

  parse(value, expression) {
    ExpressionRules.tplMustBeArrayOfSize(2)(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {

    const [arr, idx] = await Promise.all(
      this.value.map(v => v.evaluate(ec))
    )
    if (!Array.isArray(arr)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$arrayElementAt expects first param to be Array', path: ec.getFullPath(this.expression) })
    }
    if (!isNumber(idx)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$arrayElementAt expects second param to be Number', path: ec.getFullPath(this.expression) })
    }
    return arr[idx > -1 ? idx : arr.length - Math.abs(idx)]

  }

}

module.exports = Operator$arrayElemAt
