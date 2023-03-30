const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$trim extends Operator {

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

    const trim = (str, chars) => str.split(chars).filter(Boolean).join(chars),
          [input, chars = ' '] = await Promise.all([
            this.value.input.evaluate(ec),
            this.value.chars.evaluate(ec)
          ])

    return trim(input, chars)

  }

}

module.exports = Operator$trim
