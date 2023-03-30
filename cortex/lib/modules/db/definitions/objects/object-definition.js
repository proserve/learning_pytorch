'use strict'

const Fault = require('cortex-service/lib/fault'),
      utils = require('../../../../utils'),
      { path: pathTo, array: toArray, rString, isPlainObject, promised, isInt, isCustomName } = utils,
      acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      { singularize, pluralize, capitalize } = require('inflection'),
      config = require('cortex-service/lib/config'),
      logger = require('cortex-service/lib/logger'),
      async = require('async'),
      jp = require('jsonpath'),
      util = require('util'),
      _ = require('underscore'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      AclDefinition = require('../acl-definition'),
      ObjectSlotsDefinition = require('../object-slots-definition'),
      PropertySetDefinition = require('../property-set-definition'),
      PostTypeDefinition = require('../feeds/post-type-definition'),
      PropertyDefinition = require('../property-definition'),
      DocumentDefinition = require('../types/document-definition'),
      makeUniqueKey = require('../properties/uniqueKey').definition,
      builtInCascadeDeleteProperties = new Map()

let Undefined

function ObjectDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(ObjectDefinition, BuiltinContextModelDefinition)

ObjectDefinition.prototype.selectPaths = function(principal, options) {

  // when editing an object, always load everything in order to update the schemaCache
  if (options && options.forUpdate) {
    return BuiltinContextModelDefinition.prototype.selectPaths.call(this, principal, Object.assign({}, options, { paths: null }))
  }

  const selections = BuiltinContextModelDefinition.prototype.selectPaths.call(this, principal, options)
  selections.lookup = true
  selections.name = true
  return selections

}

ObjectDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = ObjectDefinition.statics
  options.methods = ObjectDefinition.methods
  options.indexes = ObjectDefinition.indexes
  options.options = { collection: ObjectDefinition.collection }
  options.apiHooks = ObjectDefinition.apiHooks
  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

ObjectDefinition.collection = 'objects'

ObjectDefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {

  BuiltinContextModelDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, path, options)

  // always select...
  selections.slots = true
  selections.properties = true
  BuiltinContextModelDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, 'isUnmanaged', options)
  BuiltinContextModelDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, 'objectTypes', options)

  selections['feedDefinition.postSlots'] = true
  selections['feedDefinition.body.properties'] = true
  selections['feedDefinition.commentSlots'] = true
  selections['feedDefinition.comments.properties'] = true

}

ObjectDefinition.prototype.onPropertyValueAdded = function(ac, node, parentDocument, value, index) {
  modules.db.getRootDocument(parentDocument).markModified('isUnmanaged')
}

ObjectDefinition.prototype.onPropertyRemovingValue = function(ac, node, parentDocument, value, index) {
  modules.db.getRootDocument(parentDocument).markModified('isUnmanaged')
}

ObjectDefinition.prototype.walkPropertySet = function(properties, fn) {

  const stack = [ properties ]
  while (stack.length) {
    const value = stack.pop()
    if (Array.isArray(value)) {
      for (let prop of value) {
        if (prop.type === 'Document') {
          stack.push(prop.properties)
        } else if (prop.type === 'Set') {
          for (let doc of prop.documents) {
            stack.push(doc.properties)
          }
        }
        if (fn(prop) === false) {
          return false
        }
      }
    }
  }
  return true

}

