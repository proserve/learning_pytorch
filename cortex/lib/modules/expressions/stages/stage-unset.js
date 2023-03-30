const Stage = require('../stage'),
      ExpressionRules = require('../expression-rules'),
      { array: toArray, isSet } = require('cortex-service/lib/utils/values'),
      safePathTo = require('../../../classes/pather').sandbox

let Undefined

class Stage$unset extends Stage {

  _parseStage(value) {

    value = toArray(value, isSet(value))
    ExpressionRules.tplMustBeArrayOfAtLeastSize(1)(this, this, value, `${this.fullPath}`)
    return value
  }

  async _next(ec, next) {

    for (const path of this.value) {
      try {
        safePathTo(next, path, Undefined)
      } catch (e) { void e }
    }

    return next
  }

}

module.exports = Stage$unset
