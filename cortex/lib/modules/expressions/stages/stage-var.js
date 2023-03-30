const Stage = require('../stage'),
      ExpressionRules = require('../expression-rules')

class Stage$var extends Stage {

  _parseStage(value) {

    ExpressionRules.mustBeUserVariableFormat(this, this, value, this.fullPath, 'Stage')

    this.root.registerVariable(value)

    return value
  }

  async _next(ec, next) {
    ec.root.setVariable(this.value, next)
    return next
  }

}

module.exports = Stage$var
