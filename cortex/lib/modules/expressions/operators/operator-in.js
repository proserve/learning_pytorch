const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      Fault = require('cortex-service/lib/fault')

class Operator$in extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfSize(2)(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {

    const [key, haystack] = await Promise.all(
            this.value.map(v => v.evaluate(ec))
          ),
          type = TypeFactory.guess(key)

    if (!Array.isArray(haystack)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$in expects an Array as second argument', path: ec.getFullPath(this.expression) })
    }

    return !!haystack.find(needle => type.equals(key, needle, { cast: false, strict: true }))

  }

}

module.exports = Operator$in
