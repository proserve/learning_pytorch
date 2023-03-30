const util = require('util'),
      BaseFileProcessorDefinition = require('../base-file-processor-definition')

function OverlayDefinition(options) {
  BaseFileProcessorDefinition.call(this, options)
}

util.inherits(OverlayDefinition, BaseFileProcessorDefinition)
OverlayDefinition.typeName = 'overlay'

OverlayDefinition.prototype.getTypeName = function() {
  return OverlayDefinition.typeName
}

OverlayDefinition.getProperties = function() {

  // an overlay must be a png and cannot have a source other than itself.
  return [{
    name: 'mimes',
    validators: [{
      name: 'stringEnum',
      definition: {
        values: ['image/png', 'image/gif']
      }
    }]
  }, {
    name: 'source',
    dependencies: ['.name'],
    validators: [ {
      name: 'adhoc',
      definition: {
        message: 'An overlay must be uploaded and can only reference itself as a source.',
        validator: function(ac, node, value) {
          return value === this.name
        }
      }
    }]
  }, {
    name: 'passMimes',
    type: 'Boolean',
    // description: 'Overlays, if present, must be of the correct type.',
    writable: false,
    default: false
  }, {
    name: 'allowUpload',
    validators: [ {
      name: 'adhoc',
      definition: {
        message: 'An overlay must be uploaded and can only reference itself as a source.',
        validator: function(ac, node, value) {
          return !!value
        }
      }
    }]
  }]

}

module.exports = OverlayDefinition
