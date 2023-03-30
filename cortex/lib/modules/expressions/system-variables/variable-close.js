const SystemVariable = require('../system-variable')

let Undefined

class SystemVariable$CLOSE extends SystemVariable {

  parse(value, expression) {

    super.parse(value, expression)

  }

  async evaluate(ec) {

    const cursor = ec.getVariable('$$OUTPUT')

    if (cursor) {
      return new Promise(resolve => {
        cursor.close(() => {
          resolve(Undefined)
        })
      })
    }

  }

}

module.exports = SystemVariable$CLOSE
