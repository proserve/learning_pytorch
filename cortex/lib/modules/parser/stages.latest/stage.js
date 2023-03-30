'use strict'

const _ = require('underscore'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      clone = require('clone'),
      ParserConsts = require('../parser-consts'),
      ParserValues = require('../values'),
      stages = {}

class ParserStage extends ParserValues.Component {

  static getStageClass(name) {
    return stages[name]
  }

  static register(Cls) {
    stages[Cls.type] = Cls
  }

  constructor(parser) {
    super(null)
    this._parser = parser
    this._skipAcl = false
  }

  get stage() {
    return this
  }

  parse(expression, options) {

    expression = this.normalize(expression)
    options = options || {}
    if (options.raw) {
      this.key = this.type
      this._value = new ParserValues.Raw(this, expression)
    } else {
      super.parse(this.type, expression)
    }
  }

  static get restrictedOperators() {
    return []
  }

  isAllowedRestrictedOperator(operator) {
    return false
  }

  /**
     * all fully qualified paths that have been used in this stage.
     * these are not necessarily validated.
     */
  get flattenedPropertyPaths() {
    if (!this._flattened_property_paths) {
      this._flattened_property_paths = this.flattenPaths().sort((a, b) => a.length - b.length)
    }
    return this._flattened_property_paths
  }

  flattenPaths() {
    return []
  }

  get variables() {
    if (!this._variables) {
      this._variables = {}
      this.walk(false, true, v => {
        if (v.type === ParserConsts.Variable) {
          this._variables[v.underlyingValue] = ''
        }
      })
    }
    return this._variables
  }

  get indexable() {
    return this.constructor.indexable
  }

  get usesIndex() {
    if (this.parser._skipIndexChecks) {
      return false
    }
    var n = this
    while (n) {
      if (!n.indexable) {
        return false
      }
      n = n.isFirst ? null : n.prev
    }
    return true
  }

  get baseFind() {

    return this.canUseIndex ? clone(this.parser.baseFind) : {}
  }

  get canUseIndex() {
    var n = this
    while (n) {
      if (!n.indexable) {
        return false
      }
      n = n.isFirst ? null : n.prev
    }
    return true
  }

  get type() {
    return this.constructor.type
  }

  get isRaw() {
    return this.value && this.value.type === ParserConsts.Raw
  }

  get parser() {
    return this._parser
  }

  build(force) {
    if (!this._built || force) {
      this._built = this._build()
    }
    return this._built
  }

  _build() {
    return super.build()
  }

  get json() {

    if (!this._json) {
      this._json = this.build()
    }
    return this._json
  }

  set skipAcl(v) {
    this._skipAcl = v
  }

  get skipAcl() {
    return this._skipAcl
  }

  get isEmpty() {

    const value = this.value
    if (value.type === ParserConsts.Raw) {
      if (utils.isPlainObject(value.value)) {
        return Object.keys(value.value).length === 0
      }
    } else if (value.type === ParserConsts.Expression) {
      return value.length === 0
    }
    return value.value == null
  }

  normalize(expression, formatter = v => v) {

    if (_.isString(expression)) {
      try {
        expression = JSON.parse(expression)
      } catch (e) {
        expression = null
        var fault = Fault.create('cortex.invalidArgument.query', { reason: 'Invalid ' + this.type + ' JSON format' })
        fault.add(e)
        throw fault
      }
    }

    expression = formatter(expression)

    if (!utils.isPlainObject(expression)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Object expected for ' + this.type + ' expression' })
    }

    return expression
  }

  /**
     * checks if the passed in value is a variable.
     *
     * @param value
     * @returns {string} the resolved variable name
     */
  extractVariable(value) {
    let match
    if (this.parser._withVariables && _.isString(value) && (match = value.match(ParserConsts.VARIABLE_REGEX))) {
      return match[1]
    }
    return null
  }

  static getExpressionKey(slot) {
    let key = 'idx.d.' + slot.name
    if (slot.name[0] === 'u' || slot.name[0] === 'g') key += '.v'
    return key
  }

  static fixMongoQueryParseCompoundSlotValueKeyParent(into, name) {
    if (typeof name === 'string') {
      const match = name.match(/^idx.d.[gui][0-9]{1,}\./)
      if (match) {
        into[name.slice(0, match[0].length - 1)] = { $exists: true }
      }
    }
    return null
  }

}

module.exports = ParserStage
