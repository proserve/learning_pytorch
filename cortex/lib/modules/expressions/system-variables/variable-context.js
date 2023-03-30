const SystemVariable = require('../system-variable'),
      Fault = require('cortex-service/lib/fault'),
      { pathParts } = require('../../../utils')

class SystemVariable$CONTEXT extends SystemVariable {

  parse(value, expression) {

    const [root, path = ''] = pathParts(value)

    if (root !== '$$CONTEXT') {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$$CONTEXT must start with $$CONTEXT.`, path: expression.fullPath })
    }

    super.parse(
      path,
      expression
    )

  }

  async evaluate(ec) {

    const { ac } = ec

    return ec.readObject(ac, this.value)

  }

}

module.exports = SystemVariable$CONTEXT
