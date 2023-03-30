const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$regexMatch extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    super.parse(
      {
        input: ExpressionFactory.guess(value.input, { parent: expression }),
        regex: ExpressionFactory.guess(value.regex, { parent: expression }),
        options: ExpressionFactory.guess(value.options, { parent: expression })
      },
      expression
    )
  }

  async evaluate(ec) {

    const [input, regex, options] = await Promise.all([
            this.value.input.evaluate(ec),
            this.value.regex.evaluate(ec),
            this.value.options.evaluate(ec)
          ]),
          regExp = new RegExp(regex, options)

    return regExp.test(input)

  }

}

module.exports = Operator$regexMatch
