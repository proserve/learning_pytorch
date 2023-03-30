const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$ltrim extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    super.parse(
      {
        input: ExpressionFactory.guess(value.input, { parent: expression }),
        chars: ExpressionFactory.guess(value.chars, { parent: expression })
      },
      expression
    )
  }

  async evaluate(ec) {

    const ltrim = (str, chars) => str.replace(new RegExp('^[' + chars + ']+'), ''),
          [input, chars = ' '] = await Promise.all([
            this.value.input.evaluate(ec),
            this.value.chars.evaluate(ec)
          ])

    return ltrim(input, chars)

  }

}

module.exports = Operator$ltrim
