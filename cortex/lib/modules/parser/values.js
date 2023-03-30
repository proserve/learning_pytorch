'use strict'

const _ = require('underscore'),
      utils = require('../../utils'),
      Fault = require('cortex-service/lib/fault'),
      ParserConsts = require('./parser-consts'),
      modules = require('../../modules'),
      ParserProperty = require('./property'),
      LinkedList = require('cortex-service/lib/linked-list'),
      Node = LinkedList.Node

class Replacement {

  constructor(value) {
    this.value = value
  }

}

class RValue extends Node {

  constructor(component, value) {

    super(value)

    this.parentComponent = component

    const parentExpression = this.parentExpression
    this.rootExpression = parentExpression ? parentExpression.rootExpression : this
    this.expressionDepth = parentExpression ? parentExpression.expressionDepth + 1 : 0

  }

  walk(components, values, fn) {
    if (values) {
      if (fn(this) === -1) {
        return -1
      }
    }
    return 0
  }

  get type() { return this.constructor.type }

  get stage() {
    return this.rootExpression.parentComponent
  }

  get isTopLevel() {
    return this.parentComponent && !this.parentComponent.parentComponent
  }

  get parser() {
    return this.stage.parser
  }

  get parentExpression() {
    const parentComponent = this.parentComponent
    return parentComponent ? parentComponent.parentExpression : null
  }

  get fullpath() {
    return this.parentComponent ? this.parentComponent.fullpath : ''
  }

  get propertyFullpath() {
    return this.parentComponent ? this.parentComponent.propertyFullpath : ''
  }

  get propertyName() {
    return this.parentComponent ? this.parentComponent.propertyName : ''
  }

  get isRoot() {
    return this.rootExpression === this
  }

  get underlyingValue() {
    return this.value
  }

  validate() {}

  build(intoExpression) {
    return this.value
  }
  get naturalNodeType() {
    if (!this._nodeType) {
      const t = modules.db.definitions.typeSimpleValue(this.underlyingValue)
      this._nodeType = t.replace('[]', '')
      this._isArray = t !== this._nodeType
    }
    return this._nodeType
  }

  get isNaturalArray() {
    if (this._isArray == null) {
      void this.naturalNodeType // trigger
    }
    return this._isArray
  }

}

// ----------------------------------------------

class ExpressionRValue extends RValue {

  constructor(component, value) {

    super(component, new LinkedList())

    if (!this.parser.relax && this.expressionDepth > ParserConsts.MAX_EXPRESSION_DEPTH) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Maximum query depth (' + ParserConsts.MAX_EXPRESSION_DEPTH + ') exceeded', path: this.fullpath })
    }

    if (!utils.isPlainObject(value)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Object expected for expression', path: this.fullpath })
    }

    const keys = Object.keys(value)

    this.keysChecker(keys)

    // create components and filter out null rvalues (trivial omissions)
    keys.forEach(key => {
      const component = new this.constructor.ComponentClass(this)
      component.parse(key, value[key])
      if (component.value != null) {
        this.value.push(component)
      }
    })

    this._object = {}

  }

  keysChecker(keys) {
    if (keys.length === 0) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'expression requires at least one field or operator', path: this.fullpath })
    }
    if (!this.parser.relax && keys.length > ParserConsts.MAX_EXPRESSION_KEYS) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Maximum expression keys (' + ParserConsts.MAX_EXPRESSION_KEYS + ') exceeded', path: this.fullpath })
    }
  }

  static get type() { return ParserConsts.Expression }

  get object() {
    return this._object
  }

  static get ComponentClass() {
    throw Fault.create('cortex.error.pureVirtual')
  }

  /**
     * @param components
     * @param values
     * @param fn
     */
  walk(components, values, fn) {
    let ret = 0
    if (values) {
      ret = fn(this)
      if (ret === -1) {
        return ret
      }
    }
    if (ret !== -2) {
      let value = null
      while (value !== this.value.last) {
        value = value ? value.next : this.value.first
        if (value.walk(components, values, fn) === -1) {
          return -1
        }
      }
    }
    return 0
  }

  get length() {
    return this.value.length
  }

  get underlyingValue() {
    return this.value.reduce((value, component) => {
      value[component.key] = component.underlyingValue
      return value
    }, {})
  }

  validate() {
    this.value.forEach(v => v.validate())
  }

  build(intoExpression) {
    const result = this.value.reduce((expression, component) => {
      const object = component.build(expression)
      if (object) {
        if (object instanceof Replacement) {
          return object
        }
        return Object.keys(object).reduce((expression, key) => {
          if (expression[key] === undefined) {
            expression[key] = object[key]
          } else {
            (expression.$and || (expression.$and = [])).push(object)
          }
          return expression
        }, expression)
      }
      return expression
    }, {})
    return Object.keys(result).length ? result : undefined
  }

}

