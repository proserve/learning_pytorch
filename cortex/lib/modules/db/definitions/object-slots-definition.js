'use strict'

var util = require('util'),
    utils = require('../../../utils'),
    DocumentDefinition = require('./types/document-definition'),
    config = require('cortex-service/lib/config')

// ---------------------------------------------------------

/**
 * @constructor
 */
function ObjectSlotsDefinition(options) {

  options = utils.extend({

    label: 'Index Slots',
    name: 'slots',
    readable: !!config('debug.readableIndexes'),
    array: true,
    properties: [
      {
        label: 'Property Identifier',
        name: '_id',
        type: 'ObjectId',
        auto: false
      },
      {
        label: 'Unique',
        name: 'unique',
        type: 'Boolean'
      },
      {
        label: 'Slot Name',
        name: 'name',
        type: 'String'
      }
    ]

  }, options)

  DocumentDefinition.call(this, options)
}
util.inherits(ObjectSlotsDefinition, DocumentDefinition)

module.exports = ObjectSlotsDefinition
