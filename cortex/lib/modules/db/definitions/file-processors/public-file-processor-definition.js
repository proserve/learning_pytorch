var util = require('util'),
    consts = require('../../../../consts'),
    BaseFileProcessorDefinition = require('../base-file-processor-definition')

function PublicProcessorDefinition(options = {}) {
  BaseFileProcessorDefinition.call(this, options)
  this.storageId = consts.storage.availableLocationTypes.public
}
util.inherits(PublicProcessorDefinition, BaseFileProcessorDefinition)
PublicProcessorDefinition.typeName = 'public'

PublicProcessorDefinition.prototype.getTypeName = function() {
  return PublicProcessorDefinition.typeName
}

PublicProcessorDefinition.getProperties = function() {
  return []
}

module.exports = PublicProcessorDefinition
