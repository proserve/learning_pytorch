const Operator$convert = require('./operator-convert')

class Operator$toDate extends Operator$convert {

  parse(value, expression) {

    super.parse(
      {
        input: value,
        to: 'Date'
      },
      expression
    )
  }

}

module.exports = Operator$toDate
