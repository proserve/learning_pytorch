const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$trunc extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfLengthBetween(1, 2)(expression, this, value)

    super.parse(
      value.map((entry, index) => ExpressionFactory.guess(entry, { parent: expression, path: index })),
      expression
    )
  }

  truncateToDecimals(num, dec) {
    const calcDec = Math.pow(10, dec)
    return Math.trunc(num * calcDec) / calcDec
  }

  async evaluate(ec) {

    const [ num, place = 0 ] = await Promise.all(
      this.value.map(v => v.evaluate(ec))
    )

    return this.truncateToDecimals(num, place)

  }

}

module.exports = Operator$trunc
