const { rString, isSet, isInt, promised, normalizeObjectPath, isPlainObject, OutputCursor, pathParts } = require('../../utils'),
      Fault = require('cortex-service/lib/fault'),
      { AccessScope, VariableScope } = require('./scope'),
      { isAccessSubject, AccessContext } = require('../../acl'),
      Memo = require('../../classes/memo'),
      { MAX_EXPRESSION_DEPTH } = require('./expression-consts'),
      { isMarkedAsLiteralObject } = require('./expression-utils'),
      { Pather } = require('../../classes/pather'),
      { MemoryCache } = require('cortex-service/lib/memory-cache'),
      pather = new Pather({ checkHasOwnProperty: true, limitToPrimitives: false, allowSerializableObjects: true, allowAccessSubjects: true, filter: [] })

let Undefined

class ExpressionContext {

  #depth
  #evaluations = new Map()
  #root
  #parent
  #path
  #accessScope
  #variableScope
  #expression
  #contexts
  #cache = new MemoryCache({
    maxItems: 10
  })

  constructor({ ac, expression, accessScope, variableScope, parent, variables, depth, path } = {}) {

    this.#parent = parent

    if (!isInt(depth)) {
      depth = parent ? parent.depth : 0
    }
    this.#depth = depth + 1

    if (typeof path === 'string') {
      this.#path = path
    }

    this.#expression = expression
    this.#accessScope = accessScope || (parent ? Undefined : new AccessScope(ac))
    this.#variableScope = variableScope || (parent ? Undefined : new VariableScope(expression))

    if (isSet(variables)) {
      for (const [key, value] of Object.entries(variables)) {
        expression.registerVariable(key)
        this.setVariable(key, value)
      }
    }
  }

  get parent() {
    return this.#parent
  }

  get path() {
    return this.#path
  }

  get variableScope() {
    return this.#variableScope || this.parent.variableScope
  }

  get accessScope() {
    return this.#accessScope || this.parent.accessScope
  }

  get depth() {
    return this.#depth
  }

  getFullPath(expression) {

    expression = expression || this.#expression

    return this.root.path
      ? `${this.root.path}.${expression.fullPath}`
      : expression.fullPath

  }

  setVariable(name, value, local) {
    this.variableScope.set(name, value, local)
  }

  getVariable(name, local) {
    return this.variableScope.get(name, local)
  }

  registerChildContext(key, ec) {
    if (!this.#contexts) {
      this.#contexts = new Map()
    }
    this.#contexts.set(key, ec)
  }

  getChildContext(key) {
    return this.#contexts && this.#contexts.get(key)
  }

  get ac() {
    return this.accessScope.ac
  }

  set ac(ac) {
    this.accessScope.ac = ac
  }

  get expression() {
    return this.#expression
  }

  get root() {
    if (!this.#root) {
      this.#root = this.#parent ? this.#parent.root : this
    }
    return this.#root
  }

  toJSON() {

    let entry = {}

    const evaluations = this.#evaluations.size === 0 ? Undefined : Array.from(this.#evaluations.keys())
      .reduce(
        (memo, key) => {

          if (key === this.getFullPath(this.expression)) {
            entry = this.#evaluations.get(key)
            return memo
          }
          let path = rString(this.parent && this.getFullPath(this.expression), ''),
              name = (path ? key.substr(path.length + 1) : key)
          return Object.assign(memo, { [name]: this.#evaluations.get(key) })
        },
        {}
      )

    return {
      ...entry,
      evaluations,
      contexts: this.#contexts && Array.from(this.#contexts.keys())
        .reduce(
          (memo, key) => {
            const path = rString(this.parent && this.getFullPath(this.expression), ''),
                  name = (path ? key.substr(path.length + 1) : key) || '-'
            return Object.assign(memo, { [name]: this.#contexts.get(key).toJSON() })
          },
          {}
        ),
      accessScope: this.#accessScope ? this.#accessScope.toJSON() : Undefined,
      variableScope: this.#variableScope ? this.#variableScope.toJSON() : Undefined
    }

  }

  /**
   * @param options
   *
   * @returns {Promise<*>}
   */
  async evaluate(options) {

    return this.#expression.evaluate(this, options)

  }

  enter(expression) {

    if (expression.depth > MAX_EXPRESSION_DEPTH || this.#depth > MAX_EXPRESSION_DEPTH) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Maximum expression depth (' + MAX_EXPRESSION_DEPTH + ') exceeded', path: this.getFullPath(expression) })
    }

  }

  exit(expression, err, result, { ms }) {

    const { fullPath } = expression

    let entry = this.#evaluations.get(fullPath)
    if (!entry) {
      entry = {
        count: 0,
        ms: 0
      }
      this.#evaluations.set(fullPath, entry)
    }

    entry.count += 1
    entry.ms += ms

    if (err) {
      throw err
    }

    return result

  }

  async readObject(object, path) {

    const normalized = normalizeObjectPath(path),
          paths = normalized.split('.')

    let current = object

    // top-level
    if (normalized.length === 0) {

      if (isMarkedAsLiteralObject(current)) {
        return current
      } else if (Array.isArray(current)) {
        return Promise.all(current.map(value => this._read(value)))
      } else if (isPlainObject(current) && !isAccessSubject(current)) {
        const result = {}
        await Promise.all(Object.keys(current).map(key => {
          return this._read(current[key])
            .then(r => {
              result[key] = r
            })
        }))
        return result
      }

      return this._read(current)

    }

    // dig in on a per object basis so that if we hit something that's an access subject,
    // read the rest with access control.
    for (let index = 0, path = paths[index]; index < paths.length && isSet(current); index += 1, path = paths[index]) {

      if (isAccessSubject(current)) {
        return this._readSubject(current, paths.slice(index).join('.'))
      }
      if (current instanceof Memo) {
        return this._readMemo(current, paths.slice(index).join('.'))
      }
      current = await this._read(current, path)

    }

    return isAccessSubject(current) ? this._readSubject(current) : current

  }

  async _read(document, path) {

    if (isMarkedAsLiteralObject(document)) {
      return this._readValue(document, path)
    }

    if (isAccessSubject(document)) {
      return this._readSubject(document, path)
    }

    if (document instanceof OutputCursor) {
      return this._readCursor(document, path)
    }

    if (document instanceof OutputCursor) {
      return this._readCursor(document, path)
    }

    if (document instanceof Memo) {
      return this._readMemo(document, path)
    }

    if (document instanceof AccessContext) {
      let ctx = this.#cache.get(document._id)
      if (!ctx) {
        ctx = document.toObject()
        this.#cache.set(document._id, ctx)
      }
      document = ctx
    }

    return this._readValue(document, path)

  }

  async _readCursor(cursor, path) {

    switch (path) {

      case 'position':
        return cursor.position

      case 'hasNext':
        return promised(cursor, 'hasNext')

      default:
        return this._readValue(cursor.toJSON(), path)

    }

  }

  async _readMemo(memo, path) {

    const [prefix, suffix] = pathParts(path)

    switch (prefix) {

      case 'getSize':
        if (suffix) {
          return memo.get(path) // edge case
        }
        return memo.getSize()

      case 'isArray':
        return memo.isArray(suffix)

      case 'getLength':
        return memo.getLength(suffix)

      case 'typeOf':
        return memo.typeOf(suffix)

      default:
        return memo.get(path)
    }

  }

  async _readSubject(document, path) {

    let object = document.$model || document.constructor

    const { ac: { principal } } = this,
          options = {
            grant: 'read',
            passive: true,
            allowNullSubject: true,
            readFromLinkedReferences: true,
            document
          }

    if (path === 'isNew') {
      return !!document.isNew
    } else if (path) {
      const parts = pathParts(path)
      if (document.$__linked && document.$__linked[parts[0]]) {
        options.document = document.$__linked[parts[0]]
        object = options.document.$model || options.document.constructor
        path = parts[1]
      }
      return promised(object, 'aclReadPath', principal, null, path, options)
    } else {
      return promised(object, 'aclReadOne', principal, null, options)
    }

  }

  _readValue(document, path = '') {

    return pather.pathTo(document, path || [])
  }

}

module.exports = ExpressionContext
