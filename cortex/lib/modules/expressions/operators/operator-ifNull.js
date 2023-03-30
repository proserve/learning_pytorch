const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { isSet } = require('../../../utils')

class Operator$ifNull extends Operator {

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

    const result = await this.value[0].evaluate(ec)

    return isSet(result)
      ? result
      : this.value[1].evaluate(ec)

  }

}

module.exports = Operator$ifNull
