const Fault = require('cortex-service/lib/fault')

let Undefined

class Scope {

  #parent

  constructor(parent) {

    this.#parent = parent
  }

  get parent() {
    return this.#parent
  }

  toJSON() {
    return {}
  }

}

class AccessScope extends Scope {

  #ac

  constructor(ac, parent) {

    super(parent)

    this.ac = ac

  }

  get ac() {
    return this.#ac
  }

  set ac(ac) {

    if (!ac) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `AccessScope requires an AccessContext` })
    }

    this.#ac = ac
  }

  toJSON() {
    return this.#ac.toObject()
  }

}

class VariableScope extends Scope {

  #variables = new Map()
  #expression

  constructor(expression, parent) {

    super(parent)

    if (!expression) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `VariableScope requires an Expression` })
    }

    this.#expression = expression
    this.#variables = new Map()

  }

  has(name, localOnly) {

    return !!this._getVariableScope(name, localOnly)
  }

  get(name, localOnly) {

    const scope = this._getVariableScope(name, localOnly)
    return scope ? scope.variables.get(name) : Undefined
  }

  set(name, value, localOnly) {

    const scope = this._getVariableScope(name, localOnly)
    if (!scope) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `User variable ${name} not found.`, path: this.#expression.fullPath })
    }
    scope.variables.set(name, value)
  }

  clear() {
    this.#variables.clear()
  }

  get expression() {
    return this.#expression
  }

  get variables() {
    return this.#variables
  }

  _getVariableScope(name, localOnly = false) {

    let variableScope = this

    while (variableScope) {

      // get the value of the variable in the bottom-most registered scope.
      const stopAt = variableScope.parent && variableScope.parent.expression

      let expression = variableScope.expression
      while (expression && expression !== stopAt) {

        if (expression.isVariableRegistered(name, true)) {
          return variableScope
        }
        expression = expression.parent
      }
      variableScope = localOnly ? Undefined : variableScope.parent
    }

  }

  toJSON() {
    return Array.from(this.#variables.keys())
  }

}

module.exports = {

  AccessScope,
  VariableScope

}
