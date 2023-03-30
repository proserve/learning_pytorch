const Operator = require('../operator'),
      { sleep, rInt, clamp } = require('../../../utils'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault')

class Operator$sleep extends Operator {

  parse(value, expression) {

    if (config('app.env') !== 'development' || config('app.domain') === 'market') {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$sleep is not available in this environment.`, path: expression.fullPath })
    }

    super.parse(
      clamp(rInt(parseInt(value), 0), 0, 10000),
      expression
    )
  }

  async evaluate(ec) {

    await sleep(this.value)

  }

}

module.exports = Operator$sleep
