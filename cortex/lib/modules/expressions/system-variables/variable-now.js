const SystemVariable = require('../system-variable'),
      Fault = require('cortex-service/lib/fault')

/**
 * late-bound datetime value
 */
class SystemVariable$NOW extends SystemVariable {

  parse(value, expression) {

    expression.root.registerVariable('$$NOW')

    if (value !== '$$NOW') {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$$NOW cannot access properties.`, path: expression.fullPath })
    }

    super.parse(value, expression)

  }

  async evaluate(ec) {

    let now = ec.root.getVariable('$$NOW')
    if (!now) {
      now = new Date()
      ec.root.setVariable('$$NOW', now)
    }
    return now

  }

}

module.exports = SystemVariable$NOW
