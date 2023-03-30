'use strict'

const acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      config = require('cortex-service/lib/config'),
      modules = require('../../../../modules'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      AclDefinition = require('../acl-definition')

/**
 * @todo @implement
 *
 *
 * - disallow grants for reading contents when in foreign namespace
 *  - disallow aggregations altogether?
 *
 * - activate and deactivate packages
 *
 * - allow multiple packages of the same but just one active version?
 *
 * - add package contents
 *  - definitions, templates, scripts, etc.
 *
 * - add install/uninstall scripts for various stages (like deployment)
 *
 * - add a way to insert ui elements for new web framework
 *
 * - support script, route, view, etc. object reading out of packages
 *
 * - support reading package config as anonymous user for those that are exposed.
 *  - is this safe?
 */

module.exports = class PackageDefinition extends BuiltinContextModelDefinition {

  generateMongooseSchema(options) {

    options = options || {}
    options.statics = PackageDefinition.statics
    options.methods = PackageDefinition.methods
    options.indexes = PackageDefinition.indexes
    options.options = { collection: PackageDefinition.collection }
    options.apiHooks = PackageDefinition.apiHooks
    options.exclusiveCollection = true
    return super.generateMongooseSchema(options)

  }

  getNativeOptions() {
    return {
      _id: consts.NativeIds.package,
      objectLabel: 'Package',
      objectName: 'package',
      pluralName: 'packages',
      collection: PackageDefinition.collection,
      isExtensible: false,
      isFavoritable: false,
      defaultAclOverride: false,
      defaultAclExtend: false,
      shareChainOverride: false,
      shareAclOverride: false,
      allowConnections: false,
      isVersioned: true,
      isUnmanaged: false,
      hasCreator: false,
      hasOwner: false,
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
          label: 'Package Name',
          name: 'name',
          type: 'String',
          readable: true,
          writable: true,
          creatable: true,
          readAccess: acl.AccessLevels.Public,
          writeAccess: acl.AccessLevels.Public,
          writer: function(ac, node, v) {
            return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(v), true, true)
          },
          validators: [{
            name: 'required'
          }, {
            name: 'customName',
            definition: {
              max: 100
            }
          }]
        },
        {
          label: 'Version',
          name: 'ver',
          type: 'String',
          readAccess: acl.AccessLevels.Public
        },
        {
          label: 'Active',
          name: 'active',
          type: 'Boolean',
          default: false
        },
        {
          label: 'Configuration',
          name: 'configuration',
          type: 'Document',
          array: true,
          maxItems: 100,
          properties: [
            {
              label: 'Key',
              name: 'key',
              type: 'String',
              creatable: true,
              validators: [{
                name: 'required'
              }, {
                name: 'string',
                definition: {
                  min: 1,
                  max: 100
                }
              }, {
                name: 'uniqueInArray'
              }]
            },
            {
              label: 'Value',
              name: 'val',
              type: 'Any',
              serializeData: false,
              writable: true,
              maxSize: 1024
            },
            {

              label: 'Private',
              name: 'private',
              type: 'Boolean',
              default: false,
              writable: true
            },
            {

              label: 'Writable',
              name: 'ritable',
              type: 'Boolean',
              default: true,
              writable: true
            },
            new AclDefinition({
              label: 'Acl',
              name: 'acl',
              type: 'Document',
              readable: true,
              writable: true,
              array: true,
              maxItems: 20,
              canPush: true,
              canPull: true,
              includeId: true,
              default: []
            })
          ]
        }
      ]
    }
  }

  static get collection() {
    return 'packages'
  }

  // collection indexes
  static get indexes() {

    return [
      [{ org: 1, object: 1, type: 1, name: 1 }, { name: 'idxOrgPackage', unique: true }]
    ]

  }

  // mongoose model statics and methods ---------------------------------------------

  static get statics() {
    return {

    }
  }

  static get methods() {
    return {

    }
  }

  static get apiHooks() {

    return [{

      name: 'create',
      before: function(vars, callback) {

        // when created locally, the acl will include all developers.
        // @todo be package aware.
        if (vars.ac.principal.isDeveloper()) {
          vars.ac.subject.acl.push({ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Delete })
        }

        callback()

      }

    }]
  }

}
