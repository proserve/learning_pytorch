'use strict'

const util = require('util'),
      utils = require('../../../../utils'),
      consts = require('../../../../consts'),
      ModelDefinition = require('../model-definition'),
      EnumStates = {
        Created: 0,
        Started: 1,
        Cancelling: 2,
        Completing: 3,
        Completed: 4,
        Error: 5
      },
      Types = {
        ScriptRun: 0
      }

function TransactionDefinition() {

  this._id = TransactionDefinition.statics._id
  this.objectId = TransactionDefinition.statics.objectId
  this.objectLabel = TransactionDefinition.statics.objectLabel
  this.objectName = TransactionDefinition.statics.objectName
  this.pluralName = TransactionDefinition.statics.pluralName

  let options = {

    label: 'Transaction',
    name: 'transaction',
    _id: consts.NativeModels.transaction,
    pluralName: 'transactions',

    properties: [
      {
        label: 'Id',
        name: '_id',
        type: 'ObjectId',
        auto: true
      },
      {
        label: 'Org',
        name: 'org',
        type: 'ObjectId'
      },
      {
        label: 'Type',
        name: 'type',
        type: 'Number'
      },
      {
        label: 'Expires',
        name: 'expires',
        type: 'Date'
      },
      {
        label: 'Timeout',
        name: 'timeout',
        type: 'Number'
      },
      {
        label: 'State',
        name: 'state',
        type: 'Number',
        default: EnumStates.Created
      },
      {
        label: 'Principal',
        name: 'principal',
        type: 'ObjectId'
      },
      {
        label: 'Original Principal',
        name: 'originalPrincipal',
        type: 'ObjectId'
      },
      {
        label: 'Script Identifier',
        name: 'scriptId',
        type: 'ObjectId'
      },
      {
        label: 'Script Type',
        name: 'scriptType',
        type: 'String'
      },
      {
        label: 'Request Id',
        name: 'reqId',
        type: 'ObjectId'
      },
      {
        label: 'Replayable',
        name: 'replayable',
        type: 'Boolean',
        default: false
      },
      {
        label: 'Attempts',
        name: 'attempts',
        type: 'Number',
        default: 0
      },
      {
        label: 'Data',
        name: 'data',
        type: 'Any'
      },
      {
        label: 'Ops',
        name: 'ops',
        type: 'Document',
        array: true,
        properties: [
          {
            label: 'Id',
            name: '_id',
            type: 'ObjectId',
            auto: true
          },
          {
            label: 'State',
            name: 'state',
            type: 'Number'
          },
          {
            label: 'Name',
            name: 'name',
            type: 'String'
          },
          {
            label: 'Data',
            name: 'data',
            type: 'Any'
          },
          {
            label: 'Undo',
            name: 'undo',
            type: 'Document',
            array: false,
            properties: [
              {
                label: 'Name',
                name: 'name',
                type: 'String'
              },
              {
                label: 'Data',
                name: 'data',
                type: 'Any'
              }
            ]
          }
        ]
      }

    ]

  }

  ModelDefinition.call(this, options)
}
util.inherits(TransactionDefinition, ModelDefinition)

TransactionDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = TransactionDefinition.statics
  options.methods = TransactionDefinition.methods
  options.indexes = TransactionDefinition.indexes
  options.options = utils.extend({
    versionKey: false
  }, options.options)

  return ModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

TransactionDefinition.statics = {

  _id: consts.NativeModels.transaction,
  objectId: consts.NativeModels.transaction,
  objectLabel: 'Transaction',
  objectName: 'transaction',
  pluralName: 'transactions',
  requiredAclPaths: ['_id', 'org'],
  EnumStates: EnumStates,
  Types: Types

}

TransactionDefinition.indexes = [
  [{ org: 1 }, { name: 'idxOrg' }],
  [{ type: 1, timeout: 1 }, { name: 'idxType' }],
  [{ expires: 1 }, { expireAfterSeconds: 0, name: 'idxExpires' }]

]

module.exports = TransactionDefinition
