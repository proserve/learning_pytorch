const Operator = require('../operator'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      Fault = require('cortex-service/lib/fault'),
      ExpressionRules = require('../expression-rules'),
      { setArray } = require('../expression-utils')

class Operator$setIntersection extends Operator {

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
      throw Fault.create('cortex.invalidArgument.query', { reason: '$setIntersection require array inputs', path: ec.getFullPath(this.expression) })
    }

    return items.map(i => setArray(i)).reduce((a, b) => a.filter(c => b.find(item => TypeFactory.guess(item).equals(item, c, { cast: false, strict: true }))))
  }

}

module.exports = Operator$setIntersection
