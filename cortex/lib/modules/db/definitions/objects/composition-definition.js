'use strict'

const acl = require('../../../../acl'),
      Fault = require('cortex-service/lib/fault'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      { toJSON, encodeME, decodeME } = require('../../../../utils'),
      util = require('util'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      supportedFormats = [{
        mime: 'video/mp4',
        extension: 'mp4'
      }]

function CompositionDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(CompositionDefinition, BuiltinContextModelDefinition)

CompositionDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = CompositionDefinition.statics
  options.methods = CompositionDefinition.methods
  options.indexes = CompositionDefinition.indexes
  options.options = { collection: CompositionDefinition.collection }
  options.apiHooks = CompositionDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

CompositionDefinition.collection = 'contexts'

CompositionDefinition.prototype.getNativeOptions = function() {

  return {
    _id: consts.NativeIds.composition,
    objectLabel: 'Composition',
    objectName: 'composition',
    pluralName: 'compositions',
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
    isDeletable: true,
    canCascadeDelete: false,
    isUnmanaged: false,
    shareChainOverride: false,
    shareAclOverride: false,
    createAcl: [],
    shareChain: [acl.AccessLevels.Share, acl.AccessLevels.Connected],
    isFavoritable: false,
    allowConnectionOptionsOverride: false,
    properties: [
      {
        _id: consts.Properties.Ids.Composition.Context,
        label: 'Context',
        name: 'context',
        type: 'Reference',
        sourceObject: '',
        creatable: true,
        indexed: true,
        indexSlot: 0,
        allowObjectWrite: true,
        writeAccess: acl.AccessLevels.System,
        validators: [{
          name: 'required'
        }]
      },
      {
        // remote job id. could vary based on future implementation.
        _id: consts.Properties.Ids.Composition.Remote,
        name: 'remoteId',
        label: 'Remote Identifier',
        type: 'String',
        writeAccess: acl.AccessLevels.System,
        writable: true,
        indexed: true,
        indexSlot: 1
      },
      {
        label: 'Format',
        name: 'format',
        type: 'String',
        default: 'video/mp4',
        writable: true,
        writeAccess: acl.AccessLevels.System,
        validators: [{
          name: 'required'
        }, {
          name: 'stringEnum',
          definition: {
            values: supportedFormats.map(v => v.mime)
          }
        }]
      },
      {
        _id: consts.Properties.Ids.Composition.State,
        label: 'State',
        name: 'state',
        type: 'String',
        default: 'queued',
        writable: true,
        writeAccess: acl.AccessLevels.System,
        indexed: true,
        indexSlot: 2,
        validators: [{
          name: 'required'
        }, {
          name: 'stringEnum',
          definition: {
            values: ['queued', 'running', 'complete', 'error']
          }
        }]
      },
      {
        label: 'Error',
        name: 'err',
        type: 'Any',
        serializeData: false,
        set: (v) => {
          const err = encodeME(toJSON(Fault.from(v)), '$$decodedErr', this)
          if (err && err.stack) {
            delete err.stack // NEVER include the stack.
          }
          return err
        },
        get: function(v) { return decodeME(v, '$$decodedErr', this) },
        writable: true,
        writeAccess: acl.AccessLevels.System
      },
      {
        label: 'Output',
        name: 'output',
        type: 'String',
        array: true,
        maxItems: -1,
        canPush: false,
        canPull: false,
        writable: true,
        writeAccess: acl.AccessLevels.System
      },
      {
        _id: consts.Properties.Ids.Composition.Start,
        label: 'Started',
        name: 'started',
        type: 'Date',
        default: null,
        writable: true,
        writeAccess: acl.AccessLevels.System,
        indexed: true,
        indexSlot: 3
      },
      {
        label: 'Completed',
        name: 'completed',
        type: 'Date',
        default: null,
        writable: true,
        writeAccess: acl.AccessLevels.System
      },
      {
        _id: consts.Properties.Ids.Composition.File,
        label: 'File',
        name: 'file',
        type: 'File',
        writable: true,
        writeAccess: acl.AccessLevels.System,
        processors: [{
          type: 'passthru',
          name: 'content',
          source: 'content',
          mimes: supportedFormats.map(v => v.mime),
          allowUpload: true,
          passMimes: false,
          required: true,
          skipVirusScan: true
        }]
      },
      {
        label: 'Definition',
        name: 'definition',
        type: 'Any',
        writable: true,
        writeAccess: acl.AccessLevels.System,
        serializeData: false,
        validators: [{
          name: 'required'
        }]
      },
      {
        label: 'Progress',
        name: 'progress',
        type: 'Number',
        writable: true,
        writeAccess: acl.AccessLevels.System,
        default: 0
      },
      {
        label: 'Retries',
        name: 'retries',
        type: 'Number',
        default: 0,
        writable: true,
        writeAccess: acl.AccessLevels.System
      }
    ]
  }

}

// shared methods --------------------------------------------------------

CompositionDefinition.methods = {}

// shared statics --------------------------------------------------------

CompositionDefinition.statics = {}

// indexes ---------------------------------------------------------------

CompositionDefinition.indexes = []

// shared hooks  ---------------------------------------------------------

CompositionDefinition.apiHooks = [
  {
    name: 'create',
    async after(vars, callback) {

      modules.workers.runNow('transcoder')
      callback()
    }
  }
]

// exports --------------------------------------------------------

module.exports = CompositionDefinition
