const Stage = require('../stage'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      { driver: { Driver } } = require('../../../modules'),
      { isPlainObject } = require('../../../utils')

class Stage$cursor extends Stage {

  _parseStage(value) {

    // support both a plain object with options or an expression
    return isPlainObject(value) && !ExpressionFactory.get('operator').isA(value)
      ? ExpressionFactory.create('literal', value, { parent: this })
      : ExpressionFactory.guess(value, { parent: this })

  }

  async _next(ec, next) {
    return next
  }

  async _evaluate(ec, { input } = {}) {

    let previous
    try {
      previous = TypeFactory.create('Cursor').cast(input)
    } catch (e) {
      void e
    }
    if (previous) {
      ec.setVariable('$$CURSOR', previous)
      for await (const next of previous) {
        ec.setVariable('$$ROOT', next)
      }
    }

    const { ac } = ec,
          { principal, org, req, script } = ac,
          options = await this.value.evaluate(ec),
          object = await org.createObject(options && options.object),
          driver = new Driver(principal, object, { req, script }),
          operation = driver.createOperation('cursor', { parent: req && req.operation })

    return super._evaluate(
      ec,
      {
        input: await operation.execute(options, options)
      }
    )

  }

}

module.exports = Stage$cursor
