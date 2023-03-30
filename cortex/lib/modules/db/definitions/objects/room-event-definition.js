'use strict'

const acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      util = require('util'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition')

function RoomEventDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(RoomEventDefinition, BuiltinContextModelDefinition)

RoomEventDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = RoomEventDefinition.statics
  options.methods = RoomEventDefinition.methods
  options.indexes = RoomEventDefinition.indexes
  options.options = { collection: RoomEventDefinition.collection }
  options.apiHooks = RoomEventDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

RoomEventDefinition.collection = 'contexts'

RoomEventDefinition.prototype.getNativeOptions = function() {

  return {
    _id: consts.NativeIds.roomevent,
    isDeployable: false,
    objectLabel: 'Room Event',
    objectName: 'roomevent',
    pluralName: 'roomevents',
    collection: 'contexts',
    isExtensible: false,
    defaultAclOverride: false,
    defaultAclExtend: false,
    defaultAcl: [],
    createAclOverwrite: false,
    createAclExtend: false,
    allowConnections: false,
    allowConnectionsOverride: false,
    isVersioned: false,
    isDeletable: false,
    canCascadeDelete: true,
    isUnmanaged: true,
    shareChainOverride: false,
    shareAclOverride: false,
    createAcl: [],
    shareChain: [acl.AccessLevels.Share, acl.AccessLevels.Connected],
    isFavoritable: false,
    allowConnectionOptionsOverride: false,
    properties: [
      {
        _id: consts.Properties.Ids.RoomEvent.Room,
        label: 'Room',
        name: 'roomId',
        type: 'ObjectId',
        sourceObject: 'room',
        indexed: true,
        indexSlot: 0,
        writable: true,
        writeAccess: acl.AccessLevels.System,
        cascadeDelete: true
      },
      {
        _id: consts.Properties.Ids.RoomEvent.Name,
        label: 'Name',
        name: 'name',
        type: 'String',
        writable: true,
        writeAccess: acl.AccessLevels.System,
        indexed: true,
        indexSlot: 1
      },
      {
        _id: consts.Properties.Ids.RoomEvent.Order,
        label: 'Order',
        name: 'order',
        type: 'Number',
        writable: true,
        writeAccess: acl.AccessLevels.System,
        indexed: true,
        indexSlot: 2
      },
      {
        _id: consts.Properties.Ids.RoomEvent.Account,
        label: 'Account',
        name: 'accountId',
        type: 'ObjectId',
        sourceObject: 'account',
        indexed: true,
        indexSlot: 3,
        writable: true,
        writeAccess: acl.AccessLevels.System
      },
      {
        label: 'Created',
        name: 'created',
        type: 'Date',
        nativeIndex: true,
        writable: true,
        writeAccess: acl.AccessLevels.System
      }
    ],
    objectTypes: [
      {
        _id: consts.roomEvents.types.room,
        label: 'Room',
        name: 'room',
        properties: [
          {
            // room status
            label: 'Status',
            name: 'status',
            type: 'String',
            writable: true,
            writeAccess: acl.AccessLevels.System
          },
          {
            label: 'Duration',
            name: 'duration',
            type: 'Number',
            writable: true,
            writeAccess: acl.AccessLevels.System
          }
        ]
      },
      {
        _id: consts.roomEvents.types.participant,
        label: 'Participant',
        name: 'participant',
        properties: [
          {
            // participant status
            label: 'Status',
            name: 'status',
            type: 'String',
            writable: true,
            writeAccess: acl.AccessLevels.System
          },
          {
            label: 'Duration',
            name: 'duration',
            type: 'Number',
            writable: true,
            writeAccess: acl.AccessLevels.System
          }
        ]
      },
      {
        _id: consts.roomEvents.types.track,
        label: 'Track',
        name: 'track',
        properties: [
          {
            // participant status
            label: 'Status',
            name: 'status',
            type: 'String',
            writable: true,
            writeAccess: acl.AccessLevels.System
          }, {
            label: 'Track Name',
            name: 'trackName',
            type: 'String',
            writable: true,
            writeAccess: acl.AccessLevels.System
          }, {
            label: 'Track Kind',
            name: 'trackKind',
            type: 'String',
            writable: true,
            writeAccess: acl.AccessLevels.System
          }
        ]
      },
      {
        _id: consts.roomEvents.types.recording,
        label: 'Recording',
        name: 'recording',
        properties: [
        ]
      },
      {
        _id: consts.roomEvents.types.composition,
        label: 'Composition',
        name: 'composition',
        properties: [
        ]
      },
      {
        _id: consts.roomEvents.types.message,
        label: 'Message',
        name: 'message',
        properties: [
        ]
      },
      {
        _id: consts.roomEvents.types.user,
        label: 'User',
        name: 'user',
        properties: [
        ]
      }
    ]
  }

}

// shared methods --------------------------------------------------------

RoomEventDefinition.methods = {}

// shared statics --------------------------------------------------------

RoomEventDefinition.statics = {}

// indexes ---------------------------------------------------------------

RoomEventDefinition.indexes = []

// shared hooks  ---------------------------------------------------------

RoomEventDefinition.apiHooks = []

// exports --------------------------------------------------------

module.exports = RoomEventDefinition
