'use strict'

const acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      util = require('util'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition')

function SignatureDefinition(options) {
  BuiltinContextModelDefinition.call(this, options)
}
util.inherits(SignatureDefinition, BuiltinContextModelDefinition)

SignatureDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = SignatureDefinition.statics
  options.methods = SignatureDefinition.methods
  options.indexes = SignatureDefinition.indexes
  options.options = { collection: SignatureDefinition.collection }
  options.apiHooks = SignatureDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

SignatureDefinition.collection = 'contexts'

SignatureDefinition.prototype.getNativeOptions = function() {

  return {
    _id: consts.NativeIds.signature,
    objectLabel: 'Signature',
    objectName: 'signature',
    pluralName: 'signatures',
    collection: 'signatures',
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
    isUnmanaged: false,
    shareChainOverride: false,
    shareAclOverride: false,
    createAcl: [],
    shareChain: [acl.AccessLevels.Share, acl.AccessLevels.Connected],
    isFavoritable: false,
    allowConnectionOptionsOverride: false,
    properties: [
      {
        label: 'Signer Full Name',
        name: 'signer',
        type: 'String',
        validators: [{
          name: 'required'
        }, {
          name: 'string',
          definition: {
            min: 1,
            max: 100
          }
        }],
        creatable: true
      },
      {
        label: 'Signing Date',
        name: 'date',
        type: 'Date',
        creatable: true,
        validators: [{
          name: 'required'
        }]
      },
      {
        label: 'Context',
        name: 'context',
        type: 'Reference',
        sourceObject: '',
        writable: false,
        nativeIndex: true,
        validators: [{
          name: 'required'
        }]
      },
      {
        label: 'Value',
        name: 'value',
        type: 'Any',
        serializeData: false,
        writable: true,
        history: true,
        maxSize: 10000,
        validators: [{
          name: 'required'
        }]
      }
    ]
  }

}

// shared methods --------------------------------------------------------

SignatureDefinition.methods = {}

// shared statics --------------------------------------------------------

SignatureDefinition.statics = {}

// indexes ---------------------------------------------------------------

SignatureDefinition.indexes = [

  [{ 'org': 1, 'object': 1, 'type': 1, 'context._id': 1, 'context.object': 1 }, { name: 'idxSourceContext' }]

]

// shared hooks  ---------------------------------------------------------

SignatureDefinition.apiHooks = []

// exports --------------------------------------------------------

module.exports = SignatureDefinition
