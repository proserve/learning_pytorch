const Operator = require('../operator'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      Fault = require('cortex-service/lib/fault'),
      ExpressionRules = require('../expression-rules'),
      { setArray } = require('../expression-utils')

class Operator$setEqual extends Operator {

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
      throw Fault.create('cortex.invalidArgument.query', { reason: '$setDifference require two array inputs', path: ec.getFullPath(this.expression) })
    }

    a = setArray(a)
    b = setArray(b)
    a.sort()
    b.sort()

    return TypeFactory.guess(a).equals(a, b, { cast: false, strict: true })
  }

}

module.exports = Operator$setEqual
