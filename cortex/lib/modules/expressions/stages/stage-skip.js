const Stage = require('../stage'),
      Fault = require('cortex-service/lib/fault'),
      { rInt } = require('../../../utils')

let Undefined

class Stage$skip extends Stage {

  _parseStage(value) {

    const skip = rInt(value, Undefined)

    if (skip === Undefined || skip < 1) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `Stage $skip requires a positive integer.`, path: this.fullPath })
    }
    return skip
  }

  async _next(ec, next) {

    return next

  }

  async _evaluate(ec, { input } = {}) {

    let skipped = 0

    const outputCursor = await super._evaluate(ec, { input }),
          { value: skip } = this,
          next = outputCursor.next,
          hasNext = outputCursor.hasNext,
          run = callback => {
            if (skipped >= skip) {
              return callback()
            }
            next.call(outputCursor, (err, result) => {
              if (!err && result !== Undefined) {
                skipped += 1
                return setImmediate(run, callback)
              }
              return callback(err)
            })

          }

    outputCursor.hasNext = callback => {
      run((err) => {
        if (err) {
          callback(err)
        } else {
          return hasNext.call(outputCursor, (err, has) => {
            callback(err, has)
          })
        }
      })

    }

    outputCursor.next = callback => {
      run((err) => {
        if (err) {
          callback(err)
        } else {
          return next.call(outputCursor, (err, result) => {
            callback(err, result)
          })
        }
      })

    }

    return outputCursor

  }

}

module.exports = Stage$skip
