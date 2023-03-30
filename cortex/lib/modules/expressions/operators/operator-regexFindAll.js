const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$regexFindAll extends Operator {

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
          regExp = new RegExp(regex, options),
          results = []
    let m
    while ((m = regExp.exec(input)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regExp.lastIndex) {
        regExp.lastIndex++
      }
      results.push(m)
    }
    return results

  }

}

module.exports = Operator$regexFindAll
