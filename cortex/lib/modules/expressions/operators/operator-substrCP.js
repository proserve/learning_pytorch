const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      UnicodeString = require('../../../classes/unicode-string')

class Operator$substrCP extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfSize(3)(expression, this, value)

    super.parse(value.map((entry, index) =>
      ExpressionFactory.guess(entry, { parent: expression, path: index })
    ), expression)
  }

  async evaluate(ec) {

    const [ str, cpi, cpc ] = await Promise.all(this.value.map(v => v.evaluate(ec)))

    return (new UnicodeString(str)).substr(cpi, cpc)

  }

}

module.exports = Operator$substrCP
