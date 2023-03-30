const Api = require('../api')

class Api$intl extends Api {

  static sandboxModule = 'intl'
  static sandboxModuleIsFormatted = true
  static sandboxParamsAsArray = true

}

module.exports = Api$intl
