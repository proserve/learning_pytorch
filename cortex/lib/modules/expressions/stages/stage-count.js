const Stage = require('../stage'),
      ExpressionRules = require('../expression-rules'),
      { Empty } = require('../expression-utils')

let Undefined

class Stage$count extends Stage {

  _parseStage(value) {

    this.registerVariable('$$STAGE_INPUT_CURSOR')

    ExpressionRules.mustBeUserVariableFormat(this, this, value, this.fullPath, 'Stage')
    return value
  }

  async _next(ec, next) {

    return {
      [this.value]: next
    }
  }

  async _createInputCursor(ec, ...params) {

    const cursor = await super._createInputCursor(ec, ...params)
    ec.setVariable('$$STAGE_INPUT_CURSOR', cursor)
    return cursor

  }

  async _evaluate(ec, { input } = {}) {

    const outputCursor = await super._evaluate(ec, { input }),
          inputCursor = ec.getVariable('$$STAGE_INPUT_CURSOR')

    ec.setVariable('$$STAGE_INPUT_CURSOR', Undefined)

    let count = 0

    outputCursor._next = callback => {

      let err

      return Promise.resolve(null)
        .then(async() => {
          for await (const result of inputCursor) {
            if (result !== Undefined && result !== Empty) {
              count += 1
            }
          }
        })
        .catch(e => {
          err = e
        })
        .then(() => {
          outputCursor._next = function(callback) {
            callback(null, Undefined)
          }
          callback(err, count)
        })

    }

    return outputCursor

  }

}

module.exports = Stage$count
