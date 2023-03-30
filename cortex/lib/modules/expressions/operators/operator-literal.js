const Operator = require('../operator'),
      { markLiteralObject } = require('../expression-utils'),
      clone = require('clone')

class Operator$literal extends Operator {

  async evaluate(ec) {
    void ec
    return markLiteralObject(clone(this.value))
  }

}

module.exports = Operator$literal
