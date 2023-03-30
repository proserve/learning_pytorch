const SystemVariable = require('../system-variable'),
      Fault = require('cortex-service/lib/fault'),
      { pathParts } = require('../../../utils')

class SystemVariable$ENV extends SystemVariable {

  parse(value, expression) {

    const [root, path = ''] = pathParts(value)

    if (root !== '$$ENV') {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$$ENV must start with $$ENV.`, path: expression.fullPath })
    }

    super.parse(
      path,
      expression
    )

  }

  async evaluate(ec) {

    const { ac: { org } } = ec

    return ec.readObject(org, this.value)

  }

}

module.exports = SystemVariable$ENV
