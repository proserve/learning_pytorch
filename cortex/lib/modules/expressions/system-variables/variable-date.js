const SystemVariable = require('../system-variable'),
      Fault = require('cortex-service/lib/fault')

/**
 * current date
 */
class SystemVariable$DATE extends SystemVariable {

  parse(value, expression) {

    if (value !== '$$DATE') {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$$DATE cannot access properties.`, path: expression.fullPath })
    }

    super.parse(value, expression)

  }

  async evaluate(ec) {

    return new Date()

  }

}

module.exports = SystemVariable$DATE
