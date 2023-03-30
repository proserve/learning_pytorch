const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      Fault = require('cortex-service/lib/fault'),
      ExpressionRules = require('../expression-rules'),
      { isSet } = require('../../../utils')

class Operator$zip extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    super.parse(
      {
        inputs: value.inputs.map((entry, idx) => ExpressionFactory.guess(entry, { parent: expression, path: idx })),
        useLongestLength: value.useLongestLength || false,
        defaults: isSet(value.defaults) ? ExpressionFactory.guess(value.defaults, { parent: expression }) : undefined
      },
      expression
    )
  }

  zip(...arrays) {
    const length = Math.min(...arrays.map(arr => arr.length))
    return Array.from({ length }, (value, index) => arrays.map(array => array[index]))
  }

  zipLongest(defaults = [], ...arrays) {
    const length = Math.max(...arrays.map(arr => arr.length))
    return Array.from(
      { length }, (value, index) => arrays.map(
        (array, idx) => array.length - 1 >= index ? array[index] : defaults.length - 1 >= idx ? defaults[idx] : null
      )
    )
  }

  async evaluate(ec) {
    const inputs = await Promise.all(this.value.inputs.map(i => i.evaluate(ec))),
          defaults = this.value.defaults ? await this.value.defaults.evaluate(ec) : undefined,
          hasNulls = inputs.filter(i => i === null),
          notArray = inputs.filter(i => !Array.isArray(i) && i !== null)
    if (hasNulls.length) {
      return null
    }
    if (notArray.length) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$zip does not allow null entries', path: ec.getFullPath(this.expression) })
    }

    if (isSet(defaults) && !Array.isArray(defaults)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$zip defaults must be array', path: ec.getFullPath(this.expression) })
    }

    if (isSet(defaults) && !this.value.useLongestLength) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$zip defaults must be used with useLongestLength:true', path: ec.getFullPath(this.expression) })
    }

    return this.value.useLongestLength ? this.zipLongest(defaults, ...inputs) : this.zip(...inputs)
  }

}

module.exports = Operator$zip
