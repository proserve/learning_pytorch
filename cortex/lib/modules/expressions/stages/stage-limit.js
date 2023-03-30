const Stage = require('../stage'),
      Fault = require('cortex-service/lib/fault'),
      { rInt } = require('../../../utils')

let Undefined

class Stage$limit extends Stage {

  _parseStage(value) {

    const limit = rInt(value, Undefined)

    if (limit === Undefined || limit < 1) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `Stage $limit requires a positive integer.`, path: this.fullPath })
    }
    return limit
  }

  async _next(ec, next) {

    return next

  }

  async _evaluate(ec, { input } = {}) {

    const outputCursor = await super._evaluate(ec, { input }),
          { value: limit } = this,
          next = outputCursor.next,
          hasNext = outputCursor.hasNext

    let count = 0

    outputCursor.hasNext = callback => {

      if (count >= limit) {
        callback(null, false)
      } else {
        hasNext.call(outputCursor, (err, has) => {
          callback(err, has && count < limit)
        })
      }

    }

    outputCursor.next = callback => {

      if (count >= limit) {
        outputCursor.close(() => {
          callback(null, Undefined)
        })
      } else {
        next.call(outputCursor, (err, result) => {
          if (!err && result !== Undefined) {
            count += 1
          }
          callback(err, result)
        })
      }

    }

    return outputCursor

  }

}

module.exports = Stage$limit
