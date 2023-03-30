const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      { rBool } = require('../../../utils')

class Operator$equals extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)
    ExpressionRules.tplMustBeArrayOfSize(2)(expression, this, value.input, `${expression.fullPath}.input`)

    super.parse(
      {
        input: value.input.map((entry, index) =>
          ExpressionFactory.guess(entry, { parent: expression, path: `input.${index}` })
        ),
        cast: ExpressionFactory.guess(value.cast, { parent: expression, path: 'cast' }),
        strict: ExpressionFactory.guess(value.strict, { parent: expression, path: 'strict' }),
        silent: ExpressionFactory.guess(value.silent, { parent: expression, path: 'silent' })
      },
      expression
    )
  }

  async evaluate(ec) {

    const [
      a,
      b,
      cast,
      strict,
      silent
    ] = await Promise.all([
      this.value.input[0].evaluate(ec),
      this.value.input[1].evaluate(ec),
      this.value.cast.evaluate(ec),
      this.value.strict.evaluate(ec),
      this.value.silent.evaluate(ec)
    ]
    )

    return TypeFactory.guess(a).equals(
      a,
      b,
      {
        cast: rBool(cast, true),
        strict: rBool(strict, true),
        silent: rBool(silent, false)
      })

  }

}

module.exports = Operator$equals
