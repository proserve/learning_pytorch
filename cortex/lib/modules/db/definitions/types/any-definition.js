'use strict'

var util = require('util'),
    _ = require('underscore'),
    PropertyDefinition = require('../property-definition'),
    utils = require('../../../../utils'),
    Fault = require('cortex-service/lib/fault')

function AnyDefinition(options) {

  options = options || {}

  options.array = false

  if (options.stubValue) {
    const stubValue = options.stubValue
    options.stub = () => JSON.parse(stubValue)
  }

  PropertyDefinition.call(this, options)

  this.serializeData = utils.rBool(options.serializeData, true)

  this.maxSize = utils.clamp(utils.rInt(options.maxSize, 0), 0, 1024 * 1024) // tmp. 1MB

  // internal that allows any types to store concrete structures.

  var fnSerialize = _.isFunction(options.AnySerializer) ? options.AnySerializer : null,
      fnDeserialize = _.isFunction(options.AnyDeserializer) ? options.AnyDeserializer : null,
      fnTransform = _.isFunction(options.transform) ? options.transform : null

  if (!this.virtual && !this.groupReader && this.serializeData) {

    this.set.push(function(v) {
      return {
        _dat_: fnSerialize ? fnSerialize(v) : utils.serializeObject(v)
      }
    })
    // we use a getter and a reader. when reading, bypass the getter. this is done so validators can access the
    // underlying data, and so that we can ensure any types don't end up exposed to raw queries.
    this.get.push(function(v) {
      if (v === undefined) return v
      try {
        if (v && v._dat_ !== undefined) {
          return fnDeserialize ? fnDeserialize(v._dat_) : utils.deserializeObject(v._dat_)
        }
      } catch (e) {}
      return undefined
    })

    this.reader = function(ac, node, selection) {

      let value = AnyDefinition.readAny(this.getValue ? this.getValue(selection.pathOverride || node.docpath) : utils.path(this, selection.pathOverride || node.docpath), fnDeserialize)
      if (fnTransform) {
        value = fnTransform.call(this, ac, node, selection, value)
      }
      return value
    }
  }

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

}

AnyDefinition.readAny = function(v, fnDeserialize) {
  try {
    if (v && v._dat_ !== undefined) {
      return fnDeserialize ? fnDeserialize(v._dat_) : utils.deserializeObject(v._dat_)
    }
  } catch (e) {}
  return undefined
}

util.inherits(AnyDefinition, PropertyDefinition)
AnyDefinition.typeName = 'Any'
AnyDefinition.mongooseType = 'Mixed'

AnyDefinition.prototype.isIndexable = false

AnyDefinition.defaultValues = {
  '[]': function() {
    return []
  },
  '{}': function() {
    return {}
  }
}
AnyDefinition.staticDefaultValues = false

AnyDefinition.getProperties = function(depth) {
  return [
    { name: 'array', default: false, writable: false },
    { name: 'uniqueValues', default: false, writable: false },
    { name: 'indexed', default: false, writable: false, public: false },
    { name: 'unique', default: false, writable: false, public: false },
    {
      // description: 'If true, the type will be checked for safe mongo keys, and will not be serialized.',
      label: 'Serialize Data',
      name: 'serializeData',
      type: 'Boolean',
      creatable: true,
      default: true
    },
    {
      label: 'Stub Value',
      name: 'stubValue',
      type: 'String',
      writable: true,
      validators: [{
        name: 'stringEnum',
        definition: {
          values: ['[]', '{}']
        }
      }]
    },
    {
      // description: 'the maximum bson object size.',
      label: 'Max Size',
      name: 'maxSize',
      type: 'Number',
      writable: true,
      default: 0,
      validators: [{
        name: 'number',
        definition: {
          allowNull: false,
          min: 0,
          max: 1024 * 1024,
          allowDecimal: false
        }
      }]
    }
  ]
}

AnyDefinition.prototype.getTypeName = function() {
  return AnyDefinition.typeName
}

AnyDefinition.prototype.isPrimitive = function() {
  return false
}

AnyDefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {

  // always allow any sub path. in this case, just select all dependencies at this level.
  PropertyDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, null, options)

}

AnyDefinition.prototype._readSingleResult = function(ac, parentDocument, result, handled, selection) {

  if (selection.keys.length > 0 && !selection.getOption('ignoreAdhocPaths')) {
    return this._readAdHocPath(ac, parentDocument, result, handled, selection)
  }
  return result

}

AnyDefinition.prototype.aclAccess = function(ac, parentDocument, parts, options, callback) {

  // we don't know what might follow, so stop at this level.
  PropertyDefinition.prototype.aclAccess.call(this, ac, parentDocument, [], options, callback)

}

AnyDefinition.prototype.castForQuery = function(ac, value) {
  // allow any value inside of safe keys.
  // @todo: this would allow any query. continue parsing in here?
  if (!this.serializeData) {
    return value
  }
  throw Fault.create('cortex.invalidArgument.castError', { resource: ac.getResource(), reason: 'Could not cast "' + value + '" to Any.', path: this.fullpath })
}

AnyDefinition.prototype._removeElement = function(ac, parentDocument, value, callback) {

  if (!this.virtual) {
    return callback(Fault.create('cortex.unsupportedOperation.unspecified', { resource: ac.getResource(), reason: 'Non-virtual any-type array element removal is not supported', path: this.fullpath }))
  }
  PropertyDefinition.prototype._removeElement.call(this, ac, parentDocument, value, callback)

}

AnyDefinition.prototype.getMongooseType = function() {

  const type = this.serializeData ? this.constructor.mongooseType : 'Mixed'
  return this.array ? [type] : type

}

AnyDefinition.prototype.assertPayloadValueIsSane = function(ac, value) {

  // allow any value.
  return true
}

module.exports = AnyDefinition
