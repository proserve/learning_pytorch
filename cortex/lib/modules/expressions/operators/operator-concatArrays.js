const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      ExpressionRules = require('../expression-rules'),
      Fault = require('cortex-service/lib/fault')

class Operator$concatArrays extends Operator {

  parse(value, expression) {
    ExpressionRules.mustBeArray(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {

    const items = await Promise.all(
            this.value.map(v => v.evaluate(ec))
          ),
          hasWrongValues = items.filter(item => !Array.isArray(item))

    if (hasWrongValues.length) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$concatArrays expects params to be Arrays', path: ec.getFullPath(this.expression) })
    }

    return [].concat(...items)

  }

}

module.exports = Operator$concatArrays
