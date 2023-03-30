const Expression = require('./expression'),
      ExpressionRules = require('./expression-rules'),
      { StageFactory } = require('./factory'),
      { array: toArray } = require('../../utils')

class Pipeline extends Expression {

  initialize(value, { parent = null, path = '' } = {}) {

    return super.initialize(value, { parent, path: [path, this.name].filter(v => v).join('.') })

  }

  get name() {

    return 'pipeline'
  }

  parse(value) {

    value = toArray(value)

    ExpressionRules.tplMustBeArrayOfAtLeastSize(1)(this, this, value)

    super.parse(
      value.map((entry, index) =>
        StageFactory.guess(entry, { parent: this, path: index })
      )
    )
  }

  async _evaluate(ec, { input } = {}) {

    const { value } = this

    let result = input

    for (const expression of value) {
      result = await expression.evaluate(ec, { input: result })
    }

    return result
  }

}

module.exports = Pipeline