ObjectDefinition.prototype.getNativeOptions = function() {

  return {
    hasCreator: true,
    hasOwner: false,
    hasImage: false,
    hasETag: true,
    isDeployable: true,
    uniqueKey: 'name',
    allowConnections: false,
    allowConnectionsOverride: false,
    allowConnectionOptionsOverride: false,
    _id: consts.NativeIds.object,
    objectLabel: 'Object',
    objectName: 'object',
    pluralName: 'objects',
    collection: 'objects',
    isExtensible: false,
    auditing: {
      enabled: true,
      all: true,
      category: 'configuration'
    },
    defaultAclOverride: false,
    defaultAclExtend: false,
    shareChainOverride: false,
    shareAclOverride: false,
    defaultAcl: [
      { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Delete : acl.AccessLevels.Read) },
      { type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Delete }
    ],
    createAclOverwrite: false,
    createAclExtend: false,
    createAcl: config('app.env') === 'development'
      ? [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Min }]
      : [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }],
    shareChain: [],
    requiredAclPaths: ['dataset', 'name', 'pluralName', 'localized', 'useBundles'],
    maintenance: {
      syncContexts: function(org, callback) {
        // ensure contexts list is synced in the current org context
      }
    },
    properties: [
      {
        label: 'Localized',
        name: 'localized',
        type: 'Boolean',
        writePriority: 1,
        dependencies: ['.label', '.description', 'locale'],
        readable: true,
        writable: true,
        default: false,
        writer: function(ac, node, v, opt, callback) {
          if (!v && this.localized && (!this.label || !this.description)) {
            const label = this.locales.label.find(l => l.locale === ac.org.locale || l.locale === ac.locale) || this.locales.label[0],
                  description = this.locales.description.find(l => l.locale === ac.org.locale || l.locale === ac.locale) || this.locales.description[0]
            this.localized = v
            async.series([
              cb => {
                const value = label && !this.label ? label.value : this.name
                if (!value) {
                  return cb()
                }
                this.markModified('label')
                node.root.properties.label.aclWrite(ac, this, value, opt, cb)
              },
              cb => {
                const value = description && !this.description ? description.value : this.name
                if (!value) {
                  return cb()
                }
                this.markModified('description')
                node.root.properties.description.aclWrite(ac, this, value, opt, cb)
              }
            ], (err) => {
              callback(err, v)
            })
          } else {
            callback(null, v)
          }
        }
      },
      {
        label: 'Use i18n bundles',
        name: 'useBundles',
        dependencies: ['.label', '.description', '.localized', 'locale'],
        writePriority: 2,
        type: 'Boolean',
        readable: true,
        writable: true,
        default: false
      },
      {
        label: 'Label',
        name: 'label',
        type: 'String',
        // description: 'The object label.',
        readable: true,
        writable: true,
        nativeIndex: true,
        deferWrites: true,
        stub: '',
        validators: [{
          name: 'required'
        }, {
          name: 'string',
          definition: { min: 1, max: 100 }
        }],
        localization: {
          enabled: true,
          strict: false,
          fallback: true
        }
      },
      makeUniqueKey(),
      {
        label: 'Name',
        name: 'name',
        type: 'String',
        // description: 'The object name.',
        dependencies: ['org', 'pluralName'],
        readable: true,
        nativeIndex: true,
        creatable: true,
        lowercase: true,
        trim: true,
        writer: function(ac, node, v) {
          if (_.isString(v)) {
            v = v.toLowerCase().trim()
            // add the prefix if a built-in object is not chosen
            if (v.indexOf('c_') !== 0 && !~v.indexOf('__') && !modules.db.definitions.builtInObjectDefsMap[v]) {
              v = 'c_' + v
            }
            if (v) {
              v = singularize(v)
              this.pluralName = pluralize(v)
            }
          }
          return v
        },
        validators: [{
          name: 'required'
        }, {
          name: 'customName',
          definition: {
            validator: function(ac, node, v, isCustom) {
              if (!isCustom) {
                const def = modules.db.definitions.builtInObjectDefsMap[v]
                if (!def) {
                  throw Fault.create('cortex.invalidArgument.object', { reason: 'Extensions must match a built-in object code' })
                }
                if (!def.isExtensible) {
                  throw Fault.create('cortex.accessDenied.unspecified', { reason: 'The "' + v + '" Object is not extensible' })
                }
              }
              return true
            }
          }
        }, {
          name: 'adhoc',
          definition: {
            code: 'cortex.conflict.exists',
            message: 'A unique object name',
            validator: function(ac, node, v, callback) {
              this.constructor.findOne({ org: this.org, name: v, _id: { $ne: this._id } }).lean().select('_id').exec(function(err, doc) {
                callback(err, !(err || doc))
              })
            }
          }
        }]
      },
      {
        label: 'Plural name',
        name: 'pluralName',
        type: 'String',
        // description: 'Based on the name, this is the name used in API routes. For example, to retrieve a list of c_thing objects, use "GET /c_things"',
        dependencies: ['org'],
        readable: true,
        writable: false,
        nativeIndex: true,
        validators: [{
          name: 'required'
        }, {
          name: 'adhoc',
          definition: {
            code: 'cortex.conflict.exists',
            message: 'The plural name exists for another object. Choose another object name.',
            validator: function(ac, node, v, callback) {
              this.constructor.findOne({ org: this.org, pluralName: v, _id: { $ne: this._id } }).lean().select('_id').exec(function(err, doc) {
                callback(err, !(err || doc))
              })
            }
          }
        }]
      },
      {
        label: 'Lookup',
        name: 'lookup',
        type: 'ObjectId',
        // description: 'The lookup is used in context collections as the object property. We need a secondary lookup because all built-in contexts have the same _id, even across orgs.',
        readable: true,
        writable: false
      },
      {
        label: 'Description',
        name: 'description',
        type: 'String',
        stub: '',
        // description: 'The object description.',
        readable: true,
        writable: true,
        validators: [{
          name: 'string',
          definition: { min: 0, max: 512 }
        }],
        localization: {
          enabled: true,
          strict: false,
          fallback: true
        }
      },
      {
        label: 'Deletable',
        name: 'isDeletable',
        type: 'Boolean',
        default: true,
        readable: true,
        writable: true
      },
      {
        // applies to non-deletable. if true, will still cascade delete.
        label: 'Can Cascade Delete',
        name: 'canCascadeDelete',
        type: 'Boolean',
        default: false,
        readable: true,
        writable: true
      },
      {
        label: 'Unmanaged',
        name: 'isUnmanaged',
        type: 'Boolean',
        // description: 'Is unmanaged',
        readable: true,
        writable: true,
        default: false,
        dependencies: ['name', 'deletedProperties', 'deletedFeeds', 'deletedTypes', 'allowConnections', 'feedDefinition', 'properties', 'objectTypes', 'hasETag'],
        validators: [{
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value, callback) {

              if (value === false) {
                return callback(null, true)
              }

              async.series([

                // only custom object can be unmanaged
                callback => callback(
                  !isCustomName(this.name) &&
                  Fault.create('cortex.accessDenied.unspecified', { reason: 'Only custom objects can be unmanaged' })
                ),

                // nothing allowed in the reaping pipeline.
                callback => callback(
                  (this.deletedProperties.length || this.deletedFeeds.length || this.deletedTypes.length) &&
                  Fault.create('cortex.accessDenied.unspecified', { reason: 'One or more properties, feeds, or types are still in the process of being removed.' })
                ),

                // no ETag generation
                callback => callback(
                  this.hasETag &&
                  Fault.create('cortex.accessDenied.unspecified', { reason: 'Unmanaged objects cannot generate an ETag because they have no built-in updated property.' })
                ),

                // no auditing
                callback => callback(
                  (this.auditing.enabled || this.auditing.all) &&
                  Fault.create('cortex.accessDenied.unspecified', { reason: 'Unmanaged objects cannot have auditing enabled.' })
                ),

                // no connections or existing connections
                callback => callback(
                  this.allowConnections &&
                  Fault.create('cortex.accessDenied.unspecified', { reason: 'Connections cannot exist on unmanaged objects because instance-level access control is disabled.' })
                ),
                callback => modules.db.models.connection.collection.countDocuments({ org: this.org, 'context.object': this.name }, { limit: 1 }, (err, count) => callback(
                  err || (count && Fault.create('cortex.accessDenied.unspecified', { reason: 'Existing connections are preventing the change.' }))
                )),

                // no dependent cascade delete properties.
                callback => modules.db.models.object.getRemoteCascadeDeleteProperties(this.org, this.name, (err, properties) => callback(
                  err || (properties.length && Fault.create('cortex.accessDenied.unspecified', { reason: 'Existing cascadeDelete dependencies cannot exist.' }))
                )),

                // no feeds
                callback => callback(
                  this.feedDefinition.length &&
                  Fault.create('cortex.accessDenied.unspecified', { reason: 'An unmanaged object cannot include feed definitions.' })
                ),

                // no typed objects
                callback => callback(
                  this.objectTypes.length &&
                  Fault.create('cortex.accessDenied.unspecified', { reason: 'An unmanaged object cannot be typed.' })
                ),

                // no triggers
                callback => modules.db.models.script.collection.countDocuments({ org: this.org, reap: false, object: 'script', type: 'trigger', 'configuration.object': this.name }, { limit: 1 }, (err, count) => callback(
                  err || (count && Fault.create('cortex.accessDenied.unspecified', { reason: 'Triggers cannot exist cannot exist for unmanaged objects.' }))
                )),

                // no properties of types that interfere with un-managed reading/writing/reaping optimizations
                callback => {

                  let err = null, prohibited = ['File', 'Reference', 'List', 'Set', 'Geometry']
                  this.schema.node.walkPropertySet(this.properties, prop => {
                    if (prohibited.includes(prop.type)) {
                      err = Fault.create('cortex.accessDenied.unspecified', { reason: `Unmanaged objects cannot contain any ${prop.type} properties.` })
                      return false
                    } else if (prop.auditable) {
                      err = Fault.create('cortex.accessDenied.unspecified', { reason: `Unmanaged objects cannot contain any auditable properties.` })
                      return false
                    } else if (prop.history) {
                      err = Fault.create('cortex.accessDenied.unspecified', { reason: `Unmanaged objects cannot contain any property history.` })
                      return false
                    }
                  })
                  callback(err)
                }

              ], err => callback(err, !err)
              )
            }
          }
        }]
      },
      {
        label: 'Auditing',
        name: 'auditing',
        type: 'Document',
        array: false,
        writable: true,
        properties: [
          {
            // enable auditing on object instance-level events (create, update (including properties), delete).
            label: 'Enabled',
            name: 'enabled',
            type: 'Boolean',
            default: false,
            writable: true
          },
          {
            // all properties are audited when create update delete are audited.
            label: 'All',
            name: 'all',
            type: 'Boolean',
            default: false
          },
          {
            // the audit category (and property default category) under which events for instances and property updates are generated.
            label: 'Category',
            name: 'category',
            type: 'String',
            default: 'user'
          }
        ]
      },
      {
        label: 'Reporting',
        name: 'reporting',
        type: 'Document',
        writable: true,
        properties: [
          {
            label: 'Enabled',
            name: 'enabled',
            type: 'Boolean',
            writable: true,
            default: false
          },
          {
            label: 'Transformation',
            name: 'pipeline',
            type: 'Expression',
            pipeline: true,
            writable: true,
            removable: true
          }
        ]
      },
      {
        label: 'Dataset Location',
        name: 'dataset',
        type: 'Document',
        readAccess: acl.AccessLevels.System,
        properties: [
          {
            label: 'Collection', // the current object collection for live data.
            name: 'collection',
            type: 'String',
            default: 'contexts'
          },
          {
            label: 'Target Collection', // if set, migration is running.
            name: 'targetCollection',
            type: 'String'
          },
          {
            label: 'Old Collection', // if set, migration is in clean up phase.
            name: 'oldCollection',
            type: 'String'
          },
          {
            label: 'Priority', // order in which the migrator will pick up migration requests (lower == first)
            name: 'priority',
            type: 'Number'
          },
          {
            label: 'Migration', // current migration.
            name: 'migration',
            type: 'ObjectId'
          },
          {
            label: 'Last Migration', // previous migration (for looking up errors)
            name: 'lastMigration',
            type: 'ObjectId'
          },
          {
            label: 'Cancelling', // current migration has been cancelled and is cleaning up.
            name: 'cancelling',
            type: 'Boolean'
          },
          {
            label: 'Start Id', // the starting id. use this instead of a match when going by _id.
            name: 'startId',
            type: 'ObjectId'
          },
          {
            label: 'Last Id', // last id successfully moved.
            name: 'lastId',
            type: 'ObjectId'
          },
          {
            label: 'Count', // number of documents moved in this migration.
            name: 'count',
            type: 'Number',
            default: 0
          },
          {
            label: 'Last update', // last update in any migration.
            name: 'updated',
            type: 'Date'
          },
          {
            label: 'Log',
            name: 'log',
            type: 'Document',
            array: true,
            properties: [{
              label: 'Migration',
              name: 'migration',
              type: 'ObjectId'
            }, {
              label: 'Entry',
              name: 'entry',
              type: 'Any',
              serializeData: false
            }]
          },
          {
            label: 'Options', // runtime migration options
            name: 'options',
            type: 'Any',
            serializeData: false
          },
          {
            label: 'Has Write Errors', // if there were write errors that need reconciling
            name: 'hasWriteErrors',
            type: 'Boolean'
          }
        ]
      },
      new ObjectSlotsDefinition({
        label: 'Index Slots',
        name: 'slots',
        dependencies: ['properties', 'objectTypes.properties']
      }),
      new PropertySetDefinition({
        // description: 'Properties defined for a custom object or extension',
        allowSets: true,
        label: 'Properties',
        name: 'properties',
        slots: 'slots',
        maxItems: 100,
        dependencies: ['deletedProperties']
      }),
      new AclDefinition({
        label: 'Default Acl',
        name: 'defaultAcl',
        type: 'Document',
        // description: 'All contexts objects of this type will have this acl merged with their instance acl.',
        readable: true,
        writable: true,
        array: true,
        maxItems: 20,
        canPush: true,
        canPull: true,
        includeId: true,
        withExpressions: true
      }),
      new AclDefinition({
        label: 'Create Acl',
        name: 'createAcl',
        type: 'Document',
        // description: 'These Acl targets are able to create context objects of this type.',
        readable: true,
        writable: true,
        array: true,
        maxItems: 20,
        canPush: true,
        canPull: true,
        includeId: true,
        forCreate: true,
        withExpressions: true
      }),
      {
        label: 'Generate ETag',
        name: 'hasETag',
        type: 'Boolean',
        readable: true,
        writable: true,
        default: false
      },
      {
        label: 'Versioned',
        name: 'isVersioned',
        type: 'Boolean',
        readable: true,
        writable: true,
        default: false,
        dependencies: ['name'],
        validators: [{
          name: 'adhoc',
          definition: {
            code: 'cortex.accessDenied.unspecified',
            message: 'Only custom objects can be versioned.',
            validator: function(ac, node, value) {
              return value === false || isCustomName(this.name)
            }
          }
        }]
      },
      {
        label: 'Has Owner',
        name: 'hasOwner',
        type: 'Boolean',
        readable: true,
        writable: true,
        default: true,
        dependencies: ['name'],
        validators: [{
          name: 'adhoc',
          definition: {
            code: 'cortex.accessDenied.unspecified',
            message: 'Only custom objects can have hasOwner set to false.',
            validator: function(ac, node, value) {
              return value === true || isCustomName(this.name)
            }
          }
        }]
      },
      {
        label: 'Validate Owner',
        name: 'validateOwner',
        type: 'Boolean',
        readable: true,
        writable: true,
        default: true,
        dependencies: ['name'],
        validators: [{
          name: 'adhoc',
          definition: {
            code: 'cortex.accessDenied.unspecified',
            message: 'Only custom objects can have validateOwner set to false.',
            validator: function(ac, node, value) {
              return value === true || isCustomName(this.name)
            }
          }
        }]
      },
      new AclDefinition({
        label: 'Share Acl',
        name: 'shareAcl',
        type: 'Document',
        readable: true,
        writable: true,
        array: true,
        maxItems: 20,
        canPush: true,
        canPull: true,
        includeId: true,
        forShare: true,
        validators: [{
          name: 'adhoc',
          definition: {
            code: 'cortex.accessDenied.unspecified',
            message: 'A share acl cannot be applied to this object.',
            validator: function(ac, node, values) {
              const name = String(modules.db.getRootDocument(this).name)
              if (values.length && name.indexOf('c_') !== 0 && !~name.indexOf('__')) {
                const def = modules.db.definitions.getBuiltInObjectDefinition(name, false, true)
                return def && def.shareAclOverride
              }
              return true
            },
            asArray: true
          }
        }]
      }),
      {
        label: 'Share Chain',
        name: 'shareChain',
        type: 'Number',
        // description: 'A caller can create a connection granting any level of access in the share chain, as long as it is less than his own.',
        array: true,
        maxItems: -1,
        maxShift: false,
        canPush: false,
        canPull: false,
        readable: true,
        writable: true,
        writeOnCreate: true,
        uniqueValues: true,
        dependencies: ['name'],
        export: async function(ac, doc, resourceStream, parentPath, options) {

          const arr = await PropertyDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options)

          if (arr === Undefined) {
            return Undefined
          }

          return arr.map(allow => utils.rString(acl.AccessLevelsLookup[allow], 'unknown').toLowerCase())

        },
        import: async function(ac, doc, resourceStream, parentPath, options) {

          const arr = await PropertyDefinition.prototype.import.call(this, ac, doc, resourceStream, parentPath, options)

          if (arr === Undefined) {
            return Undefined
          }

          return utils.array(arr, arr).map(allow =>
            utils.rInt(
              acl.AccessLevels[capitalize(String(allow).toLowerCase().trim())],
              acl.AccessLevels.None
            )
          )

        },
        writer: function(ac, node, values) {
          values.sort().reverse()
          return values
        },
        validators: [{
          name: 'numberEnum',
          definition: {
            values: [acl.AccessLevels.Public, acl.AccessLevels.Connected, acl.AccessLevels.Read, acl.AccessLevels.Share, acl.AccessLevels.Update]
          }
        }, {
          name: 'adhoc',
          definition: {
            code: 'cortex.accessDenied.unspecified',
            message: 'A share chain cannot be applied to this object.',
            validator: function(ac, node, values) {
              const name = String(modules.db.getRootDocument(this).name)
              if (values.length && name.indexOf('c_') !== 0 && !~name.indexOf('__')) {
                const def = modules.db.definitions.getBuiltInObjectDefinition(name, false, true)
                return def && def.shareChainOverride
              }
              return true
            },
            asArray: true
          }
        }]
      },
      {
        label: 'Allow Connections',
        name: 'allowConnections',
        type: 'Boolean',
        // description: 'Set to enable/disable sharing of contexts for this object.',
        readable: true,
        writable: true,
        default: true
      },
      {
        label: 'Connection Options',
        name: 'connectionOptions',
        // description: 'connection options.',
        type: 'Document',
        writable: true,
        properties: [
          {
            // description: 'require acceptance. if false, auto-connections can be made. requiredAccess and sendConnectionNotification apply.',
            label: 'Require Accept',
            name: 'requireAccept',
            type: 'Boolean',
            default: true,
            stub: true,
            writable: true
          },
          {
            // description: 'The access required by the calling principal on the referenced connectee in order to create an auto-connection.',
            label: 'Required Access',
            name: 'requiredAccess',
            type: 'Number',
            readable: true,
            writable: true,
            default: acl.AccessLevels.Share,
            stub: acl.AccessLevels.Share,
            validators: [{
              name: 'numberEnum',
              definition: {
                values: [acl.AccessLevels.Share, acl.AccessLevels.Update, acl.AccessLevels.Delete]
              }
            }]
          },
          {
            // description: 'trigger email notification for auto connections. Applies only for connections that are auto.',
            label: 'Send Notification',
            name: 'sendNotifications',
            type: 'Boolean',
            default: true,
            stub: true,
            writable: true
          }
        ]
      },
      {
        label: 'Deleted Types Holder',
        name: 'deletedTypes',
        array: true,
        type: 'Document',
        readable: false,
        properties: [
          {
            label: 'Identifier',
            name: '_id',
            type: 'ObjectId'
          },
          {
            label: 'Name',
            name: 'name',
            type: 'String'
          }
        ]
      },
      {
        label: 'Deleted Feeds Holder',
        name: 'deletedFeeds',
        array: true,
        type: 'Document',
        readable: false,
        properties: [
          {
            label: 'Identifier',
            name: '_id',
            type: 'ObjectId'
          },
          {
            label: 'Name',
            name: 'name',
            type: 'String'
          }
        ]
      },
      {
        label: 'Schema Cache',
        name: 'schemaCache',
        type: 'String',
        readable: false,
        select: false
      },
      {
        label: 'Deleted Properties Holder',
        name: 'deletedProperties',
        array: true,
        type: 'Document',
        readable: true,
        export: false,
        properties: [
          {
            label: 'Property Identifier', // use for easy media reaping
            name: '_id',
            type: 'ObjectId'
          },
          {
            label: 'Object Path', // the path into the Object (eg. FeedDefinition.XXX.body.XXX.properties.XXX)
            name: 'op',
            type: 'String'
          },
          {
            label: 'Instance Path', // the simple path for an instance (eg. body.c_foo)
            name: 'ip',
            type: 'String'
          },
          {
            label: 'Full Qualified Instance Path', // full path. post#c_my_post.body#c_my_segment.c_foo
            name: 'fq',
            type: 'String'
          },
          {
            label: 'Is File', // true if the property is a file.
            name: 'file',
            type: 'Boolean'
          },
          {
            label: 'Is Localized', // true if the property was localized.
            name: 'localized',
            type: 'Boolean'
          }
        ]
      },
      {
        label: 'Object Types',
        name: 'objectTypes',
        type: 'Document',
        // description: 'The object\'s types.',
        array: true,
        maxItems: 50,
        canPush: true,
        canPull: true,
        uniqueKey: 'name',
        dependencies: ['deletedTypes', 'deletedProperties'],
        properties: [
          {
            // description: 'The object type identifier.',
            label: 'Object Type Identifier',
            name: '_id',
            auto: true,
            type: 'ObjectId',
            readable: true
          },
          {
            // description: 'The object type label.',
            label: 'Label',
            name: 'label',
            type: 'String',
            readable: true,
            writable: true,
            stub: '',
            validators: [{
              name: 'required'
            }, {
              name: 'string',
              definition: { min: 1, max: 100 }
            }],
            localization: {
              enabled: true,
              strict: false,
              fallback: true
            }
          },
          {
            label: 'Deployment Identifiers',
            name: 'did',
            type: 'ObjectId',
            readable: false,
            array: true
          },
          {
            label: 'Type Name',
            name: 'name',
            type: 'String',
            // description: 'The type name.',
            readable: true,
            writable: true,
            dependencies: ['..deletedTypes'],
            validators: [{
              name: 'required'
            }, {
              name: 'customName'
            }, {
              name: 'uniqueInArray'
            }, {
              name: 'adhoc',
              definition: {
                message: 'This type name is not available for use.',
                validator: function(ac, node, value) {
                  return !~utils.array(this.parent().deletedTypes).map(t => t.name).indexOf(value)
                }
              }
            }],
            writer: function(ac, node, v) {
              return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(v))
            }
          },
          new PropertySetDefinition({
            allowSets: true,
            label: 'Type Properties',
            slots: 'slots', // use top level object slots.
            name: 'properties',
            maxItems: 20,
            dependencies: ['properties.name'],
            validators: [{
              name: 'adhoc',
              definition: {
                code: 'cortex.conflict.exists',
                message: 'A base property of the same name already exists; An object type property cannot overwrite a shared base property.',
                validator: function(ac, node, value) {
                  // cannot overwrite base properties.
                  return !~modules.db.getRootDocument(this).properties.map(p => p.name).indexOf(this.name)
                }
              }
            }]
          })
        ],
        onRemovingValue: function(ac, node, value, index) {
          let deletedTypes = this.deletedTypes || (this.deletedTypes = [])
          deletedTypes.push({ _id: value._id, name: value.name })
          ac.hook('save').after(function(vars) {
            modules.workers.runNow('instance-reaper')
          }, 'reap-object-types', true)
        },
        puller: function(ac, node, value) {
          const type = utils.findIdInArray(utils.path(this, node.fullpath), '_id', value)
          if (type) {
            ac.hook('save').before(function(vars, callback) {
              if (~vars.modified.indexOf(node.fullpath)) {
                if (!~utils.array(utils.path(ac.subject, node.fullpath)).indexOf(value)) {
                  ac.object.fireHook('type.removed.before', null, { ac: ac, type: type }, callback)
                }
              }
            })
            ac.hook('save').after(function(vars) {
              if (~vars.modified.indexOf(node.fullpath)) {
                if (!~utils.array(utils.path(ac.subject, node.fullpath)).indexOf(value)) {
                  ac.object.fireHook('type.removed.after', null, { ac: ac, type: type }, () => {})
                }
              }
            })
          }
          return value
        },
        validators: [{
          name: 'adhoc',
          definition: {
            message: 'Built-in objects cannot be typed.',
            validator: function(ac, node, value) {
              return this.name.indexOf('c_') === 0 || ~this.name.indexOf('__')
            }
          }
        }]
      },
      new PostTypeDefinition()
    ]
  }

}

