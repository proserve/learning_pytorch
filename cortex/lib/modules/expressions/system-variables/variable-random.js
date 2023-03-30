const SystemVariable = require('../system-variable')

/**
 * random number
 */
class SystemVariable$RANDOM extends SystemVariable {

  parse(value, expression) {

    super.parse(value, expression)

  }

  async evaluate(ec) {

    return Math.random()

  }

}

module.exports = SystemVariable$RANDOM
