const { toJSON, path: pathTo } = require('../../utils'),
      { VariableScope } = require('./scope'),
      { SystemVariableFactory } = require('./factory'),
      ExpressionContext = require('./expression-context')

let Undefined

class Expression {

  #parent
  #root
  #path
  #fullPath
  #value
  #depth
  #input
  #vars

  initialize(value, { parent = null, path = '' } = {}) {

    this.#parent = parent
    this.#path = String(path)
    this.#fullPath = [parent && parent.fullPath, this.path].filter(v => v).join('.')
    this.#depth = parent ? parent.depth + 1 : 1
    this.#input = value

    if (!parent) {
      this.registerVariable('$$ROOT')
    }

    try {
      this.parse(value, { parent, path })
    } catch (err) {
      if (!err.path) {
        err.path = this.#fullPath
      }
      throw err
    }

    return this

  }

  get parent() {
    return this.#parent
  }

  get root() {
    if (!this.#root) {
      this.#root = this.#parent ? this.#parent.root : this
    }
    return this.#root
  }

  get path() {
    return this.#path
  }

  get fullPath() {
    return this.#fullPath
  }

  get value() {
    return this.#value
  }

  get depth() {
    return this.#depth
  }

  get input() {
    return this.#input
  }

  get type() {
    return this.constructor.name
  }

  parse(value) {
    this.#value = value
  }

  registerVariable(name) {
    if (!this.#vars) {
      this.#vars = new Set()
    }
    this.#vars.add(name)
  }

  isVariableRegistered(name, localOnly) {
    if (this.#vars && this.#vars.has(name)) {
      return true
    }
    return !!(!localOnly && this.#parent && this.#parent.isVariableRegistered(name))
  }

  hasVariables() {
    return !!this.#vars
  }

  toJSON() {

    const {
      path,
      fullPath,
      depth,
      input,
      type
    } = this

    return {
      path,
      fullPath,
      depth,
      input,
      type,
      variables: this.#vars ? this.#vars.keys() : Undefined,
      value: toJSON(this.#value)
    }

  }

  async evaluate(ec, options) {

    if (this.hasVariables()) {

      // re-use variable scope (and clear) for multiple executions.
      const parent = ec
      ec = parent.getChildContext(this.fullPath)
      if (!ec) {
        ec = new ExpressionContext({
          expression: this,
          variableScope: new VariableScope(this, parent.variableScope),
          parent
        })
        parent.registerChildContext(this.fullPath, ec)
      } else {
        ec.variableScope.clear()
      }
    }

    if (ec.root.expression.isVariableRegistered('$$SCRIPT')) {
      const { ac } = ec
      let value = ec.root.getVariable('$$SCRIPT')
      if (!value) {
        value = pathTo(ac, 'script.environment.script')
        if (value) {
          ec.root.setVariable('$$SCRIPT', value)
        }
      }
    }

    if (ec.root.expression.isVariableRegistered('$$REQUEST')) {
      const { ac: { req } } = ec
      let value = ec.root.getVariable('$$REQUEST')
      if (!value) {
        value = SystemVariableFactory.get('REQUEST').toObject(req)
        ec.root.setVariable('$$REQUEST', value)
      }
    }

    let err

    ec.enter(this)

    const start = process.hrtime(),
          result = await (async() => {
            try {
              return this._evaluate(ec, options)
            } catch (e) {
              err = e
            }
          })(),
          diff = process.hrtime(start),
          ms = ((diff[0] * 1e9 + diff[1]) / 1e6)

    if (err) {
      if (!err.path) {
        err.path = this.#fullPath
      }
    }

    return ec.exit(this, err, result, { ms })

  }

  async _evaluate(ec, options) {

    void ec
    void options
    return this.#value
  }

}

module.exports = Expression
