'use strict'

const util = require('util'),
      PropertyDefinition = require('../property-definition'),
      utils = require('../../../../utils'),
      _ = require('underscore'),
      moment = require('moment'),
      { expressions: { TypeFactory } } = require('../../../../modules'),
      TypeDate = TypeFactory.create('Date'),
      Fault = require('cortex-service/lib/fault')

function DateDefinition(options) {

  options = options || {}

  this.dateOnly = utils.rBool(options.dateOnly, false)

  PropertyDefinition.call(this, options)

  if (this.dateOnly) {

    const node = this
    this.set.push(function(v) {
      if (v == null) {
        return v
      }
      const m = moment.utc(v, 'YYYY-MM-DD')
      if (m.isValid()) {
        return m.startOf('day').toDate()
      }
      this.invalidate(node.docpath, Fault.create('cortex.invalidArgument.unspecified', { reason: 'String expected in YYYY-MM-DD format' }))
      return v

    })
    this.get.push(function(date) {
      if (_.isDate(date)) {
        const m = moment.utc(date)
        if (m.isValid()) {
          return m.format('YYYY-MM-DD')
        }
      }
      return undefined
    })

  }

}
util.inherits(DateDefinition, PropertyDefinition)
DateDefinition.typeName = 'Date'
DateDefinition.mongooseType = 'Date'

DateDefinition.defaultValues = {
  'now': function() {
    return new Date()
  }
}
DateDefinition.staticDefaultValues = true

DateDefinition.getProperties = function() {
  return [
    {
      label: 'Date Only',
      name: 'dateOnly',
      type: 'Boolean',
      // description: 'If true, the input must be a string in the YYYY-MM-DD format, and responses will be in the same format (eg. 1973-07-16)',
      readable: true,
      writable: true,
      default: false
    }
  ]
}

DateDefinition.prototype.getTypeName = function() {
  return DateDefinition.typeName
}

DateDefinition.prototype.apiSchema = function(options) {

  const schema = PropertyDefinition.prototype.apiSchema.call(this, options)
  if (schema) {
    schema.dateOnly = !!this.dateOnly
  }
  return schema

}

DateDefinition.prototype.getIndexableValue = function(rootDocument, parentDocument, node, value) {

  // could be a string (dateOnly)
  if (this.dateOnly) {
    if (this.array) {
      return utils.array(value).map(v => this.castForQuery(null, v)) // <-- risky and hacky with no ac but this is all going away.
    }
    if (value !== undefined) {

      return this.castForQuery(null, value)
    }
  }
  return value

}

DateDefinition.prototype.castForQuery = function(ac, value) {

  const { dateOnly } = this
  return TypeDate.cast(value, { ac, path: this.fullpath, dateOnly })

}

module.exports = DateDefinition
