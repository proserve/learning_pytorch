const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      ExpressionRules = require('../expression-rules'),
      Fault = require('cortex-service/lib/fault')

class Operator$allElementsTrue extends Operator {

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
    )

    if (!Array.isArray(items[0])) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator$allElementsTrue expects an Array', path: ec.getFullPath(this.expression) })
    }

    return items[0].filter(item => [null, 0, undefined].indexOf(item) === -1).length === items[0].length

  }

}

module.exports = Operator$allElementsTrue
