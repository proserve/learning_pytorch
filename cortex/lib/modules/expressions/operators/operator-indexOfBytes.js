const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      Fault = require('cortex-service/lib/fault'),
      { isNumber } = require('underscore'),
      { isSet } = require('../../../utils')

class Operator$indexOfBytes extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfLengthBetween(2, 4)(expression, this, value)

    super.parse(value.map((entry, index) =>
      ExpressionFactory.guess(entry, { parent: expression, path: index })
    ), expression)
  }

  async evaluate(ec) {

    let buf,
        [ str, search, start, end ] = await Promise.all(this.value.map(v => v.evaluate(ec)))

    if (str === null) {
      return null
    }
    if (typeof str !== 'string') {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$indexOfBytes expects a string param', path: ec.getFullPath(this.expression) })
    }

    buf = Buffer.from(str)

    if (search === null) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$indexOfBytes search string cannot be null', path: ec.getFullPath(this.expression) })
    }

    if (isSet(start) && (!isNumber(start) || start < 0)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$indexOfBytes start param should be a non negative number', path: ec.getFullPath(this.expression) })
    }
    if (isSet(end) && (!isNumber(end) || end < 0)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$indexOfBytes end param should be a non negative number', path: ec.getFullPath(this.expression) })
    }
    if (isSet(start) && isSet(end) && start > end) {
      return -1
    }

    if (isSet(start) && start > buf.length) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$indexOfBytes start cannot be grater than byte length', path: ec.getFullPath(this.expression) })
    }

    // eslint-disable-next-line one-var

    if (isSet(start) || isSet(end)) {
      if (end && !isSet(start)) {
        start = end
        end = buf.length
      }
      // should slice
      buf = buf.slice(start, isSet(end) ? end : buf.length)
    }

    return buf.indexOf(Buffer.from(search))

  }

}

module.exports = Operator$indexOfBytes
