const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { getPlainObjectWithSingleKey } = require('../expression-utils'),
      { isPlainObject } = require('cortex-service/lib/utils/objects'),
      { ExpressionFactory } = require('../factory')

class Operator$object extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    super.parse(
      Object.keys(value).reduce(
        (object, key) => {
          let sub = value[key]
          if (isPlainObject(sub) && !getPlainObjectWithSingleKey(sub, /^\$/)) {
            sub = { $object: sub }
          }
          return Object.assign(
            object, {
              [key]: ExpressionFactory.guess(sub, { parent: expression, path: key })
            })
        },
        {}
      ),
      expression
    )

  }

  async evaluate(ec) {

    const { value } = this,
          output = {}

    await Promise.all(Object.keys(value).map(key => {
      return value[key].evaluate(ec)
        .then(value => {
          output[key] = value
        })
    }))

    return Object.keys(value).reduce(
      (result, key) => Object.assign(result, { [key]: output[key] }),
      {}
    )

  }

}

module.exports = Operator$object
