'use strict'

const util = require('util'),
      utils = require('../../../../utils'),
      consts = require('../../../../consts'),
      config = require('cortex-service/lib/config'),
      ModelDefinition = require('../model-definition')

function NotificationDefinition() {

  this._id = NotificationDefinition.statics._id
  this.objectId = NotificationDefinition.statics.objectId
  this.objectLabel = NotificationDefinition.statics.objectLabel
  this.objectName = NotificationDefinition.statics.objectName
  this.pluralName = NotificationDefinition.statics.pluralName

  const options = {

    label: 'Notification',
    name: 'notification',
    _id: consts.NativeObjects.notification,
    pluralName: 'notifications',

    properties: [
      {
        label: 'Id',
        name: '_id',
        type: 'ObjectId',
        // description: 'The notification identifier.',
        auto: true,
        readable: true,
        nativeIndex: true
      },
      {
        label: 'Account',
        name: 'account',
        type: 'ObjectId',
        readable: false
      },
      {
        label: 'Created',
        name: 'created',
        type: 'Date'
      },
      {
        label: 'Org',
        name: 'org',
        type: 'ObjectId',
        public: false,
        readable: false,
        validators: [{
          name: 'required'
        }]
      },
      {
        label: 'Object',
        name: 'object',
        type: 'String',
        virtual: true,
        reader: function(ac, node) {
          return node.root.objectName
        }
      },
      {
        label: 'Type',
        name: 'type',
        type: 'ObjectId',
        // description: 'The notification type (Post Update: 1, Invitation: 2, Transfer Request: 3, Comment Update: 4)',
        validators: [{
          name: 'required'
        }]
      },
      {
        label: 'Context',
        name: 'context',
        // description: 'The context for which the notification was created.',
        type: 'Reference',
        expandable: true,
        nativeIndex: true
      },
      {
        label: 'Meta',
        name: 'meta',
        type: 'Any',
        // description: 'An object containing notification metadata. For post updates, for example, it contains the postId and postType. For comments, it also contains the commentId.',
        serializeData: false,
        dependencies: ['context']
      }
    ]

  }

  ModelDefinition.call(this, options)
}
util.inherits(NotificationDefinition, ModelDefinition)

NotificationDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = NotificationDefinition.statics
  options.methods = NotificationDefinition.methods
  options.indexes = NotificationDefinition.indexes
  options.options = utils.extend({
    versionKey: false
  }, options.options)

  return ModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

NotificationDefinition.statics = {

  _id: consts.NativeObjects.notification,
  objectId: consts.NativeObjects.notification,
  objectLabel: 'Notification',
  objectName: 'notification',
  pluralName: 'notifications',
  requiredAclPaths: ['_id', 'type', 'org', 'object', 'sequence']

}

NotificationDefinition.indexes = [

  [{ account: 1 }, { name: 'idxAccount' }],

  [{ 'context._id': 1 }, { name: 'idxContextId' }],

  [{ 'context.object': 1 }, { name: 'idxContextObject' }],

  [{ created: 1 }, { expireAfterSeconds: config('notifications.expiryInSeconds'), name: 'idxCreatedExpiry' }]

]

module.exports = NotificationDefinition
