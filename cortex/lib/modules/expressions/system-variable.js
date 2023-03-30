const { toJSON } = require('../../utils')

class SystemVariable {

  #expression
  #value
  #query
  #name = `$${this.constructor.name.split('$')[1]}`

  constructor(value, expression) {
    this.#query = value
    this.parse(value, expression)
  }

  parse(value, expression) {
    this.#value = value
    this.#expression = expression
  }

  get name() {
    return this.#name
  }

  get expression() {
    return this.#expression
  }

  get value() {
    return this.#value
  }

  get type() {
    return this.constructor.name
  }

  get query() {
    return this.#query
  }

  toJSON() {

    const {
      type,
      query
    } = this

    return {
      type,
      query,
      expression: toJSON(this.#value)
    }

  }

  async evaluate(ec) {
    void ec
    return this.#value
  }

}

module.exports = SystemVariable
