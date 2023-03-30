const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      { cache } = require('../../../modules'),
      { promised } = require('../../../utils')

class Operator$cache extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {

    const { value } = this,
          { ac: { org } } = ec,
          key = await value.evaluate(ec)

    return promised(cache, 'get', org, key)
  }

}

module.exports = Operator$cache
