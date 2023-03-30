const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$strLenBytes extends Operator {

  parse(value, expression) {

    super.parse(ExpressionFactory.guess(value, { parent: expression }), expression)
  }

  async evaluate(ec) {

    const str = await this.value.evaluate(ec),
          buf = Buffer.from(str)
    return buf.length

  }

}

module.exports = Operator$strLenBytes
