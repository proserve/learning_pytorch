const Operator = require('../operator'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      Fault = require('cortex-service/lib/fault'),
      ExpressionRules = require('../expression-rules'),
      { setArray } = require('../expression-utils')

class Operator$setIsSubset extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfSize(2)(expression, this, value)

    super.parse(
      value.map((entry, idx) => ExpressionFactory.guess(entry, { parent: expression, path: idx })),
      expression
    )
  }

  async evaluate(ec) {
    let [a, b] = await Promise.all(this.value.map(i => i.evaluate(ec)))

    if (!Array.isArray(a) || !Array.isArray(b)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$setIsSubset require array inputs', path: ec.getFullPath(this.expression) })
    }
    a = setArray(a)
    b = setArray(b)

    return a.every(e => b.find(x => TypeFactory.guess(x).equals(x, e, false, true, true)))
  }

}

module.exports = Operator$setIsSubset
