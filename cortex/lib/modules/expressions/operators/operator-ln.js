const Operator$log = require('./operator-log')

class Operator$ln extends Operator$log {

  parse(value, expression) {

    super.parse(
      [value, Math.E],
      expression
    )
  }

}

module.exports = Operator$ln
