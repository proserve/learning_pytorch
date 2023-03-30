const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$strcasecmp extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfSize(2)(expression, this, value)

    super.parse(value.map((entry, index) =>
      ExpressionFactory.guess(entry, { parent: expression, path: index })
    ), expression)
  }

  async evaluate(ec) {

    const [str1, str2] = await Promise.all(this.value.map(v => v.evaluate(ec))),
          sl1 = str1.toLowerCase(),
          sl2 = str2.toLowerCase()
    return sl1 > sl2 ? 1 : sl1 < sl2 ? -1 : 0

  }

}

module.exports = Operator$strcasecmp
