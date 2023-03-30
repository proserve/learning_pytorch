'use strict'

const util = require('util'),
      _ = require('underscore'),
      { singularize } = require('inflection'),
      utils = require('../../../../utils'),
      modules = require('../../../../modules'),
      { expressions: { TypeFactory } } = modules,
      TypeObjectId = TypeFactory.create('ObjectId'),
      PropertyDefinition = require('../property-definition')

let Undefined

function ObjectIdDefinition(options) {

  options = options || {}

  PropertyDefinition.call(this, options)

  if (typeof options.ref === 'string') {
    this.ref = options.ref
  }
  this.auto = this.name === '_id' ? utils.rBool(options.auto, false) : false

  this.sourceObject = options.sourceObject || null
  this.cascadeDelete = options.cascadeDelete && !this.array && this.sourceObject

}
util.inherits(ObjectIdDefinition, PropertyDefinition)
ObjectIdDefinition.typeName = 'ObjectId'
ObjectIdDefinition.mongooseType = 'ObjectId'

ObjectIdDefinition.defaultValues = {
  'ac.principal': function(ac, node) {
    return ac.principalId
  },
  'ac.originalPrincipal': function(ac) {
    return ac.option('originalPrincipal') || ac.principalId
  },
  'req._id': function(ac) {
    return ac.reqId
  },
  'req.client._id': function(ac) {
    return utils.path(ac, 'req.orgClient._id')
  },
  'script._id': function(ac) {
    return utils.path(ac, 'script.configuration._id')
  },
  'auto': function() {
    return utils.createId()
  }
}
ObjectIdDefinition.staticDefaultValues = true

ObjectIdDefinition.prototype.getTypeName = function() {
  return ObjectIdDefinition.typeName
}

ObjectIdDefinition.getProperties = function() {
  return [
    {
      name: 'indexed',
      default: false,
      writable: true,
      // @hack attack.
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'Unique properties must also be indexed.',
          validator: function(ac, node, indexed) {
            return indexed || !this.unique
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Cascade Delete properties must also be indexed.',
          validator: function(ac, node, indexed) {
            return indexed || !this.cascadeDelete
          }
        }
      }]
    },
    {
      label: 'Ref',
      name: 'ref',
      type: 'String',
      // description: 'Internal use only. Model name for mongoose population.',
      public: false
    },
    {
      label: 'Auto',
      name: 'auto',
      type: 'Boolean',
      // description: 'Internal use only. If true, automatically generates an _id when a document is created. Only valid for the _id property.',
      public: false
    },
    {
      label: 'Cascade Delete',
      name: 'cascadeDelete',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false,
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'Cascade delete is only available in top-level properties of custom objects.',
          validator: function(ac, node, value) {
            // the property must be at the top level, in a custom object.
            const objectName = modules.db.getRootDocument(this).name
            return !value || ((objectName.indexOf('c_') === 0 || ~objectName.indexOf('__')) && node.parent.fullpath === 'properties')
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Cascade delete properties must also be indexed and cannot be arrays.',
          validator: function(ac, node, cascade) {
            return !cascade || (this.indexed && !this.array)
          }
        }
      }]
    },
    {
      label: 'Source Object',
      name: 'sourceObject',
      type: 'String',
      writable: true,
      trim: true,
      export: async function(ac, doc, resourceStream, parentPath, options) {

        const resourcePath = this.getExportResourcePath(parentPath, options),
              sourceObject = await PropertyDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options)

        if (sourceObject === Undefined) {
          return Undefined
        }
        return resourceStream.addMappedObject(ac, sourceObject, resourcePath)

      },
      writer: function(ac, node, value) {
        if (value === null || value === '') {
          return null
        }
        value = utils.rString(value, '').toLowerCase().trim()
        return value && singularize(value)
      },
      validators: [{
        name: 'adhoc',
        definition: {
          validator: function(ac, node, value, callback) {
            ac.org.createObject(value, err => callback(err))
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Output objects cannot be referenced',
          validator: function(ac, node, value) {
            return !utils.isCustomName(value, 'o_', false)
          }
        }
      }]
    }
  ]
}

ObjectIdDefinition.prototype._equals = function(a, b) {

  return utils.equalIds(a, b)

}

ObjectIdDefinition.prototype._indexOf = function(parentDocument, value) {

  if (this.array) {
    var current = utils.path(parentDocument, this.docpath)
    if (_.isArray(current)) {
      return utils.indexOfId(current, value)
    }
  }
  return -1

}

ObjectIdDefinition.prototype.generateMongooseProperty = function(inSet) {

  const property = PropertyDefinition.prototype.generateMongooseProperty.call(this, inSet)
  if (this.ref) {
    property.ref = this.ref
  }
  if (this.auto) property.auto = true
  return property
}

ObjectIdDefinition.prototype._getUniqueArrayValues = function(values) {
  return utils.uniqueIdArray(values)
}

ObjectIdDefinition.prototype.castForQuery = function(ac, value = null) {

  return TypeObjectId.cast(value, { ac, path: this.fullpath })

}

ObjectIdDefinition.prototype.apiSchema = function(options) {

  const schema = PropertyDefinition.prototype.apiSchema.call(this, options)
  if (schema) {
    if (this.sourceObject) {
      schema.sourceObject = this.sourceObject
    }
    schema.cascadeDelete = this.cascadeDelete
    return schema
  }
}

ObjectIdDefinition.prototype.import = async function(ac, doc, resourceStream, parentPath, options) {

  const resourcePath = this.getExportResourcePath(parentPath, options),
        importValue = await PropertyDefinition.prototype.import.call(this, ac, doc, resourceStream, parentPath, options)

  if (importValue === Undefined || !this.sourceObject) {
    return importValue
  }

  let index = 0,
      result = []

  for (const value of utils.array(importValue, !this.array)) {

    const idResourcePath = this.array ? utils.joinPaths(resourcePath, index) : resourcePath
    index = index += 1

    if (!_.isString(value)) {
      continue
    }

    let [objectName, uniqueKey] = utils.pathParts(value),
        unmapped = await resourceStream.importMappedInstance(ac, objectName, uniqueKey, idResourcePath)

    result.push(unmapped._id)
  }

  return this.array
    ? result
    : result[0]

}

ObjectIdDefinition.prototype.export = async function(ac, doc, resourceStream, parentPath, options) {

  const exportValue = await PropertyDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options),
        objectName = this.sourceObject,
        resourcePath = utils.joinPaths(parentPath, this.path)

  if (exportValue === Undefined || !objectName) {
    return exportValue
  }

  let index = 0,
      result = []

  for (const value of utils.array(exportValue, !this.array)) {

    const idResourcePath = this.array ? utils.joinPaths(resourcePath, index) : resourcePath
    index = index += 1

    if (!utils.isId(value)) {
      continue
    }

    let mapped = await resourceStream.addMappedInstance(ac, objectName, value, idResourcePath, { includeResourcePrefix: true })

    result.push(mapped)
  }

  return this.array
    ? result
    : result[0]

}

ObjectIdDefinition.getMappingProperties = function() {
  return [{
    label: 'Source Object',
    name: 'sourceObject',
    type: 'ObjectId'
  }]
}

module.exports = ObjectIdDefinition
