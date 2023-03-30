'use strict'

const acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      config = require('cortex-service/lib/config'),
      util = require('util'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition')

function IdpDefinition(options) {
  BuiltinContextModelDefinition.call(this, options)
}
util.inherits(IdpDefinition, BuiltinContextModelDefinition)

IdpDefinition.prototype.generateMongooseSchema = function(options) {
  options = options || {}
  options.statics = IdpDefinition.statics
  options.methods = IdpDefinition.methods
  options.indexes = IdpDefinition.indexes
  options.options = { collection: IdpDefinition.collection }
  options.apiHooks = IdpDefinition.apiHooks
  options.exclusiveCollection = true
  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

IdpDefinition.collection = 'contexts'

IdpDefinition.prototype.getNativeOptions = function() {

  return {
    hasCreator: false,
    hasOwner: false,
    _id: consts.NativeIds.idp,
    objectLabel: 'Identity Provider',
    objectName: 'idp',
    pluralName: 'idps',
    collection: 'contexts',
    isExtensible: false,
    isVersioned: false,
    isDeletable: true,
    isUnmanaged: false,
    isFavoritable: false,
    isDeployable: false,
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
    requiredAclPaths: [],
    sequence: 1,
    uniqueKey: 'uuid',
    properties: [
      {
        _id: consts.Properties.Ids.Idp.Name,
        label: 'Name',
        name: 'name',
        type: 'String',
        writable: true,
        indexed: true,
        indexSlot: 0,
        nativeIndex: true,
        validators: [{
          name: 'required'
        }, {
          name: 'adhoc',
          definition: {
            code: 'cortex.conflict.exists',
            message: 'The name exists for another IdP object. Choose another name.',
            validator: function(ac, node, v, callback) {
              this.constructor.findOne({ org: this.org, name: v, _id: { $ne: this._id } }).lean().select('_id').exec(function(err, doc) {
                callback(err, !(err || doc))
              })
            }
          }
        }]
      },
      {
        _id: consts.Properties.Ids.Idp.UUID,
        label: 'UUID',
        name: 'uuid',
        type: 'UUID',
        writable: false,
        indexed: true,
        indexSlot: 1,
        nativeIndex: true,
        unique: true,
        autoGenerate: true,
        uuidVersion: 4
      },
      {
        label: 'Label',
        name: 'label',
        type: 'String',
        writable: true,
        validators: [
          {
            name: 'required'
          },
          {
            name: 'string',
            definition: {
              min: 1,
              max: 100
            }
          }
        ]
      },
      {
        label: 'Authorization Params',
        name: 'authorizationParams',
        type: 'Document',
        writable: true,
        array: true,
        minItems: 0,
        maxItems: 100,
        properties: [{
          label: 'Key',
          name: 'key',
          type: 'String',
          writable: true,
          validators: [
            {
              name: 'required'
            }, {
              name: 'uniqueInArray'
            }, {
              name: 'string',
              definition: {
                min: 1,
                max: 1024
              }
            }
          ]
        }, {
          label: 'Value',
          name: 'value',
          type: 'String',
          writable: true,
          validators: [
            {
              name: 'required'
            }, {
              name: 'string',
              definition: {
                min: 0,
                max: 1024
              }
            }
          ]
        }]
      }
    ],
    objectTypes: [
      {
        _id: consts.sso.idp.types.oidc,
        label: 'OIDC',
        name: 'oidc',
        properties: [
          {
            label: 'Issuer',
            name: 'issuer',
            type: 'String',
            writable: true,
            validators: [
              {
                name: 'required'
              }, {
                name: 'url'
              }
            ]
          },
          {
            label: 'Client Id',
            name: 'clientId',
            type: 'String',
            writable: true,
            validators: [
              {
                name: 'required'
              }, {
                name: 'string',
                definition: {
                  min: 1,
                  max: 1024
                }
              }
            ]
          },
          {
            label: 'Client Secret',
            name: 'clientSecret',
            type: 'String',
            writable: true,
            validators: [
              {
                name: 'required'
              }, {
                name: 'string',
                definition: {
                  min: 1,
                  max: 1024
                }
              }
            ]
          },
          {
            label: 'Force Authentication',
            name: 'forceAuthn',
            type: 'Boolean',
            writable: true,
            default: false
          },
          {
            label: 'Redirect URI',
            name: 'redirectUri',
            type: 'String',
            writable: true,
            validators: [
              {
                name: 'url',
                allowNull: true
              }
            ]
          }
        ]
      },
      {
        _id: consts.sso.idp.types.saml2,
        label: 'SAML2',
        name: 'saml',
        properties: [
          {
            label: 'Login Url',
            name: 'ssoLoginUrl',
            type: 'String',
            writable: true,
            validators: [
              {
                name: 'required'
              }, {
                name: 'url'
              }
            ]
          },
          {
            label: 'Logout Url',
            name: 'ssoLogoutUrl',
            type: 'String',
            writable: true,
            validators: [
              {
                name: 'url',
                allowNull: true
              }
            ]
          },
          {
            label: 'Certificates',
            name: 'certificates',
            type: 'String',
            writable: true,
            array: true,
            minItems: 1,
            maxItems: 20,
            validators: [
              {
                name: 'string',
                definition: {
                  min: 1,
                  max: 1024
                }
              }
            ]
          },
          {
            label: 'Allow Unencrypted Assertion',
            name: 'allowUnencryptedAssertion',
            type: 'Boolean',
            writable: true,
            default: true
          },
          {
            label: 'Force Authentication',
            name: 'forceAuthn',
            type: 'Boolean',
            writable: true,
            default: false
          },
          {
            label: 'Sign Get Request',
            name: 'signGetRequest',
            type: 'Boolean',
            writable: true,
            default: false
          },
          {
            label: 'Relay State',
            name: 'relayState',
            type: 'Boolean',
            writable: true,
            validators: [
              {
                name: 'url',
                allowNull: true
              }
            ]
          }
        ]
      }
    ]
  }
}

// shared methods --------------------------------------------------------

IdpDefinition.methods = {

}

// shared statics --------------------------------------------------------

IdpDefinition.statics = {

  aclInit() {

  }

}

// indexes ---------------------------------------------------------------

IdpDefinition.indexes = [

]

// shared hooks  ---------------------------------------------------------

IdpDefinition.apiHooks = []

// exports --------------------------------------------------------

module.exports = IdpDefinition
