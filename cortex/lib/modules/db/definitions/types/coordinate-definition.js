'use strict'

const util = require('util'),
      _ = require('underscore'),
      PropertyDefinition = require('../property-definition'),
      utils = require('../../../../utils')

function CoordinateDefinition(options) {

  options = options || {}

  // options.array = false;

  PropertyDefinition.call(this, options)

  const isArray = this.array,
        _set = v => {
          if (!_.isArray(v)) {
            v = [v, null]
          } else if (v.length < 2 && v.length > 0) {
            v = [v.length === 1 ? v[0] : null, null]
          } else if (v.length > 2) {
            v = v.slice(0, 2)
          }
          if(v.length) {
            v[0] = utils.rNum(v[0], null)
            v[1] = utils.rNum(v[1], null)
          }
          return v
        }

  this.set.push(function(v) {

    if (isArray) {
      return (utils.array(v, true)).map(_set)
    }
    return _set(v)

  })

}
util.inherits(CoordinateDefinition, PropertyDefinition)
CoordinateDefinition.typeName = 'Coordinate'
CoordinateDefinition.mongooseType = null

CoordinateDefinition.prototype.isIndexable = false

CoordinateDefinition.getProperties = function(depth) {
  return [
    // {name: 'array', default: false, writable: false},
    { name: 'uniqueValues', default: false, writable: false },
    { name: 'indexed', default: false, writable: false, public: false },
    { name: 'unique', default: false, writable: false, public: false }
  ]
}

CoordinateDefinition.prototype.getTypeName = function() {
  return CoordinateDefinition.typeName
}

CoordinateDefinition.prototype.getMongooseType = function() {
  return []
}

module.exports = CoordinateDefinition
