const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      Fault = require('cortex-service/lib/fault'),
      { isNumeric } = require('cortex-service/lib/utils/values'),
      { isDate } = require('underscore')

class Operator$subtract extends Operator {

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

    const [a, b] = await Promise.all(
      this.value.map(expression => expression.evaluate(ec))
    )

    if (!((isDate(a) && isDate(b)) || (isNumeric(a) && isNumeric(b)) || (isDate(a) && isNumeric(b)))) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$subtract expects Date/Date, Number/Number or Date/Number', path: ec.getFullPath(this.expression) })
    }

    if (isDate(a)) {
      if (isDate(b)) {
        return a - b
      } else {
        return new Date(a - parseFloat(b))
      }
    }
    return parseFloat(a) - parseFloat(b)

  }

}

module.exports = Operator$subtract
