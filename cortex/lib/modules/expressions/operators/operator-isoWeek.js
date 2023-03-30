const DateOperator = require('../date-operator'),
      { isValidDate } = require('../../../utils')

class Operator$isoWeek extends DateOperator {

  parse(value, expression) {
    if (isValidDate(value)) {
      super.parse({ date: value }, expression)
    } else {
      super.parse(value, expression)
    }
  }

  async evaluate(ec) {
    const result = await super.evaluate(ec)
    return result && result.isoWeek()
  }

}

module.exports = Operator$isoWeek