// shared methods --------------------------------------------------------

ObjectDefinition.methods = {

}

// shared statics --------------------------------------------------------

ObjectDefinition.statics = {

  aclInit: function() {

    // reference property source object
    modules.db.models.Object.hook('delete').before((vars, callback) => {

      const objectName = vars.ac.subject.name

      if (~Object.keys(modules.db.definitions.builtInObjectDefsMap).indexOf(objectName)) {
        const subject = vars.ac.subject,
              check = ['deletedProperties', 'deletedFeeds', 'deletedTypes', 'objectTypes', 'properties', 'feedDefinition']

        if (check.some(v => subject[v].length)) {
          return callback(Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), reason: 'Built-in object definitions cannot be deleted unless all properties, types and feeds have first been deleted and reaped.' }))
        }
      }
      if (config('debug.skipInUseTriggers')) {
        return callback()
      }
      if (vars.ac.subject.dataset.targetCollection) {
        return callback(Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), reason: 'Objects in migration cannot be deleted (1).' }))
      }
      if (vars.ac.subject.dataset.oldCollection) {
        return callback(Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), reason: 'Objects in migration cannot be deleted (2).' }))
      }
      if (vars.ac.subject.dataset.hasWriteErrors) {
        return callback(Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), reason: 'Clear migration errors before deleting the object.' }))
      }

      let find = {
        org: vars.ac.orgId,
        object: 'object',
        reap: false,
        $or: [
          { 'properties': { $elemMatch: { type: { $in: ['ObjectId', 'Reference', 'List'] }, sourceObject: objectName } } },
          { 'properties.properties': { $elemMatch: { type: { $in: ['ObjectId', 'Reference', 'List'] }, sourceObject: objectName } } },
          { 'objectTypes.properties': { $elemMatch: { type: { $in: ['ObjectId', 'Reference', 'List'] }, sourceObject: objectName } } },
          { 'objectTypes.properties.properties': { $elemMatch: { type: { $in: ['ObjectId', 'Reference', 'List'] }, sourceObject: objectName } } },
          { 'feedDefinition.body.properties': { $elemMatch: { type: { $in: ['ObjectId', 'Reference', 'List'] }, sourceObject: objectName } } },
          { 'feedDefinition.body.properties.properties': { $elemMatch: { type: { $in: ['ObjectId', 'Reference', 'List'] }, sourceObject: objectName } } },
          { 'feedDefinition.comments.properties': { $elemMatch: { type: { $in: ['ObjectId', 'Reference', 'List'] }, sourceObject: objectName } } },
          { 'feedDefinition.comments.properties.properties': { $elemMatch: { type: { $in: ['ObjectId', 'Reference', 'List'] }, sourceObject: objectName } } }
        ]
      }

      this.find(find).select('id label').lean().exec((err, docs) => {
        if (!err && docs.length > 0) {
          err = Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), path: objectName, reason: 'This object is in use by reference/list properties in the following objects: ' + docs.map(doc => doc.label) })
        }
        callback(err)
      })
    })

    modules.db.models.Object.hook('property.removed').before((vars, callback) => {

      if (vars.ac.subject.dataset.targetCollection) {
        return callback(Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), reason: 'Properties belonging to objects in migration cannot be deleted (1).' }))
      }
      if (vars.ac.subject.dataset.oldCollection) {
        return callback(Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), reason: 'Properties belonging to objects in migration cannot be deleted (2).' }))
      }

      const property = vars.property || {},
            { name, parent } = property || {},
            { uniqueKey } = (_.isFunction(parent) && property.parent()) || {}

      if (uniqueKey && uniqueKey === name) {
        return callback(Fault.create(
          'cortex.accessDenied.unspecified',
          { path: vars.instancePath, reason: 'This property is in use as the unique key.' })
        )
      }

      callback()

    })

    // reference property expansion paths.
    modules.db.models.Object.hook('property.removed').before((vars, callback) => {

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      const objectName = vars.ac.subject.name,
            regEx = new RegExp('^' + vars.instancePath.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')),
            find = {
              org: vars.ac.orgId,
              object: 'object',
              reap: false,
              $or: [
                { 'properties': { $elemMatch: { type: 'Reference', sourceObject: objectName, paths: regEx } } },
                { 'properties.properties': { $elemMatch: { type: 'Reference', sourceObject: objectName, paths: regEx } } },
                { 'objectTypes.properties': { $elemMatch: { type: 'Reference', sourceObject: objectName, paths: regEx } } },
                { 'objectTypes.properties.properties': { $elemMatch: { type: 'Reference', sourceObject: objectName, paths: regEx } } },
                { 'feedDefinition.body.properties': { $elemMatch: { type: 'Reference', sourceObject: objectName, paths: regEx } } },
                { 'feedDefinition.body.properties.properties': { $elemMatch: { type: 'Reference', sourceObject: objectName, paths: regEx } } },
                { 'feedDefinition.comments.properties': { $elemMatch: { type: 'Reference', sourceObject: objectName, paths: regEx } } },
                { 'feedDefinition.comments.properties.properties': { $elemMatch: { type: 'Reference', sourceObject: objectName, paths: regEx } } }
              ]
            }

      this.find(find).select('id label').lean().exec((err, docs) => {
        if (!err && docs.length > 0) {
          err = Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), path: vars.instancePath, reason: 'This property is in use by reference expansion paths in the following object(s): ' + docs.map(doc => doc.label) })
        }
        callback(err)
      })
    })

    // properties in use in list definition variables or linked properties
    modules.db.models.Object.hook('property.removed').before((vars, callback) => {

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      const objectName = vars.ac.subject.name,
            regEx = new RegExp('^' + vars.instancePath.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')),
            listMatch = {
              $elemMatch: {
                type: 'List',
                sourceObject: objectName,
                $or: [{ 'variables.name': regEx }, { linkedProperty: regEx }, { 'linkedReferences.source': regEx }, { 'linkedReferences.target': regEx }]
              }
            },
            find = {
              org: vars.ac.orgId,
              object: 'object',
              reap: false,
              $or: [
                { 'properties': listMatch },
                { 'properties.properties': listMatch },
                { 'objectTypes.properties': listMatch },
                { 'objectTypes.properties.properties': listMatch },
                { 'feedDefinition.body.properties': listMatch },
                { 'feedDefinition.body.properties.properties': listMatch },
                { 'feedDefinition.comments.properties': listMatch },
                { 'feedDefinition.comments.properties.properties': listMatch }
              ]
            }

      this.find(find).select('id label').lean().exec((err, docs) => {
        if (!err && docs.length > 0) {
          err = Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), path: vars.ac.subject.name + '.' + vars.instancePath, reason: 'This property is in use in list variables or as a linked property in the following object(s): ' + docs.map(doc => doc.label) })
        }
        callback(err)
      })
    })

    // roles used in default acl of either the object or it's properties. (+ pacl/ grant roles for references) + createAcl/defaultAcl for lists
    modules.db.models.Org.hook('role.removed').before((vars, callback) => {

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      const $or = [

              // roles
              ...[
                'properties.roles',
                'properties.properties.roles',
                'objectTypes.properties.roles',
                'objectTypes.properties.properties.roles',
                'feedDefinition.body.properties.roles',
                'feedDefinition.body.properties.properties.roles',
                'feedDefinition.comments.properties.roles',
                'feedDefinition.comments.properties.properties.roles'
              ].map(key => ({ [key]: vars.roleId })),

              // acl structures with possible target and allow roles.
              ...[
                'defaultAcl',
                'createAcl',
                'shareAcl',
                'feedDefinition.contextReadAcl',
                'feedDefinition.postCreateAcl',
                'feedDefinition.postInstanceAcl',
                'properties.acl',
                'properties.localization.acl',
                'properties.pacl',
                'properties.properties.acl',
                'properties.properties.localization.acl',
                'properties.properties.pacl',
                'objectTypes.properties.acl',
                'objectTypes.properties.localization.acl',
                'objectTypes.properties.pacl',
                'objectTypes.properties.properties.acl',
                'objectTypes.properties.properties.localization.acl',
                'objectTypes.properties.properties.pacl',
                'feedDefinition.body.properties.acl',
                'feedDefinition.body.properties.localization.acl',
                'feedDefinition.body.properties.pacl',
                'feedDefinition.body.properties.properties.acl',
                'feedDefinition.body.properties.properties.localization.acl',
                'feedDefinition.body.properties.properties.pacl',
                'feedDefinition.comments.properties.acl',
                'feedDefinition.comments.properties.localization.acl',
                'feedDefinition.comments.properties.pacl',
                'feedDefinition.comments.properties.properties.acl',
                'feedDefinition.comments.properties.properties.localization.acl',
                'feedDefinition.comments.properties.properties.pacl',
                'properties.defaultAcl',
                'properties.createAcl',
                'properties.properties.defaultAcl',
                'properties.properties.createAcl',
                'objectTypes.properties.defaultAcl',
                'objectTypes.properties.createAcl',
                'objectTypes.properties.properties.defaultAcl',
                'objectTypes.properties.properties.createAcl',
                'feedDefinition.body.properties.defaultAcl',
                'feedDefinition.body.properties.createAcl',
                'feedDefinition.body.properties.properties.defaultAcl',
                'feedDefinition.body.properties.properties.createAcl',
                'feedDefinition.comments.properties.defaultAcl',
                'feedDefinition.comments.properties.createAcl',
                'feedDefinition.comments.properties.properties.defaultAcl',
                'feedDefinition.comments.properties.properties.createAcl'
              ].reduce(($or, prefix) => {
                $or.push({ [`${prefix}.target`]: vars.roleId })
                $or.push({ [`${prefix}.allow`]: vars.roleId })
                return $or
              }, [])

            ],
            find = {
              org: vars.ac.orgId,
              object: 'object',
              reap: false,
              $or
            }

      this.collection.find(find).project({ _id: 1, name: 1 }).toArray((err, docs) => {
        if (!err && docs.length > 0) {
          err = Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), path: vars.roleId, reason: 'This role is in use in the acls of the following objects(s): ' + docs.map(doc => doc.name) })
        }
        callback(err)
      })

    })

  },

  /**
   * Get a list of properties in other objects the have cascadeDelete properties sourced to the passed in objectName
   * @param orgId
   * @param objectName
   * @param callback -> err, {propertyId, objectId, propertyName, slotName, uniqueSlot}
   *
   */
  getRemoteCascadeDeleteProperties: function(orgId, objectName, callback) {

    let builtin = []

    // built-in objects may have cascade delete sources on other built-ins
    if (!isCustomName(objectName)) {

      if (!builtInCascadeDeleteProperties.has(objectName)) {
        for (let name of consts.NativeNamesArray) {
          try {

            const root = modules.db.models[name].schema.node,
                  sets = [Object.values(root.properties), ...Object.values(root.types || {}).map(type => Object.values(type.properties || {}))]

            sets.reduce((builtin, properties) => {

              return properties.reduce((builtin, property) => {

                const { _id, cascadeDelete, indexSlot, array, sourceObject, name } = property

                if (cascadeDelete &&
                  indexSlot &&
                  _id &&
                  !array &&
                    sourceObject === objectName &&
                    ['Reference', 'ObjectId'].includes(property.getTypeName())) {

                  builtin.push({ propertyId: _id, objectId: root.objectId, propertyName: name, slotName: indexSlot.name, uniqueSlot: indexSlot.unique })
                }
                return builtin
              }, builtin)

            }, builtin)

          } catch (err) {
            logger.error('error occured collecting builtin cascade delete properties', Fault.from(err, false, true).toJSON())
          }
        }
        builtInCascadeDeleteProperties.set(objectName, builtin)
      } else {
        builtin = builtInCascadeDeleteProperties.get(objectName)
      }

    }

    this.collection.aggregate([
      { $match: { org: orgId, reap: false, properties: { $elemMatch: { type: { $in: ['Reference', 'ObjectId'] }, cascadeDelete: true, sourceObject: objectName, array: { $ne: true } } } } },
      { $unwind: '$properties' },
      { $match: { 'properties.type': { $in: ['Reference', 'ObjectId'] }, 'properties.cascadeDelete': true, 'properties.sourceObject': objectName } },
      { $unwind: '$slots' },
      { $project: { propertyId: '$properties._id', objectId: '$lookup', propertyName: '$properties.name', slotName: '$slots.name', uniqueSlot: '$slots.unique', slotsMatch: { $cmp: ['$properties._id', '$slots._id'] } } },
      { $match: { slotsMatch: 0 } },
      { $project: { propertyId: 1, objectId: 1, propertyName: 1, slotName: 1, uniqueSlot: 1 } }
    ], { cursor: {} }).toArray((err, props) => {

      callback(err, [...toArray(props), ...builtin])

    })

  }

}

