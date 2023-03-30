const Operator = require('../operator'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      Fault = require('cortex-service/lib/fault'),
      ExpressionRules = require('../expression-rules')

class Operator$setUnion extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfAtLeastSize(2)(expression, this, value)

    super.parse(
      value.map((entry, idx) => ExpressionFactory.guess(entry, { parent: expression, path: idx })),
      expression
    )
  }

  async evaluate(ec) {
    const items = await Promise.all(this.value.map(i => i.evaluate(ec))),
          hasInvalidInput = items.filter(i => !Array.isArray(i))

    if (hasInvalidInput.length) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$setUnion require array inputs', path: ec.getFullPath(this.expression) })
    }

    return [].concat(...items).reduce(function(a, b) {
      const exists = a.find(item => TypeFactory.guess(item).equals(item, b, { cast: false, strict: true }))
      if (!exists) {
        a.push(b)
      }
      return a
    }, [])
  }

}

module.exports = Operator$setUnion
