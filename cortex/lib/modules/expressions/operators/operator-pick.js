const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { pick } = require('underscore')

class Operator$pick extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfAtLeastSize(2)(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )

  }

  async evaluate(ec) {

    const [object, ...properties] = await Promise.all(
      this.value.map(expression => expression.evaluate(ec))
    )
    return pick(object, ...properties)

  }

}

module.exports = Operator$pick
