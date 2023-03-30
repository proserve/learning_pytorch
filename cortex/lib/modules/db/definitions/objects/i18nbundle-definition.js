'use strict'

const config = require('cortex-service/lib/config'),
      consts = require('../../../../consts'),
      acl = require('../../../../acl'),
      util = require('util'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition')

function I18nbundleDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)
}

util.inherits(I18nbundleDefinition, BuiltinContextModelDefinition)

I18nbundleDefinition.prototype.generateMongooseSchema = function(options) {
  options = options || {}
  options.statics = I18nbundleDefinition.statics
  options.methods = I18nbundleDefinition.methods
  options.indexes = I18nbundleDefinition.indexes
  options.options = { collection: I18nbundleDefinition.collection }
  options.apiHooks = I18nbundleDefinition.apiHooks
  options.exclusiveCollection = true
  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

I18nbundleDefinition.collection = 'contexts'

I18nbundleDefinition.prototype.getNativeOptions = function() {

  return {
    hasCreator: true,
    hasOwner: true,
    _id: consts.NativeIds.i18nBundle,
    objectLabel: 'i18n Bundle',
    objectName: 'i18nbundle',
    pluralName: 'i18nbundles',
    collection: 'i18n-bundles',
    isExtensible: false,
    isVersioned: false,
    isDeletable: true,
    isUnmanaged: false,
    isFavoritable: false,
    auditing: {
      enabled: false
    },
    obeyObjectMode: true,
    allowConnections: false,
    allowConnectionsOverride: false,
    allowConnectionOptionsOverride: false,
    allowBypassCreateAcl: true,
    createAclOverwrite: false,
    createAclExtend: false,
    defaultAclOverride: false,
    shareChainOverride: false,
    shareAclOverride: false,
    shareChain: [],
    defaultAcl: [
      { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Delete : acl.AccessLevels.Read) },
      { type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Delete }
    ],
    createAcl: config('app.env') === 'development'
      ? [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Min }]
      : [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }],
    sequence: 1,
    requiredAclPaths: ['locale', 'namespace'],
    properties: [
      {
        label: 'Locale',
        name: 'locale',
        type: 'String',
        nativeIndex: true,
        writable: true,
        readable: true,
        validators: [
          {
            name: 'locale'
          }
        ]
      },
      {
        label: 'Namespace',
        name: 'namespace',
        type: 'String',
        acl: acl.Inherit,
        writable: true,
        nativeIndex: true,
        validators: [{
          name: 'dotPath',
          definition: {
            allowNull: true
          }
        }]
      },
      {
        label: 'Hash',
        name: 'hash',
        writable: true,
        readable: true,
        type: 'String'
      },
      {
        _id: consts.Properties.Files.Ids.Bundle.BundleFile,
        label: 'Bundle File',
        name: 'bundle',
        type: 'File',
        writable: true,
        readAccess: acl.AccessLevels.Public,
        acl: acl.Inherit,
        processors: [{
          type: 'public',
          name: 'content',
          source: 'content',
          mimes: ['application/json'],
          allowUpload: true,
          passMimes: false,
          required: true,
          skipVirusScan: true,
          maxFileSize: 5e+9
        }]
      },
      {
        label: 'Data',
        name: 'data',
        type: 'Any',
        writable: true
      },
      {
        label: 'Assets',
        name: 'assets',
        type: 'Document',
        array: true,
        maxItems: -1,
        uniqueKey: 'key',
        properties: [
          {
            label: 'Key',
            name: 'key',
            type: 'String',
            readable: true,
            creatable: true,
            trim: true,
            validators: [{
              name: 'required'
            }, {
              name: 'dotPath'
            }, {
              name: 'uniqueInArray'
            }]
          },
          {
            label: 'Value',
            name: 'value',
            type: 'File',
            array: true,
            writable: true,
            acl: acl.Inherit,
            processors: [{
              type: 'passthru',
              name: 'content',
              source: 'content',
              mimes: ['*'],
              allowUpload: true,
              passMimes: false,
              required: true,
              maxFileSize: 5e+9
            }]
          }
        ]
      },
      {
        label: 'Tags',
        name: 'tags',
        type: 'String',
        writable: true,
        nativeIndex: true,
        trim: true,
        array: true,
        acl: acl.Inherit,
        maxItems: 100,
        validators: [{
          name: 'string',
          definition: {
            min: 1,
            max: 100
          }
        }]
      }
    ]
  }
}

// indexes ---------------------------------------------------------------

I18nbundleDefinition.indexes = [
  // the locale, namespace index
  [{ org: 1, locale: 1, namespace: 1 }, { unique: true, name: 'idxLocaleNs' }],
  // state
  [{ org: 1, object: 1, reap: 1 }, { name: 'idxState' }]
]

// static ---------------------------------------------------------
I18nbundleDefinition.statics = {

}

I18nbundleDefinition.apiHooks = [{
  name: 'delete',
  after: function(vars, callback) {
    vars.ac.principal.org.i18n.removeResource(vars.ac.subject.locale, vars.ac.subject.namespace)
    callback()
  }
}]

// exports --------------------------------------------------------

module.exports = I18nbundleDefinition
