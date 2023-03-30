const Expression = require('../expression'),
      Fault = require('cortex-service/lib/fault'),
      { isPlainObject } = require('cortex-service/lib/utils/objects'),
      { isSet } = require('cortex-service/lib/utils/values'),
      { ApiFactory } = require('../factory')

class Expression$api extends Expression {

  static isA(value) {

    const keys = isSet(value) && Object.keys(value),
          key = keys && keys[0]

    return isPlainObject(value) && keys.length === 1 && key[0] === '$' && key[1] !== '$' && ApiFactory.has(key.slice(1))

  }

  initialize(value, { parent = null, path = '' } = {}) {

    const key = isSet(value) && Object.keys(value)[0]

    if (key) {
      path = [path, key].filter(v => v).join('.')
    }

    super.initialize(value, { parent, path })
  }

  parse(value) {

    const keys = isSet(value) && Object.keys(value),
          key = keys && keys[0]

    if (!(isPlainObject(value) && keys.length === 1)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `An expression must be an object with a single key.`, path: this.fullPath })
    }

    super.parse(ApiFactory.require(key.slice(1), value[key], this))

  }

  async _evaluate(ec) {

    return this.value.evaluate(ec)
  }

}

module.exports = Expression$api