// indexes ---------------------------------------------------------------

ObjectDefinition.indexes = [
  // registered object codes must be unique in each org to avoid api lookup collisions.
  [{ org: 1, name: 1 }, { unique: true, name: 'idxUniqueObjectNames' }],
  [{ org: 1, pluralName: 1 }, { unique: true, name: 'idxUniquePluralNames' }]
]

// shared hooks  ---------------------------------------------------------

ObjectDefinition.apiHooks = [{
  name: 'create',
  before: function(vars, callback) {

    // extensions use the native lookup, and custom the object _id
    let subject = vars.ac.subject
    if (String(subject.name).indexOf('c_') !== 0 && !~String(subject.name).indexOf('__')) {
      // make sure the code matches an existing object.
      let def = modules.db.definitions.getBuiltInObjectDefinition(subject.name, false, true)
      if (!def) {
        callback(Fault.validationError('cortex.invalidArgument.unspecified', { resource: vars.ac.getResource(), path: 'name', reason: 'Missing or invalid object name ("' + (subject.name || null) + '").' }))
        return
      }
      subject.lookup = def._id
    } else {
      subject.lookup = subject._id
      subject.dataset.collection = vars.ac.org.configuration.defaultCollection || 'contexts'
    }

    modules.schemas.generateSchema(vars.ac.org, vars.ac.subject, (err, schema) => {
      if (!err) {
        vars.ac.subject.schemaCache = schema
      }
      callback(err)
    })

  },
  after: function(vars, callback) {
    vars.ac.org.syncObjects(err => {
      void err
      vars.ac.org.constructor.loadOrg(vars.ac.org.code, (err, document) => {
        if (!err && document) {
          vars.ac.updateOrg(document)
        }
        if (config('__is_mocha_test__')) {
          require('../../../../../test/lib/server').updateOrg(callback)
        } else {
          callback()
        }
      })
    })
  }
}, {
  name: 'update',
  before: function(vars, callback) {

    // never allow updating objects while there is a migration in-progress
    if (vars.ac.subject.dataset && vars.ac.subject.dataset.targetCollection) {
      return callback(Fault.validationError('cortex.invalidArgument.unspecified', { resource: vars.ac.getResource(), reason: 'Cannot update while a migration is in progress.' }))
    }

    // always request a sequence increment to ensure the cache is dirty
    vars.ac.subject.increment()

    modules.schemas.generateSchema(vars.ac.org, vars.ac.subject, (err, schema) => {
      if (!err) {
        vars.ac.subject.schemaCache = schema
      }
      callback(err)
    })

  },
  after: function(vars, callback) {
    vars.ac.org.syncObjects(callback)
  }
}, {
  name: 'delete',
  after: function(vars, callback) {
    vars.ac.org.syncObjects(callback)
  }
}]

