const Operator = require('../operator'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      ExpressionRules = require('../expression-rules'),
      { isNumber, findIndex } = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      { isSet } = require('../../../utils')

class Operator$indexOfArray extends Operator {

  parse(value, expression) {
    ExpressionRules.tplMustBeArrayOfLengthBetween(2, 4)(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {

    let [ arr, search, start = 0, end ] = await Promise.all(
      this.value.map(v => v.evaluate(ec))
    )

    if (arr === null) {
      return null
    }
    if (!Array.isArray(arr)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$indexOfArr expects first param to be Array', path: ec.getFullPath(this.expression) })
    }
    if (isSet(start) && (!isNumber(start) || start < 0)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$indexOfArr expects start param to be a non negative number', path: ec.getFullPath(this.expression) })
    }
    if (isSet(end) && (!isNumber(end))) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$indexOfArr expects start param to be a non negative number', path: ec.getFullPath(this.expression) })
    }
    if (end && !isSet(start)) {
      start = end
      end = undefined
    }
    return findIndex(arr.slice(start, end), (item) => TypeFactory.guess(item).equals(item, search, { cast: false, strict: true }))

  }

}

module.exports = Operator$indexOfArray
