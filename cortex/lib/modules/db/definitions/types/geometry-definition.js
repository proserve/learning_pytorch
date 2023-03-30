'use strict'

const util = require('util'),
      acl = require('../../../../acl'),
      modules = require('../../../../modules'),
      _ = require('underscore'),
      utils = require('../../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      DocumentDefinition = require('./document-definition'),
      PropertyDefinition = require('../property-definition'),
      local = {
        _definitions: null,
        _AclDefinition: null,
        _PropertySetDefinition: null
      }

let Undefined

Object.defineProperty(local, 'definitions', { get: function() { return (this._definitions || (this._definitions = require('../index'))) } })
Object.defineProperty(local, 'AclDefinition', { get: function() { return (this._AclDefinition || (this._AclDefinition = require('../acl-definition'))) } })
Object.defineProperty(local, 'PropertySetDefinition', { get: function() { return (this._PropertySetDefinition || (this._PropertySetDefinition = require('../property-set-definition'))) } })

// @todo support 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection']

function GeometryDefinition(options) {

  options = options || {}

  options.forceId = false
  options.autoId = false

  options.array = false

  this.geoType = options.geoType

  const coordsArray = this.geoType !== 'Point'

  options.properties = [{
    label: 'Type',
    name: 'type',
    type: 'String',
    readAccess: acl.Inherit,
    writeAccess: acl.Inherit,
    acl: acl.Inherit,
    creatable: true,
    validators: [{
      name: 'stringEnum',
      definition: {
        values: [options.geoType]
      }
    }]
  }, {
    label: 'Coordinates',
    name: 'coordinates',
    type: 'Coordinate',
    writable: true,
    history: options.history,
    canPush: coordsArray,
    canPull: coordsArray,
    array: coordsArray,
    readAccess: acl.Inherit,
    writeAccess: acl.Inherit,
    acl: acl.Inherit,
    minItems: 1,
    maxItems: 100,
    get: function(v) {
      if (coordsArray) {
        if (_.isArray(v)) {
          let len = v.length
          while (len--) {
            const el = v[len]
            if (!(_.isArray(el) && el.length === 2)) {
              v[len] = [0, 0]
            }
          }
          return v
        }
        return Undefined
      } else {
        return _.isArray(v) && v.length === 2 ? v : (v === null ? v : Undefined)
      }
    },
    dependencies: ['.type'],
    validators: [{
      name: 'coordinate',
      definition: {
        allowDecimal0: true,
        allowDecimal1: true,
        min0: -180,
        max0: 180,
        min1: -90,
        max1: 90,
        skip: function(ac, node) {
          return !utils.path(this, node.parent.properties.type.docpath)
        }
      }
    }]
  }]

  //  x = {"c_doc": {"$elemMatch": {"c_string": "foo", "c_geo": {"$within": {"$center": [-123.8654667, 50.471896], "$radius": 200}}}}}

  DocumentDefinition.call(this, options)

  this.writer = function(ac, node, value) {
    if (_.isArray(value)) {
      if (this.isNew) {
        value = {
          type: node.geoType,
          coordinates: value
        }
      } else {
        value = {
          coordinates: value
        }
      }
    } else if (_.isObject(value)) {
      if (this.isNew) {
        value.type = node.geoType
      }
    }
    return value
  }

}
util.inherits(GeometryDefinition, DocumentDefinition)
GeometryDefinition.typeName = 'Geometry'
GeometryDefinition.mongooseType = null

GeometryDefinition.prototype.isIndexable = true

GeometryDefinition.prototype.getTypeName = function() {
  return GeometryDefinition.typeName
}

GeometryDefinition.prototype.castForQuery = function(ac, value) {

  if (value &&
        value.$centerSphere &&
        _.isArray(value.$centerSphere) &&
        value.$centerSphere.length === 2 &&
        modules.validation.isLngLat(value.$centerSphere[0]) &&
        utils.isNumeric(value.$centerSphere[1])) {

    return value
  }

  throw Fault.create('cortex.invalidArgument.castError', { resource: ac.getResource(), reason: 'Could not cast "' + value + '" to Geometry.', path: this.fullpath })

}

GeometryDefinition.prototype._removeProperty = function(ac, parentDocument, callback) {
  return PropertyDefinition.prototype._removeProperty.call(this, ac, parentDocument, callback)
}

GeometryDefinition.prototype.apiSchema = function(options) {

  const schema = DocumentDefinition.prototype.apiSchema.call(this, options)
  if (schema) {
    if (this.geoType) {
      schema.geoType = this.geoType
    }
  }
  return schema

}

GeometryDefinition.getProperties = function() {
  return [

    { name: 'uniqueValues', default: false, writable: false },
    {
      label: 'Geometry Type',
      name: 'geoType',
      type: 'String',
      creatable: true,
      default: 'Point',
      validators: [{
        name: 'required'
      }, {
        name: 'stringEnum',
        definition: {
          values: ['Point', 'MultiPoint']
        }
      }]
    }
  ]
}

GeometryDefinition.prototype.onRemovingValue = function(ac, parentDocument, value, index) {
  PropertyDefinition.prototype.onRemovingValue.call(this, ac, parentDocument, value, index)
}

GeometryDefinition.prototype.getIndexableValue = function(rootDocument, parentDocument, node, value) {

  // store the exact location key in order to compare the indexed value. this is because we can't do a comparison
  // against the geo value, so we must make it solely against the indexed value. to correlate, our "and" will contain the fullpath
  // to the document value, and compare those ( $cond: []

  if (value && value.type && value.coordinates) {

    return {
      k: null, // we'll use this for elemMatch later on
      v: _.isFunction(value.toObject) ? value.toObject() : value
    } // bury because we can't put a geo index as an array
  }
  return Undefined
}

GeometryDefinition.prototype._getUniqueArrayValues = function(values) {

  return values // do not make values unique for coordinates in the same document, because we store the document positions in order to make comparisons.

}

GeometryDefinition.getMappingProperties = function() {
  return [{
    label: 'Geometry Type',
    name: 'geoType',
    type: 'String'
  }]
}

module.exports = GeometryDefinition
