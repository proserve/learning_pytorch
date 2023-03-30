'use strict'

const util = require('util'),
      _ = require('underscore'),
      utils = require('../../../../utils'),
      consts = require('../../../../consts'),
      ModelDefinition = require('../model-definition')

function MessageDefinition() {

  this._id = MessageDefinition.statics._id
  this.objectId = MessageDefinition.statics.objectId
  this.objectLabel = MessageDefinition.statics.objectLabel
  this.objectName = MessageDefinition.statics.objectName
  this.pluralName = MessageDefinition.statics.pluralName

  const options = {

    label: 'Message',
    name: 'message',
    _id: consts.NativeModels.message,
    pluralName: 'messages',

    properties: [

      { label: 'Id', name: '_id', type: 'ObjectId', auto: true },
      { label: 'Org', name: 'org', type: 'ObjectId' },
      { label: 'Name', name: 'name', type: 'String' },
      { label: 'Schedule', name: 'schedule', type: 'String' },
      { label: 'Sequence', name: 'sequence', type: 'Number' },
      { label: 'Queue', name: 'queue', type: 'String' },
      { label: 'Force', name: 'force', type: 'Boolean' },
      { label: 'Worker', name: 'worker', type: 'String' },
      { label: 'Priority', name: 'priority', type: 'Number', default: 0 },
      { label: 'State', name: 'state', type: 'Number', default: consts.messages.states.pending, validators: [{ name: 'numberEnum', definition: { values: _.values(consts.messages.states) } }] },
      { label: 'Tries Left', name: 'triesLeft', type: 'Number' },
      { label: 'Started', name: 'started', type: 'Number' },
      { label: 'Trigger', name: 'trigger', type: 'Number', default: 0 },
      { label: 'Timeout', name: 'timeout', type: 'Number', default: 60000 },
      { label: 'Expires', name: 'expires', type: 'Date' },
      { label: 'Target', name: 'target', type: 'String', default: null },
      { label: 'Payload', name: 'payload', type: 'Any' },
      { label: 'Parent', name: 'parent', type: 'Any' },
      { label: 'Options', name: 'opts', type: 'Any' },
      { label: 'Result', name: 'result', type: 'Any' },
      { label: 'Fault', name: 'fault', type: 'Any' },
      { label: 'Request Identifier', name: 'reqId', type: 'ObjectId' }
    ]

  }

  ModelDefinition.call(this, options)
}
util.inherits(MessageDefinition, ModelDefinition)

MessageDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = MessageDefinition.statics
  options.methods = MessageDefinition.methods
  options.indexes = MessageDefinition.indexes
  options.options = utils.extend({
    versionKey: false
  }, options.options)

  return ModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

MessageDefinition.statics = {

  _id: consts.NativeModels.message,
  objectId: consts.NativeModels.message,
  objectLabel: 'Message',
  objectName: 'message',
  pluralName: 'messages',
  requiredAclPaths: ['_id', 'org']

}

MessageDefinition.indexes = [

  // unique recurring scheduled job names
  [{ name: 1 }, { unique: true, name: 'idxJobName', partialFilterExpression: { name: { $exists: true } } }],

  // the ttl
  [{ expires: 1 }, { expireAfterSeconds: 0, name: 'idxExpires' }],

  // worker queue
  [{ priority: -1, trigger: 1, target: -1, _id: 1, state: 1, queue: 1 }, { name: 'idxWorkerQueue' }],

  // running workers
  [{ worker: 1, state: 1, org: 1 }, { name: 'idxWork', partialFilterExpression: { queue: 'work' } }]

]

module.exports = MessageDefinition
