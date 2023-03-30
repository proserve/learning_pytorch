const Api = require('../api')

class Api$echo extends Api {

  parseInput(value, expression) {

    return {
      echo: value
    }

  }

  'api@echo'(ec, instance, value) {

    return value

  }

}

module.exports = Api$echo
