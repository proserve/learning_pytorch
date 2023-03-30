const SystemVariable = require('../system-variable'),
      Fault = require('cortex-service/lib/fault'),
      { pathParts, path: pathTo } = require('../../../utils')

class SystemVariable$SCRIPT extends SystemVariable {

  parse(value, expression) {

    expression.root.registerVariable('$$SCRIPT')

    const [root, path = ''] = pathParts(value)

    if (root !== '$$SCRIPT') {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$$SCRIPT must start with $$SCRIPT.`, path: expression.fullPath })
    }

    super.parse(
      path,
      expression
    )

  }

  async evaluate(ec) {

    const { ac } = ec

    let value = ec.root.getVariable('$$SCRIPT')
    if (!value) {
      value = pathTo(ac, 'script.environment.script')
      if (value) {
        ec.root.setVariable('$$SCRIPT', value)
      }
    }

    return ec.readObject(value, this.value)

  }

}

module.exports = SystemVariable$SCRIPT
