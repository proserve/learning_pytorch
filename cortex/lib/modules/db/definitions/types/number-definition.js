'use strict'

const util = require('util'),
      PropertyDefinition = require('../property-definition'),
      modules = require('../../../../modules'),
      { expressions: { TypeFactory } } = modules,
      TypeNumber = TypeFactory.create('Number')

function NumberDefinition(options) {

  PropertyDefinition.call(this, options)

}
util.inherits(NumberDefinition, PropertyDefinition)
NumberDefinition.typeName = 'Number'
NumberDefinition.mongooseType = 'Number'

NumberDefinition.prototype.getTypeName = function() {
  return NumberDefinition.typeName
}

NumberDefinition.defaultValues = {
  'increment': function(ac, node, callback) {
    modules.counters.next(null, `number.increment.${ac.orgId}.${node.fqpp}`, callback)
  }
}
NumberDefinition.staticDefaultValues = true

NumberDefinition.prototype.castForQuery = function(ac, value) {

  return TypeNumber.cast(value, { ac, path: this.fullpath })

}

module.exports = NumberDefinition
