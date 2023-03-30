const SystemVariable = require('../system-variable'),
      Fault = require('cortex-service/lib/fault'),
      ExpressionRules = require('../expression-rules'),
      { pathParts, normalizeObjectPath } = require('../../../utils')

class SystemVariable$VAR extends SystemVariable {

  parse(value, expression) {

    const [name, rest = ''] = pathParts(value),
          normalized = normalizeObjectPath(rest),
          [variable, path = ''] = pathParts(normalized)

    if (name !== '$$VAR') {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$$VAR must start with $$VAR.`, path: expression.fullPath })
    }

    ExpressionRules.mustBeUserVariableFormat(expression, this, variable, expression.fullPath, 'SystemVariable')

    super.parse(
      {
        variable,
        path
      },
      expression
    )

  }

  async evaluate(ec) {

    const { variable, path } = this.value

    return ec.readObject(ec.getVariable(variable), path)
  }

}

module.exports = SystemVariable$VAR
