'use strict'

const acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      semver = require('semver'),
      modules = require('../../../../modules'),
      util = require('util'),
      { isPlainObject, visit } = require('../../../../utils'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      local = {
        _definitions: null
      }

Object.defineProperty(local, 'definitions', { get: function() { return (this._definitions || (this._definitions = require('../index'))) } })

function I18nDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(I18nDefinition, BuiltinContextModelDefinition)

I18nDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = I18nDefinition.statics
  options.methods = I18nDefinition.methods
  options.indexes = I18nDefinition.indexes
  options.options = { collection: I18nDefinition.collection }
  options.apiHooks = I18nDefinition.apiHooks
  options.exclusiveCollection = true

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

I18nDefinition.collection = 'contexts'

I18nDefinition.prototype.getNativeOptions = function() {
  return {
    _id: consts.NativeIds.i18n,
    objectLabel: 'i18n',
    objectName: 'i18n',
    pluralName: 'i18ns',
    collection: 'i18ns',
    uniqueKey: 'name',
    isExtensible: false,
    isFavoritable: false,
    defaultAclOverride: false,
    defaultAclExtend: false,
    shareChainOverride: false,
    shareAclOverride: false,
    allowConnections: false,
    allowConnectionsOverride: false,
    allowConnectionOptionsOverride: false,
    requiredAclPaths: ['_id', 'org', 'tags', 'name'],
    defaultAcl: [
      { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Delete : acl.AccessLevels.Read) },
      { type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Delete }
    ],
    createAcl: config('app.env') === 'development'
      ? [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Min }]
      : [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }],
    createAclOverwrite: false,
    createAclExtend: false,
    shareChain: [acl.AccessLevels.Connected],
    properties: [
      {
        label: 'Name',
        name: 'name',
        type: 'String',
        creatable: true,
        readable: true,
        nativeIndex: true,
        trim: true,
        acl: acl.Inherit,
        validators: [{
          name: 'required'
        }, {
          name: 'customName',
          definition: {
            max: 256
          }
        }]
      },
      {
        label: 'Namespace',
        name: 'namespace',
        type: 'String',
        acl: acl.Inherit,
        writable: true,
        nativeIndex: true,
        default: 'cortex',
        validators: [{
          name: 'required'
        }, {
          name: 'dotPath'
        }]
      },
      {
        label: 'Locale',
        name: 'locale',
        type: 'String',
        acl: acl.Inherit,
        writable: true,
        nativeIndex: true,
        validators: [{
          name: 'required'
        }, {
          name: 'locale'
        }]
      },
      {
        label: 'Extends',
        name: 'extends',
        type: 'String',
        acl: acl.Inherit,
        writable: true,
        validators: [{
          name: 'locale'
        }]
      },
      {
        // en_US ~ english
        label: 'Aliases',
        name: 'aliases',
        type: 'String',
        acl: acl.Inherit,
        writable: true,
        nativeIndex: true,
        array: true,
        uniqueValues: true,
        dependencies: ['locale'],
        default: [],
        validators: [{
          name: 'locale'
        }]
      },
      {
        label: 'Data',
        name: 'data',
        type: 'Any',
        writable: true,
        acl: acl.Inherit,
        serializeData: false,
        dependencies: ['keys'],
        validators: [{
          name: 'adhoc',
          definition: {
            message: 'Expecting an object that contains keys without $ or . characters.',
            validator: function(ac, node, value) {
              if (isPlainObject(value)) {
                let ok = true
                visit(value, {
                  fnObj: (val, currentKey, parentObject, parentIsArray) => {
                    if (parentIsArray || (parentObject && !/^[a-zA-Z0-9-_]{1,}$/.test(currentKey))) {
                      ok = false
                      return -1
                    }
                  },
                  fnVal: (val, currentKey, parentObject, parentIsArray) => {
                    if ((parentObject && !/^[a-zA-Z0-9-_]{1,}$/.test(currentKey))) {
                      ok = false
                      return -1
                    }
                  }
                })
                return ok
              }
              return false
            }
          }
        }]
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
            writable: true,
            array: true,
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
      },
      {
        label: 'Runtime Weight',
        name: 'weight',
        type: 'Number',
        writable: true,
        default: 0,
        acl: acl.Inherit,
        validators: [{
          name: 'required'
        }, {
          name: 'number',
          definition: {
            allowNull: false,
            allowDecimal: true
          }
        }]
      },
      {
        label: 'Is Extensible',
        name: 'extensible',
        type: 'Boolean',
        writable: true,
        default: true,
        acl: acl.Inherit
      },
      {
        label: 'Is Overridable',
        name: 'overridable',
        type: 'Boolean',
        writable: true,
        default: true,
        acl: acl.Inherit
      },
      {
        label: 'Version',
        name: 'version',
        type: 'String',
        writable: true,
        readable: true,
        default: '1.0.0',
        acl: acl.Inherit,
        validators: [{
          name: 'adhoc',
          message: 'Requires a valid semver version',
          definition: {
            validator: (ac, node, value) => {
              return semver.valid(value) !== null
            }
          }
        }]
      }
    ]
  }
}

// shared statics --------------------------------------------------------

I18nDefinition.statics = {

}

// indexes ---------------------------------------------------------------

I18nDefinition.indexes = [

  [{ org: 1, name: 1 }, { unique: true, name: 'idxName' }],
  [{ org: 1, alias: 1 }, { name: 'idxAlias' }],
  [{ org: 1, locale: 1 }, { name: 'idxLocale' }],
  [{ org: 1, tags: 1 }, { name: 'idxTags' }]

]

// uploads --------------------------------------------------------

module.exports = I18nDefinition
