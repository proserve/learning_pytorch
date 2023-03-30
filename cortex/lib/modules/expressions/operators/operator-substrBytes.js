const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$substrBytes extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfSize(3)(expression, this, value)

    super.parse(value.map((entry, index) =>
      ExpressionFactory.guess(entry, { parent: expression, path: index })
    ), expression)
  }

  async evaluate(ec) {

    const [ str, start, end ] = await Promise.all(this.value.map(v => v.evaluate(ec))),
          buf = Buffer.from(str)
    return buf.slice(start, start + end).toString()

  }

}

module.exports = Operator$substrBytes
