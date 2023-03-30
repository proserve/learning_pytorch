const Operator$convert = require('./operator-convert')

class Operator$toNumber extends Operator$convert {

  parse(value, expression) {

    super.parse(
      {
        input: value,
        to: 'Number'
      },
      expression
    )
  }

}

module.exports = Operator$toNumber
