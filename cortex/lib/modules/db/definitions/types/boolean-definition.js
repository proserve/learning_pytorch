'use strict'

var util = require('util'),
    PropertyDefinition = require('../property-definition'),
    { expressions: { TypeFactory } } = require('../../../../modules'),
    TypeBoolean = TypeFactory.create('Boolean')

function BooleanDefinition(options) {

  PropertyDefinition.call(this, options)

}
util.inherits(BooleanDefinition, PropertyDefinition)
BooleanDefinition.typeName = 'Boolean'
BooleanDefinition.mongooseType = 'Boolean'

BooleanDefinition.prototype.getTypeName = function() {
  return BooleanDefinition.typeName
}

BooleanDefinition.defaultValues = {
  'true': function() {
    return true
  },
  'false': function() {
    return false
  }
}
BooleanDefinition.staticDefaultValues = true

BooleanDefinition.prototype.castForQuery = function(ac, value) {

  return TypeBoolean.cast(value, { ac, path: this.fullpath })

}

module.exports = BooleanDefinition
