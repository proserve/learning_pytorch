const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      { isSet } = require('../../../utils'),
      { isFunction } = require('underscore')

class Operator$toString extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )

  }

  async evaluate(ec) {

    let result = await this.value.evaluate(ec)

    if (isSet(result)) {
      if (isFunction(result.toString)) {
        result = result.toString()
      } else {
        result = String(result)
      }
    }
    return result

  }

}

module.exports = Operator$toString
