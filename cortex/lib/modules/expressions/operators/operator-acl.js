const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      { isSet, array: toArray } = require('../../../utils'),
      { parseAcl } = require('../../../acl-util')

class Operator$acl extends Operator {

  parse(value, expression) {

    super.parse(
      toArray(value, isSet(value)).map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )

  }

  async evaluate(ec) {

    const values = await Promise.all(
            this.value.map(expression => expression.evaluate(ec))
          ),
          { ac } = ec,
          acl = await parseAcl(ac, values)

    return ac.resolveAccess({ acl }).resolved

  }

}

module.exports = Operator$acl
