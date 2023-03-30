const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      semver = require('semver')

class Operator$semver extends Operator {

  parse(value, expression) {

    ExpressionRules.tplMustBeArrayOfSize(2)(expression, this, value)

    super.parse(
      value.map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {

    const [version, candidate] = await Promise.all(
      this.value.map(expression => expression.evaluate(ec))
    )
    return semver.satisfies(version, candidate)

  }

}

module.exports = Operator$semver
