const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      ExpressionRules = require('../expression-rules'),
      { isPlainObjectWithSubstance } = require('../../../utils'),
      Fault = require('cortex-service/lib/fault')

class Operator$arrayToObject extends Operator {

  parse(value, expression) {

    ExpressionRules.mustBeArray(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {

    const items = await Promise.all(
      this.value.map(v => v.evaluate(ec))
    )

    for (const item of items) {
      const notOk = (!Array.isArray(item) || !isPlainObjectWithSubstance(item)) && ((Array.isArray(item) && item.length > 2) || (isPlainObjectWithSubstance(item) && (!item.k || !item.v)))
      if (notOk) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator$arrayToObject expects an Array or Object {k,v}', path: ec.getFullPath(this.expression) })
      }
    }

    let result = items.reduce((obj, item) => {
      let final = (Array.isArray(item) ? { [item[0]]: item[1] } : { [item.k]: item.v })
      return {
        ...obj,
        ...final
      }
    }, {})
    return result

  }

}

module.exports = Operator$arrayToObject