ObjectDefinition.prototype.export = async function(ac, doc, resourceStream, parentResource, options) {

  options = options || {}

  const resourcePath = `object.${doc.name}`,
        omittedPaths = ['feedDefinition', 'acl'],
        propertyIncludes = options.required !== true // if required, always include all properties (assume it's a dependency)

  if (!resourceStream.addPath(resourcePath, parentResource, options)) {
    return Undefined
  }

  // exclude anything that can't be modified.
  if (consts.NativeIds[doc.name]) {

    const model = modules.db.models[doc.name]

    if (!(model.defaultAclOverride || model.defaultAclExtend)) {
      omittedPaths.push('defaultAcl')
    }
    if (!(model.createAclOverwrite || model.createAclExtend)) {
      omittedPaths.push('createAcl')
    }
    if (!model.shareChainOverride) {
      omittedPaths.push('shareChain')
    }
    if (!model.shareAclOverride) {
      omittedPaths.push('shareAcl')
    }
    if (!model.allowConnectionsOverride) {
      omittedPaths.push('allowConnections')
    }
    if (!model.allowConnectionOptionsOverride) {
      omittedPaths.push('connectionOptions')
    }
  }
  // remove locales from exports in object definitions if they are not localized
  if (!doc.localized || doc.useBundles) {
    omittedPaths.push('locales')
  }

  let object = await DocumentDefinition.prototype.export.call(this, ac, _.omit(doc, ...omittedPaths), resourceStream, resourcePath, { ...options, propertyIncludes })

  if (object !== Undefined) {

    object.object = 'object'

    await resourceStream.exportResource(utils.sortKeys(_.omit(
      object,
      ...omittedPaths
    )), resourcePath)
  }

  return object

}

