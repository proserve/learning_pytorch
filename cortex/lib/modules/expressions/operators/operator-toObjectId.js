const Operator$convert = require('./operator-convert')

class Operator$toObjectId extends Operator$convert {

  parse(value, expression) {

    super.parse(
      {
        input: value,
        to: 'ObjectId'
      },
      expression
    )
  }

}

module.exports = Operator$toObjectId
