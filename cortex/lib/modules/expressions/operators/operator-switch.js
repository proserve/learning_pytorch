const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory')

class Operator$switch extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)
    ExpressionRules.mustBeArray(expression, this, value.branches, `${expression.fullPath}.branches`)

    super.parse(
      {
        branches: value.branches.map((branch, index) => {
          ExpressionRules.valueMustBeObject(expression, this, branch, `${expression.fullPath}.branches.${index}`)
          return {
            case: ExpressionFactory.guess(branch.case, { parent: expression, path: `branches.${index}.case` }),
            then: ExpressionFactory.guess(branch.then, { parent: expression, path: `branches.${index}.then` })
          }
        }),
        default: ExpressionFactory.guess(value.default, { parent: expression, path: 'default' })
      },
      expression
    )
  }

  async evaluate(ec) {

    const { value } = this,
          { branches } = value

    for (const branch of branches) {
      if (await branch.case.evaluate(ec)) {
        return branch.then.evaluate(ec)
      }
    }
    return value.default.evaluate(ec)

  }

}

module.exports = Operator$switch
