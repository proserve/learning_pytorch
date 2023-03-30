const SystemVariable = require('../system-variable'),
      Fault = require('cortex-service/lib/fault'),
      Memo = require('../../../classes/memo'),
      { pathParts } = require('../../../utils')

class SystemVariable$BODY extends SystemVariable {

  parse(value, expression) {

    expression.root.registerVariable('$$BODY')

    const [root, path = ''] = pathParts(value)

    if (root !== '$$BODY') {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$$BODY must start with $$BODY.`, path: expression.fullPath })
    }

    super.parse(
      path,
      expression
    )

  }

  async evaluate(ec) {

    const { ac: { req } } = ec

    let value = ec.root.getVariable('$$BODY')
    if (!value) {

      value = new Memo({
        data: req && req.body,
        additiveSize: true,
        initialSize: null,
        readOnlyApi: true
      })

      ec.root.setVariable('$$BODY', value)
    }

    return ec.readObject(value, this.value)

  }

}

module.exports = SystemVariable$BODY
