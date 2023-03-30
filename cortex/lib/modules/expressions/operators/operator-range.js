const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      ExpressionRules = require('../expression-rules'),
      { isNumber, range } = require('underscore'),
      Fault = require('cortex-service/lib/fault')

class Operator$range extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfSize(3)(expression, this, value)

    super.parse(
      value.map((entry, index) => {
        return ExpressionFactory.guess(entry, { parent: expression, path: index })
      }),
      expression
    )
  }

  async evaluate(ec) {

    const [start, end, step = 1] = await Promise.all(
      this.value.map(v => v.evaluate(ec))
    )

    if (!isNumber(start) || !isNumber(end) || !isNumber(step)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator$range expects numbers start, end and step', path: this.expression.fullPath })
    }

    return range(start, end, step)

  }

}

module.exports = Operator$range
