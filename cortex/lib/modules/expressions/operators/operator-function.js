const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory } = require('../factory'),
      { promised, isSet } = require('../../../utils'),
      modules = require('../../../modules')

class Operator$function extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    if (isSet(value.args)) {
      ExpressionRules.mustBeArray(expression, this, value.args)
    }

    super.parse({
      body: String(value.body),
      args: isSet(value.args)
        ? value.args.map((entry, index) =>
          ExpressionFactory.guess(entry, { parent: expression, path: index })
        )
        : []
    },
    expression
    )

  }

  async evaluate(ec) {

    const { value: { body, args } } = this,
          { ac } = ec,
          runtimeArguments = await Promise.all(
            args.map(expression => expression.evaluate(ec))
          ),
          scriptRunner = modules.sandbox.sandboxed(
            ac,
            body,
            {
              compilerOptions: {
                type: 'operation',
                language: 'js',
                specification: 'es6'
              },
              parentScript: ac.script,
              scriptOptions: {
                addBodyApi: true,
                closeAllResourcesOnExit: true
              }
            },
            runtimeArguments
          )

    return promised(null, scriptRunner)

  }

}

module.exports = Operator$function