ObjectDefinition.prototype.import = async function(ac, value, resourceStream, parentResource, options) {

  if (!isPlainObject(value)) {
    return Undefined
  }

  const objectName = singularize(rString(pathTo(value, 'name'), '')),
        omittedPaths = ['feedDefinition', 'uniqueKey'],
        objectModel = modules.db.models.object

  if (consts.NativeIds[objectName]) {
    const model = modules.db.models[objectName]
    if (!(model.defaultAclOverride || model.defaultAclExtend)) {
      omittedPaths.push('defaultAcl')
    }
    if (!(model.createAclOverwrite || model.createAclExtend)) {
      omittedPaths.push('createAcl')
    }
    if (!model.shareChainOverride) {
      omittedPaths.push('shareChain')
    }
    if (!model.shareAclOverride) {
      omittedPaths.push('shareAcl')
    }
    if (!model.allowConnectionsOverride) {
      omittedPaths.push('allowConnections')
    }
    if (!model.allowConnectionOptionsOverride) {
      omittedPaths.push('connectionOptions')
    }
  }

  // defer uniqueKey, properties and objectTypes. take care not to edit the original
  let input = _.omit(value, omittedPaths),
      resourcePath = `object.${input && input.name}`,
      def

  delete input.properties
  delete input.locales // process them later
  if (Array.isArray(value.objectTypes)) {
    delete input.objectTypes
    const objectTypes = []
    for (const objectType of value.objectTypes) {
      objectTypes.push(_.omit(objectType, 'properties'))
    }
    if (objectTypes.length) {
      input.objectTypes = objectTypes
    }
  }

  def = await DocumentDefinition.prototype.import.call(this, ac, input, resourceStream, parentResource, { ...options, nodePath: resourcePath })

  if (def === Undefined || !resourceStream.addPath(resourcePath, parentResource, options)) {

    return Undefined

  } else {

    let subjectId,
        subject = await promised(
          objectModel,
          'aclReadOne',
          ac.principal,
          null,
          { req: ac.req, script: ac.script, allowNullSubject: true, throwNotFound: false, internalWhere: { name: def.name }, paths: ['_id', 'name'] }
        ),
        writeOptions = {
          passive: true,
          method: subject ? 'put' : 'post',
          mergeDocuments: true,
          req: ac.req,
          script: ac.script,
          disableTriggers: resourceStream.disableTriggers
        }

    if (subject) {
      def._id = subject._id
      subject = (await promised(objectModel, 'aclUpdate', ac.principal, subject._id, def, writeOptions)).ac.subject
    } else {
      subject = (await promised(objectModel, 'aclCreate', ac.principal, def, writeOptions)).ac.subject
    }

    subjectId = subject._id

    // defer property writes until after all objects have been written.
    // don't keep the resource in memory, we might have a lot of objects.
    resourceStream.deferResource(resourcePath, async(ac, resourcePath) => {

      const resource = await resourceStream.cache.getResource(resourcePath),
            { doc: value } = resource,
            input = _.pick(value, 'uniqueKey', 'name', 'type', 'properties', 'locales'),
            objectModel = modules.db.models.object,
            deferred = {},
            updateOptions = {
              req: ac.req,
              script: ac.script,
              mergeDocuments: true,
              disableTriggers: resourceStream.disableTriggers,
              passive: true,
              method: 'put',

              writer: async(objectAc, payload, callback) => {

                // intercept the validator
                objectAc.hook('validate').before(({ ac }, callback) => {
                  resourceStream.log('import.validation.begin', { resource: `${resourcePath}` })
                  callback()
                })
                objectAc.hook('validate').after(({ ac }, callback) => {
                  resourceStream.log('import.validation.success', { resource: `${resourcePath}` })
                  callback()
                })
                objectAc.hook('validate').fail((err, { ac }, callback) => {
                  resourceStream.log('import.validation.failed', { resource: `${resourcePath}` })
                  callback(err)
                })

                // defer index updates until after the import has completed
                if (ac.option('$importDeferredIndexUpdates')) {
                  objectAc.hook('save').intercept('after', function(inline, fn, taskId) {
                    if (taskId.indexOf('after.$idxUpdates') === 0) {
                      return function(vars) {
                        ac.option('$importDeferredIndexUpdates').push(fn.bind(this, vars))
                      }
                    }
                    return fn
                  })
                }

                let err

                try {

                  await promised(
                    objectAc.subject,
                    'aclWrite',
                    objectAc,
                    payload,
                    {
                      mergeDocuments: true,
                      onWrite: (ac, node, parentDocument, value) => {
                        const path = String(node.fullpath),
                              key = value.name

                        if (['properties', 'locales.properties', 'objectTypes.properties'].includes(path)) {
                          resourceStream.log('import.property', { resource: `${resourcePath}.${path}.${key}` })
                        }
                      }
                    }
                  )

                } catch (e) {
                  err = e
                }

                callback(err, objectAc)

              }

            }

      // if the object definition is not localized remove locales for importing.
      if (!value.localized || value.useBundles) {
        delete input.locales
      }

      if (Array.isArray(value.objectTypes)) {
        delete input.objectTypes
        const objectTypes = []
        for (const objectType of value.objectTypes) {
          objectTypes.push(_.pick(objectType, 'name', 'properties'))
        }
        if (objectTypes.length) {
          input.objectTypes = objectTypes
        }
      }

      // use a custom writer because we have no ids, so the api does not know what's a put or a post.
      let def = await DocumentDefinition.prototype.import.call(this, ac, input, resourceStream, parentResource, { ...options, nodePath: resourcePath })

      // defer any properties that rely on properties in other objects
      for (let node of jp.nodes(def, "$..properties[?(@.type==='Reference')]")) {

        const { path: nodePath, value: nodeValue } = node,
              { paths } = nodeValue

        if (paths && paths.length) {
          indexPathToPropertyPath(def, nodePath.slice(1), deferred).paths = paths
          delete nodeValue.paths
        }
      }

      for (let node of jp.nodes(def, "$..properties[?(@.type==='List')]")) {
        const { path: nodePath, value: nodeValue } = node,
              { linkedProperty, linkedReferences, where } = nodeValue
        if (linkedProperty) {
          indexPathToPropertyPath(def, nodePath.slice(1), deferred).linkedProperty = linkedProperty
          delete nodeValue.linkedProperty
        }
        if (linkedReferences && linkedReferences.length) {
          indexPathToPropertyPath(def, nodePath.slice(1), deferred).linkedReferences = linkedReferences
          delete nodeValue.linkedReferences
        }
        if (where) {
          indexPathToPropertyPath(def, nodePath.slice(1), deferred).where = where
          delete nodeValue.where
        }
      }

      await promised(
        objectModel,
        'aclUpdate',
        ac.principal,
        subjectId,
        def,
        updateOptions
      )

      if (Object.keys(deferred).length) {
        resourceStream.deferResource(resourcePath, async(ac, resourcePath) => {

          await promised(
            objectModel,
            'aclUpdate',
            ac.principal,
            subjectId,
            deferred,
            updateOptions
          )
          return true

        })
      }

    })

    return {
      _id: subject.lookup, // for cache lookups
      name: subject.name
    }

  }

}

function indexPathToPropertyPath(doc, path, into) {

  return path.reduce(
    ({ doc, into }, prop) => {

      const subDoc = doc[prop]

      if (isInt(prop)) {
        let subInto = into.find(v => v.name === subDoc.name)
        if (!subInto) {
          subInto = {
            name: subDoc.name
          }
          into.push(subInto)
        }
        into = subInto
      } else {
        if (!into[prop]) {
          into[prop] = []
        }
        into = into[prop]
      }

      return { doc: subDoc, into }
    },
    { doc, into }
  ).into

}

// exports --------------------------------------------------------

module.exports = ObjectDefinition
