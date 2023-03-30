var util = require('util'),
    BaseFileProcessorDefinition = require('../base-file-processor-definition')

function PassthruDefinition(options) {
  BaseFileProcessorDefinition.call(this, options)
}
util.inherits(PassthruDefinition, BaseFileProcessorDefinition)
PassthruDefinition.typeName = 'passthru'

PassthruDefinition.prototype.getTypeName = function() {
  return PassthruDefinition.typeName
}

PassthruDefinition.getProperties = function() {
  return []
}

module.exports = PassthruDefinition
