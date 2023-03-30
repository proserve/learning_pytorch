'use strict'

var util = require('util'),
    PropertyDefinition = require('../property-definition'),
    utils = require('../../../../utils'),
    Fault = require('cortex-service/lib/fault'),
    { expressions: { TypeFactory } } = require('../../../../modules'),
    TypeBinary = TypeFactory.create('Binary')

let Undefined

function BinaryDefinition(options) {

  PropertyDefinition.call(this, options)

  this.outputEncoding = options.outputEncoding
  this.maxSize = utils.clamp(utils.rInt(options.maxSize, 0), 0, 1024 * 1024) // 1MB

  this.reader = function(ac, node, selection) {

    const binary = utils.path(this, selection.pathOverride || node.docpath),
          buffer = binary && binary.buffer

    if (!buffer) {
      return null
    } else if (node.outputEncoding === 'raw') {
      return buffer
    } else if (node.outputEncoding === 'array') {
      return Array.from(buffer)
    }
    return buffer.toString(node.outputEncoding)

  }

  this.set.push(v => {
    return castValue(this, v)
  })

  if (this.maxSize > 0) {
    this.validators.push({
      name: 'adhoc',
      definition: {
        code: 'cortex.invalidArgument.tooLarge',
        validator: function(ac, node, value) {
          if (value && value.length > node.maxSize) {
            throw Fault.create('cortex.invalidArgument.tooLarge', { reason: `Buffer too large (${value.length} / ${node.maxSize})` })
          }
          return true
        }
      }
    })
  }
}

util.inherits(BinaryDefinition, PropertyDefinition)
BinaryDefinition.typeName = 'Binary'
BinaryDefinition.mongooseType = 'Buffer'

BinaryDefinition.prototype.getTypeName = function() {
  return BinaryDefinition.typeName
}

BinaryDefinition.getProperties = function() {
  return [
    { name: 'array', default: false, writable: false },
    { name: 'uniqueValues', default: false, writable: false },
    { name: 'indexed', default: false, writable: false, public: false },
    { name: 'unique', default: false, writable: false, public: false },
    {
      label: 'Output Encoding',
      name: 'outputEncoding',
      type: 'String',
      writable: true,
      default: 'base64',
      validators: [{
        name: 'stringEnum',
        definition: {
          values: ['base64', 'hex', 'array', 'utf8', 'raw']
        }
      }]
    },
    {
      // description: 'the maximum buffer size.',
      label: 'Max Size',
      name: 'maxSize',
      type: 'Number',
      writable: true,
      default: 1024 * 10,
      validators: [{
        name: 'number',
        definition: {
          allowNull: false,
          min: 1,
          max: 1024 * 1024,
          allowDecimal: false
        }
      }]
    }
  ]
}

BinaryDefinition.prototype.castForQuery = function(ac, value) {

  return castValue(this, value, ac)

}

BinaryDefinition.prototype.export = async function(ac, doc, resourceStream, parentPath, options) {

  let value = await PropertyDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options)
  if (value === Undefined) {
    return Undefined
  }
  return castValue(this, value, ac, this.outputEncoding).toString('base64')
}

BinaryDefinition.prototype.import = async function(ac, doc, resourceStream, parentPath, options) {

  let value = await PropertyDefinition.prototype.import.call(this, ac, doc, resourceStream, parentPath, options)
  if (value === Undefined) {
    return Undefined
  }
  return castValue(this, value, ac, 'base64')
}

function castValue(node, value, ac = Undefined, forceEncoding = null) {

  return TypeBinary.cast(value, { ac, path: node.fullpath, forceEncoding })
}

module.exports = BinaryDefinition
