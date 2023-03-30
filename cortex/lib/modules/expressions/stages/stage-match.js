const Stage = require('../stage'),
      { Empty } = require('../expression-utils')

class Stage$match extends Stage {

  async _next(ec, next) {

    const result = await super._next(ec, next)
    return result ? next : Empty
  }

}

module.exports = Stage$match
