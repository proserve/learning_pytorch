const Operator = require('../operator'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      ExpressionRules = require('../expression-rules'),
      { isLiteralArray } = require('../expression-utils')

class Operator$includes extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfSize(2)(expression, this, value)

    super.parse(
      [
        ExpressionFactory.guess(isLiteralArray(value[0]) ? { $array: value[0] } : value[0], { parent: expression, path: 0 }),
        ExpressionFactory.guess(value[1], { parent: expression, path: 1 })
      ],
      expression
    )
  }

  async evaluate(ec) {

    let [ source, search ] = await Promise.all(
      this.value.map(v => v.evaluate(ec))
    )

    if (Array.isArray(source)) {
      for (const value of source) {
        if (TypeFactory.guess(value).equals(value, search, { cast: false, strict: true, silent: true })) {
          return true
        }
      }
    } else if (typeof source === 'string') {
      return source.includes(search)
    }

    return false

  }

}

module.exports = Operator$includes
