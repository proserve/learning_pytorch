const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { isNumber } = require('underscore'),
      Fault = require('cortex-service/lib/fault')

class Operator$slice extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfLengthBetween(2, 3)(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {

    const [items, position, numItems] = await Promise.all(
      this.value.map(v => v.evaluate(ec))
    )

    if (!Array.isArray(items)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$slice expects an Array as second argument', path: ec.getFullPath(this.expression) })
    }
    if (!isNumber(position) || !isNumber(numItems)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$slice expects second and third arguments to be a number ', path: ec.getFullPath(this.expression) })
    }

    return items.slice(position, numItems)

  }

}

module.exports = Operator$slice
