const Operator = require('../operator'),
      ExpressionRules = require('../expression-rules'),
      ExpressionContext = require('../expression-context'),
      { AccessScope } = require('../scope'),
      { ExpressionFactory } = require('../factory'),
      { isPlainObject, couldBeId } = require('../../../utils'),
      AccessPrincipal = require('../../../access-principal')

/**
 * {
 *   $as: {
 *     input: {
 *      principal: 'c_system_user',
 *      grant: { $acl: 'role.administrator.read' },
 *      skipAcl: true,
 *      bypassCreateAcl: true,
 *      roles: [], // roles to assign
 *      scope: '*',
 *     },
 *     in: '$$ac.principal'
 *   }
 * }
 */
class Operator$as extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    // accept a literal
    let input = value.input
    if (isPlainObject(input)) {
      if (!Object.keys(input).find(key => key[0] === '$')) {
        input = { $literal: input }
      }
    }

    super.parse(
      {
        input: ExpressionFactory.guess(input, { parent: expression, path: 'input' }),
        in: ExpressionFactory.guess(value.in, { parent: expression, path: 'in' })
      },
      expression
    )

  }

  async evaluate(ec) {

    const { value, expression } = this,
          { ac: parentAc } = ec,
          result = (await value.input.evaluate(ec)) || {},
          { principal, grant, skipAcl, bypassCreateAcl, roles, scope } = (typeof result === 'string' || couldBeId(result)) ? { principal: result } : result,
          localPrincipal = await AccessPrincipal.create(parentAc.org, principal || parentAc.principal),
          localAc = parentAc.copy(),
          parent = ec

    localPrincipal.merge(parentAc, { grant, skipAcl, bypassCreateAcl, roles, scope })
    localAc.principal = localPrincipal

    // re-use access scope for multiple executions. the only time a path can be executed again is serially.
    ec = parent.getChildContext(expression.fullPath)
    if (!ec) {
      ec = new ExpressionContext({
        expression,
        accessScope: new AccessScope(localAc, parent.accessScope),
        parent
      })
      parent.registerChildContext(expression.fullPath, ec)
    } else {
      ec.ac = localAc
    }

    return value.in.evaluate(ec)

  }

}

module.exports = Operator$as
