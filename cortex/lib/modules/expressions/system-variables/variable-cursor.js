const SystemVariable = require('../system-variable'),
      Fault = require('cortex-service/lib/fault'),
      { pathParts } = require('../../../utils')

class SystemVariable$CURSOR extends SystemVariable {

  parse(value, expression) {

    const [root, path = ''] = pathParts(value)

    if (root !== '$$CURSOR') {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$$CURSOR must start with $$CURSOR.`, path: expression.fullPath })
    }

    super.parse(
      path,
      expression
    )

  }

  async evaluate(ec) {

    return ec.readObject(ec.getVariable('$$CURSOR'), this.value)

  }

}

module.exports = SystemVariable$CURSOR
