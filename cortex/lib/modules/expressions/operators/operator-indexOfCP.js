const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      Fault = require('cortex-service/lib/fault'),
      { isNumber } = require('underscore'),
      { isSet } = require('../../../utils'),
      UnicodeString = require('../../../classes/unicode-string')

class Operator$indexOfCP extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfLengthBetween(2, 4)(expression, this, value)

    super.parse(value.map((entry, index) =>
      ExpressionFactory.guess(entry, { parent: expression, path: index })
    ), expression)
  }

  async evaluate(ec) {

    let uStr,
        [ str, search, start, end ] = await Promise.all(this.value.map(v => v.evaluate(ec)))

    if (str === null) {
      return null
    }
    if (typeof str !== 'string') {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$indexOfBytes expects a string param', path: ec.getFullPath(this.expression) })
    }

    if (search === null) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$indexOfBytes search string cannot be null', path: ec.getFullPath(this.expression) })
    }

    if (isSet(start) && (!isNumber(start) || start < 0)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$indexOfBytes start param should be a non negative number', path: ec.getFullPath(this.expression) })
    }
    if (isSet(end) && (!isNumber(end) || end < 0)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$indexOfBytes end param should be a non negative number', path: ec.getFullPath(this.expression) })
    }
    if (isSet(start) && isSet(end) && end > start) {
      return -1
    }

    uStr = new UnicodeString(str)

    if (isSet(start) && start > uStr.length) {
      return -1
    }

    // eslint-disable-next-line one-var

    if (isSet(start) || isSet(end)) {
      if (end && !isSet(start)) {
        start = end
        end = uStr.length
      }
      // should slice
      return uStr.indexOf(search, start, end)
    }

    return uStr.indexOf(search)

  }

}

module.exports = Operator$indexOfCP
