const Api = require('../api')

class Api$console extends Api {

  static sandboxModule = 'console'

  parseInput(value, expression) {

    return {
      log: value
    }

  }

}

module.exports = Api$console
