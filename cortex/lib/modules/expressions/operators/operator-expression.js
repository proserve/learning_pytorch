const Operator = require('../operator'),
      Expression = require('../expression'),
      { VariableScope, AccessScope } = require('../scope'),
      ExpressionContext = require('../expression-context'),
      ExpressionRules = require('../expression-rules'),
      { literalObjectOrArrayToExpression } = require('../expression-utils'),
      { ExpressionFactory } = require('../factory'),
      { isCustomName } = require('../../../utils'),
      { getRuntime } = require('../../expressions')

let Undefined

class Operator$expression extends Operator {

  parse(value, expression) {

    if (isCustomName(value, 'c_', true, /^[a-zA-Z0-9-_]{0,}$/)) {
      value = {
        as: '$$ROOT',
        in: value
      }
    }

    ExpressionRules.valueMustBeObject(expression, this, value)

    super.parse(
      {
        as: value.as === '$$ROOT' || value.as === Undefined
          ? Undefined
          : ExpressionFactory.guess(
            literalObjectOrArrayToExpression(value.as),
            { parent: expression, path: 'as' }
          ),
        in: isCustomName(value.in, 'c_', true, /^[a-zA-Z0-9-_]{0,}$/)
          ? value.in
          : ExpressionFactory.guess(
            literalObjectOrArrayToExpression(value.in),
            { parent: expression, path: 'in' }
          )
      },
      expression
    )
  }

  async evaluate(ec) {

    const { as, in: definition } = this.value,
          { ac } = ec,
          { org } = ac,
          parent = ec,
          $$ROOT = as ? await as.evaluate(parent) : ec.getVariable('$$ROOT'),
          isRuntime = !(definition instanceof Expression),
          expression = isRuntime ? await getRuntime(org, definition, { type: 'expression' }) : definition

    if (!isRuntime && !as) {

      return expression.evaluate(ec)
    }

    if (!isRuntime) {

      // define a context with a new root.
      ec = new ExpressionContext({
        expression,
        parent,
        variableScope: new VariableScope(expression, parent.variableScope),
        variables: {
          $$ROOT
        }
      })

    } else {

      // always define a new context.
      ec = new ExpressionContext({
        expression,
        variableScope: new VariableScope(expression),
        accessScope: new AccessScope(ac),
        depth: parent.depth,
        path: `${parent.getFullPath()}.in.${definition}`,
        variables: {
          $$ROOT
        }
      })

    }

    parent.registerChildContext(expression.fullPath, ec)

    return ec.evaluate()

  }

}

module.exports = Operator$expression
