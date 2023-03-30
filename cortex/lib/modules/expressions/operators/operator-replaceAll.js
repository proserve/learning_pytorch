const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$replaceAll extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    super.parse(
      {
        input: ExpressionFactory.guess(value.input, { parent: expression }),
        find: ExpressionFactory.guess(value.find, { parent: expression }),
        replacement: ExpressionFactory.guess(value.replacement, { parent: expression })
      },
      expression
    )
  }

  async evaluate(ec) {

    const [input, find, replacement] = await Promise.all([
      this.value.input.evaluate(ec),
      this.value.find.evaluate(ec),
      this.value.replacement.evaluate(ec)
    ])

    return input.split(find).join(replacement)

  }

}

module.exports = Operator$replaceAll