class RootExpression extends ExpressionRValue {

  get stage() {
    return this.parentComponent
  }

  resolveCandidateModels(candidateModels) {
    return candidateModels
  }

  resolveCandidateProperties(candidateModels, candidateProperties) {
    return candidateProperties
  }

}

class SimpleRValue extends RValue {

  static get type() { return ParserConsts.Simple }

}

// ----------------------------------------------

class PropertyRValue extends SimpleRValue {

  constructor(component, field) {
    if (field !== utils.normalizeObjectPath(field, true, true, true)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid field name: (' + field + ')', path: component.fullpath })
    }
    super(component, field)
  }

  static get type() { return ParserConsts.Property }

  build(intoExpression) {
    return '$' + this.value
  }

}

class ArrayRValue extends RValue {

  constructor(component, value, mapper) {
    super(component, new LinkedList())
    utils.array(value).map(mapper).forEach(value => {
      if (value) {
        value.parent_array = this
        this.value.push(value)
      }
    })
  }

  walk(components, values, fn) {
    let ret = 0
    if (values) {
      ret = fn(this)
      if (ret === -1) {
        return ret
      }
    }
    if (ret !== -2) {
      let value = null
      while (value !== this.value.last) {
        value = value ? value.next : this.value.first
        if (value.walk(components, values, fn) === -1) {
          return -1
        }
      }
    }
    return 0
  }

  static get type() { return ParserConsts.Array }

  get underlyingValue() {
    return this.value.map(v => v.underlyingValue)
  }

  build(intoExpression) {
    return this.value.map(value => value.build())
  }

  resolveCandidateModels(candidateModels) {
    return _.union.apply(_, this.value.map(value => {
      if (value.type === ParserConsts.Array || value.type === ParserConsts.Expression) {
        return value.resolveCandidateModels(candidateModels)
      }
      return candidateModels
    }))
  }

  resolveCandidateProperties(candidateModels, candidateProperties) {
    return ParserProperty.mergeAndUnionProperties(this.value.map(value => {
      if (value.type === ParserConsts.Array || value.type === ParserConsts.Expression) {
        return value.resolveCandidateProperties(candidateModels, candidateProperties)
      }
      return candidateProperties
    }))
  }

}

class VariableRValue extends RValue {

  static get type() { return ParserConsts.Variable }

  resolveCandidateProperties(candidateModels, candidateProperties) {
    return candidateProperties
  }

}

// @todo blast out into components and expressions?
// @allow walking raw values as json?
class RawRValue extends RValue {

  static get type() { return ParserConsts.Raw }

}

/**
 * Makes up an expression component property/operator: expression/literal
 */
class Component extends Node {

  constructor(parentExpression) {
    super(undefined)
    this.parentExpression = parentExpression
  }

  markAsReference() {
    this._is_reference = true
    if (this.isOperator) {
      const parentComponent = this.parentComponent
      if (parentComponent) {
        parentComponent.markAsReference() // <-- mark up the chain so the top-level reference is marked.
      }
    }
  }

  get buildKey() {
    return this._is_reference ? (this.key + '._id') : this.key
  }

  get isReference() {
    return this._is_reference
  }

  get getNodes() {
    const prop = this.property
    if (prop) {
      return prop.nodes
    }
    return false
  }

  get fixedLocale() {
    const prop = this.property
    if (prop) {
      return prop.nodes && prop.nodes[0].fixed
    }
    return null
  }

  get parentComponent() {
    const expression = this.parentExpression
    return expression ? expression.parentComponent : null
  }

  get isTopLevel() {
    return this.parentComponent && !this.parentComponent.parentComponent
  }

  get rootExpression() {
    return this.parentExpression.rootExpression
  }

  get stage() {
    return this.rootExpression.stage
  }

  get isOperator() {
    return this.key[0] === '$'
  }

  lookupOperator(op) {
    return (this.constructor.operators || {})[op]
  }

  get operator() {
    return this.lookupOperator(this.key)
  }

  get isRoot() {
    return this.parentExpression == null
  }

