'use strict'

const PropertyDefinition = require('../property-definition'),
      { clamp, rInt, encodeME, decodeME } = require('../../../../utils'),
      { expressions: { parseExpression, parsePipeline, OperatorFactory, ApiFactory } } = require('../../../../modules'),
      DEFAULT_SIZE = 1024 * 8,
      MAX_SIZE = 1024 * 1024

class ExpressionDefinition extends PropertyDefinition {

  constructor(options) {

    super(options)

    this.operator = options.operator
    this.pipeline = options.pipeline
    this.maxSize = clamp(rInt(options.maxSize, DEFAULT_SIZE), 0, MAX_SIZE)

    const node = this

    this.get.push(function(v) {
      return decodeME(v, `$$decodedExpression$${node.docpath}`, this)
    })
    this.set.push(function(v) {
      return encodeME(v, `$$decodedExpression$${node.docpath}`, this)
    })

    if (this.maxSize > 0) {
      this.validators.push({
        name: 'adhoc',
        definition: {
          code: 'cortex.invalidArgument.tooLarge',
          validator: function(ac, node, value) {
            return JSON.stringify(value).length < node.maxSize
          }
        }
      })
    }

    this.validators.push({
      name: 'adhoc',
      definition: {
        validator: async function(ac, node, value) {
          node.wrapValue(value)
          return true
        }
      }
    })

  }

  parseValue(value) {
    return this.pipeline ? parsePipeline(value) : parseExpression(value)
  }

  wrapValue(value, parse = true) {

    if (value) {
      value = decodeME(value)
      if (!this.pipeline && this.operator) {
        value = { [`$${this.operator}`]: value }
      }
      return parse ? this.parseValue(value) : value
    }
    return null
  }

  static get typeName() {
    return 'Expression'

  }

  static get mongooseType() {
    return 'Mixed'
  }

  isPrimitive() {
    return false
  }

  getTypeName() {
    return ExpressionDefinition.typeName
  }

  collectRuntimePathSelections(principal, selections, path, options) {

    // always allow any sub path. in this case, just select all dependencies at this level.
    super.collectRuntimePathSelections(principal, selections, null, options)

  }

  static getProperties() {
    return [
      {
        name: 'uniqueValues',
        default: false,
        writable: false
      },
      {
        name: 'indexed',
        default: false,
        writable: false,
        public: false
      },
      {
        name: 'unique',
        default: false,
        writable: false,
        public: false
      },
      {
        name: 'operator',
        default: null,
        readable: false,
        public: false,
        type: 'String',
        validators: [{
          name: 'stringEnum',
          definition: {
            allowNull: true,
            values: [...OperatorFactory.entries().map(([name]) => name), ...ApiFactory.entries().map(([name]) => name)].sort()
          }
        }]
      },
      {
        name: 'pipeline',
        default: false,
        writable: true,
        type: 'Boolean'
      },
      {
        label: 'Max Size',
        name: 'maxSize',
        type: 'Number',
        writable: true,
        default: DEFAULT_SIZE,
        validators: [{
          name: 'number',
          definition: {
            allowNull: false,
            min: 0,
            max: MAX_SIZE,
            allowDecimal: false
          }
        }]
      }
    ]
  }

}

module.exports = ExpressionDefinition
