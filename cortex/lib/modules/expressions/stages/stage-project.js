const Stage = require('../stage'),
      { Empty, literalObjectOrArrayToExpression } = require('../expression-utils')

let Undefined

class Stage$project extends Stage {

  _parseStage(value) {

    return super._parseStage(literalObjectOrArrayToExpression(value))
  }

  async _next(ec, next) {

    const result = await super._next(ec, next)
    return result === Undefined ? Empty : result
  }

}

module.exports = Stage$project