  get fullpath() {
    if (!this._fullpath) {
      const a = []
      let c = this
      while (!c.isRoot) {
        a.push(c.key)
        c = c.parentComponent
      }
      this._fullpath = a.reverse().join('.')
    }
    return this._fullpath
  }

  get propertyFullpath() {
    if (!this._propertyFullpath) {
      this._propertyFullpath = utils.normalizeObjectPath(this.fullpath, true, true, true)
    }
    return this._propertyFullpath
  }

  get propertyName() {
    const propertyFullpath = this.propertyFullpath,
          pos = _.lastIndexOf(propertyFullpath, '.')
    return ~pos ? propertyFullpath.slice(pos + 1) : propertyFullpath
  }

  get parser() {
    return this.stage.parser
  }

  get underlyingValue() {
    return this._value ? this._value.underlyingValue : undefined
  }

  get type() {
    return this._value ? this._value.type : undefined
  }

  parse(key, value) {
    this.key = key
    this._value = (key[0] === '$') ? this.parseOperator(key, value) : this.parseField(key, value)
  }

  validate() {
    this.value.validate()
  }

  walk(components, values, fn) {
    let ret = 0
    if (components) {
      ret = fn(this)
      if (ret === -1) {
        return ret
      }
    }
    if (ret !== -2 && this._value) {
      if (this._value.walk(components, values, fn) === -1) {
        return -1
      }
    }
    return 0
  }

  build(intoExpression) {
    const result = this.value.build(intoExpression)
    return result === undefined ? undefined : { [this.buildKey]: result }
  }

  parseField(field) {
    throw Fault.create('cortex.invalidArgument.query', { reason: 'Unsupported query field assignment (' + field + ')', path: this.fullpath })
  }

  parseOperator(key, value) {

    const op = this.lookupOperator(key),
          variable = this.stage.extractVariable(value)

    if (!op || (op.restricted && !this.stage.isAllowedRestrictedOperator(key))) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid operator ' + key, path: this.fullpath })
    }

    // pre-process
    if (op.pre) {
      value = op.pre(this, key, value, variable)
    }

    // apply rules
    utils.array(op.parse_rules).forEach(rule => {
      rule(this, key, value, variable)
    })

    // apply processor
    return op.parse(this, key, value, variable)

  }

  resolveCandidateModels(candidateModels) {
    if (candidateModels.length > 0) {
      const value = this.value
      if (value.type === ParserConsts.Array || value.type === ParserConsts.Expression) {
        return value.resolveCandidateModels(candidateModels)
      }
    }
    return candidateModels
  }

  resolveCandidateProperties(candidateModels, candidateProperties) {
    const value = this.value
    if (value.type === ParserConsts.Array || value.type === ParserConsts.Expression || (this.parser._withVariables && value.type === ParserConsts.Variable)) {
      return value.resolveCandidateProperties(candidateModels, candidateProperties)
    }
    return candidateProperties
  }

  /**
     * resolves and returns candidate models for the component. candidate models are based on
     * "object" and "type" matches from this or previous stages. narrowing models allows for
     * property usage that might not be available due to disparate property typing. for example,
     * c_cat has a c_meows property, so an explicit {type: 'c_cat', c_meows: true} query would not
     * fail where {c_meows: true} would fail in strict mode because other c_pets (c_dog, c_fish) do
     * not contain the c_meows property.
     */
  get models() {
    if (!this._models) {
      let parentModels
      if (this.parentComponent) {
        parentModels = this.parentComponent.models
      } else {
        parentModels = this.stage.isFirst ? this.stage.parser.models : this.stage.prev.models
      }
      this._models = this.resolveCandidateModels(parentModels)
    }
    return this._models
  }

  get properties() {
    if (!this._properties) {
      let parentProperties
      if (this.parentComponent) {
        parentProperties = this.parentComponent.properties
      } else {
        parentProperties = this.stage.isFirst ? [] : this.stage.prev.properties
      }
      // for now, just run it twice. once to resolve siblings and once to whittle down.
      this._properties = this.resolveCandidateProperties(this.models, this.resolveCandidateProperties(this.models, parentProperties))
    }
    return this._properties
  }

  get property() {
    return _.find(this.properties, property => this.propertyFullpath === property.propertyFullpath)
  }

}

module.exports = {

  Expression: ExpressionRValue,
  RootExpression: RootExpression,
  Array: ArrayRValue,
  Simple: SimpleRValue,
  Property: PropertyRValue,
  Variable: VariableRValue,
  Raw: RawRValue,
  Component: Component,
  Replacement: Replacement
}
