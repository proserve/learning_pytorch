const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory')

class Operator$env extends Operator {

  parse(value, expression) {

    super.parse(
      ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {

    const { ac: { org } } = ec,
          name = await this.value.evaluate(ec),
          { envs } = await org.getRuntime(),
          env = envs.find(v => v.name === name)

    return env && env.value
  }

}

module.exports = Operator$env
