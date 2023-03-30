const SystemVariable = require('../system-variable')

let Undefined

class SystemVariable$REMOVE extends SystemVariable {

  parse(value, expression) {

    super.parse(value, expression)

  }

  async evaluate(ec) {

    return Undefined

  }

}

module.exports = SystemVariable$REMOVE
