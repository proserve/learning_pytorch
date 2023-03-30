const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      { isNumeric, array: toArray, isSet } = require('cortex-service/lib/utils/values')

class Operator$avg extends Operator {

  parse(value, expression) {

    super.parse(
      Array.isArray(value)
        ? value.map((entry, index) =>
          ExpressionFactory.guess(entry, { parent: expression, path: index })
        )
        : ExpressionFactory.guess(value, { parent: expression }),
      expression
    )
  }

  async evaluate(ec) {

    const isArray = Array.isArray(this.value),
          results = isArray
            ? await Promise.all(
              this.value.map(expression => expression.evaluate(ec))
            )
            : await this.value.evaluate(ec)

    return toArray(results, isSet(results)).reduce((memo, value) => {

      if (isNumeric(value)) {
        memo.total += parseFloat(value)
        memo.count += 1
        memo.value = memo.total / memo.count
      }

      return memo

    }, { total: 0, count: 0, value: null }).value

  }

}

module.exports = Operator$avg
