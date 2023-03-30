const { isString } = require('underscore'),
      Expression = require('../expression'),
      Fault = require('cortex-service/lib/fault'),
      { SystemVariableFactory } = require('../factory'),
      SystemVariable = require('../system-variable'),
      { pathParts } = require('../../../utils')

class Expression$variable extends Expression {

  static isA(value) {
    return isString(value) && value.length > 2 && value[0] === '$' && value[1] === '$'
  }

  parse(value) {

    const [name, path] = pathParts(String(value).substr(2))

    if (SystemVariableFactory.has(name)) {

      value = SystemVariableFactory.require(name, value, this)

    } else {

      // there must be a parent operator expression with a registered variable
      if (!this.isVariableRegistered(name)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: `User variable ${name} not found.`, path: this.fullPath })
      }

      value = { name, path }

    }

    super.parse(value, this)

  }

  async _evaluate(ec) {

    if (this.value instanceof SystemVariable) {
      return this.value.evaluate(ec)
    }

    const { value: { name, path } } = this,
          object = ec.getVariable(name)

    return ec.readObject(object, path)

  }

}

module.exports = Expression$variable
