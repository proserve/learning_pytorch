const SystemVariable = require('../system-variable'),
      Fault = require('cortex-service/lib/fault'),
      { pathParts } = require('../../../utils')

class SystemVariable$ROOT extends SystemVariable {

  parse(value, expression) {

    const [root, path = ''] = pathParts(value)

    if (root !== '$$ROOT') {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$$ROOT must start with $$ROOT.`, path: expression.fullPath })
    }

    super.parse(
      path,
      expression
    )

  }

  async evaluate(ec) {

    return ec.readObject(ec.getVariable('$$ROOT'), this.value)

  }

}

module.exports = SystemVariable$ROOT
