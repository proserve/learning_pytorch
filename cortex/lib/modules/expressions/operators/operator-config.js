const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      { config } = require('../../../modules'),
      { promised } = require('../../../utils')

class Operator$config extends Operator {

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

    if (typeof key === 'string') {
      return promised(config, 'get', org, key)
    }
    return undefined
  }

}

module.exports = Operator$config
