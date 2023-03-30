const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      Fault = require('cortex-service/lib/fault'),
      { ExpressionFactory } = require('../factory'),
      { rBool, visit, isSet } = require('../../../utils')

let Undefined

class Operator$let extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    if (value.in === Undefined) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$let.in must be defined.`, path: expression.fullPath })
    }

    // treat in as a literal except for local variables
    const literal = rBool(value.literal, false)

    super.parse(
      {
        vars: ExpressionRules.parseUserVariables(expression, isSet(value.vars) ? value.vars : {}, 'vars', { register: true }),
        literal,
        in: ExpressionFactory.guess(literal ? { $literal: value.in } : value.in, { parent: expression, path: 'in' })
      },
      expression
    )
  }

  async evaluate(ec) {

    let result

    const variableNames = new Set(Object.keys(this.value.vars))

    for (const variableName of variableNames.values()) {
      ec.setVariable(
        variableName,
        await this.value.vars[variableName].evaluate(ec)
      )
    }

    result = await this.value.in.evaluate(ec)

    // replace key and values
    if (this.value.literal) {

      const getMatch = value => {
        if (typeof value === 'string' && value.startsWith('$$')) {
          const name = value.slice(2)
          if (variableNames.has(name)) {
            return name
          }
        }
        return Undefined
      }

      visit(result, {
        fnObj: (value, key, parent) => {
          const keyName = getMatch(key)
          if (isSet(keyName)) {
            parent[ec.getVariable(keyName)] = parent[key]
            delete parent[key]
          }
        },
        fnVal: (value, key, parent) => {
          const keyName = getMatch(key),
                valueName = getMatch(value)

          if (isSet(valueName)) {
            parent[key] = ec.getVariable(valueName)
          }
          if (isSet(keyName)) {
            parent[ec.getVariable(keyName)] = parent[key]
            delete parent[key]
          }
        }
      })

    }

    return result

  }

}

module.exports = Operator$let
