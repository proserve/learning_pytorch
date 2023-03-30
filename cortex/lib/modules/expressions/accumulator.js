const { toJSON } = require('../../utils')

class Accumulator {

  #expression
  #value
  #query
  #name

  constructor(value, expression) {
    this.#query = value
    this.#name = `$${this.constructor.name.split('$')[1]}`
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

  get query() {
    return this.#query
  }

  get type() {
    return this.constructor.name
  }

  async evaluate(ec) {
    void ec
    return this.#value
  }

  getValue(state) {
    return state
  }

  toJSON() {

    const {
      name,
      type,
      query
    } = this

    return {
      name,
      type,
      query,
      expression: toJSON(this.#value)
    }

  }

}

module.exports = Accumulator
