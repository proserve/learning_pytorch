const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$rtrim extends Operator {

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

    const rtrim = (str, chars) => str.replace(new RegExp('[' + chars + ']+$'), ''),
          [input, chars = ' '] = await Promise.all([
            this.value.input.evaluate(ec),
            this.value.chars.evaluate(ec)
          ])

    return rtrim(input, chars)

  }

}

module.exports = Operator$rtrim
