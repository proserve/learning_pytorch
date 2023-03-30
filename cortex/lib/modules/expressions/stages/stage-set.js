const Stage = require('../stage'),
      ExpressionRules = require('../expression-rules'),
      { getPlainObjectWithSingleKey } = require('../expression-utils'),
      { isPlainObject } = require('cortex-service/lib/utils/objects')

class Stage$set extends Stage {

  _parseStage(value) {

    ExpressionRules.valueMustBeObjectWithSubstance(this, this, value, `${this.fullPath}`, 'Stage')

    if (!getPlainObjectWithSingleKey(value, /^\$/)) {
      value = { $object: value }
    }

    return super._parseStage(value)
  }

  async _next(ec, next) {

    let result = await super._next(ec, next)

    if (isPlainObject(result)) {
      return { ...next, ...result }
    }

    return next
  }

}

module.exports = Stage$set
