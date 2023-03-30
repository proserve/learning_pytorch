'use strict'

const acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      util = require('util'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      ObjectSlotsDefinition = require('../object-slots-definition'),
      PropertySetDefinition = require('../property-set-definition'),
      ListDefinition = require('../types/list-definition')

let Undefined

function OODefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(OODefinition, BuiltinContextModelDefinition)

OODefinition.prototype.selectPaths = function(principal, options) {

  // when editing an object, always load everything in order to update the schemaCache

  const selections = BuiltinContextModelDefinition.prototype.selectPaths.call(this, principal, options)
  selections.name = true
  return selections

}

OODefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = OODefinition.statics
  options.methods = OODefinition.methods
  options.indexes = OODefinition.indexes
  options.options = { collection: OODefinition.collection }
  options.apiHooks = OODefinition.apiHooks
  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

OODefinition.collection = 'oo-definitions'

OODefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {

  BuiltinContextModelDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, path, options)

  // always select...
  selections.slots = true
  selections.properties = true
  BuiltinContextModelDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, 'isUnmanaged', options)
  BuiltinContextModelDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, 'objectTypes', options)
}

OODefinition.prototype.getNativeOptions = function() {

  return {
    hasCreator: true,
    hasOwner: true,
    hasImage: false,
    hasETag: false,
    isDeployable: false,
    uniqueKey: 'name',
    allowConnections: false,
    _id: consts.NativeIds.oo,
    objectLabel: 'Output Object',
    objectName: 'oo',
    pluralName: 'oos',
    collection: 'oo-definitions',
    isExtensible: false,
    isFavoritable: false,
    auditing: {
      enabled: false
    },
    defaultAclOverride: false,
    defaultAclExtend: false,
    defaultAcl: [
      { type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }
    ],
    createAclOverwrite: false,
    createAclExtend: false,
    createAcl: [],
    allowBypassCreateAcl: true,
    requiredAclPaths: ['dataset', 'name'],
    properties: [
      {
        // may be edited, but only through a script.
        label: 'Label',
        name: 'label',
        type: 'String',
        writable: true,
        updateAccess: acl.AccessLevels.script,
        validators: [{
          name: 'required'
        }, {
          name: 'string',
          definition: { min: 1, max: 100 }
        }]
      },
      {
        label: 'Name',
        name: 'name',
        type: 'String',
        dependencies: ['org', 'pluralName'],
        readable: true,
        nativeIndex: true,
        creatable: true,
        lowercase: true,
        trim: true,
        writer: function(ac, node, v) {
          v = String(v).trim().toLowerCase()
          if (v.length > 0) {
            if (v.indexOf('o_') !== 0) {
              v = 'o_' + v
            }
          }
          return v
        },
        validators: [{
          name: 'required'
        }, {
          name: 'customName',
          definition: {
            prefix: 'o_',
            allowNs: false
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
        label: 'List Options',
        name: 'listOptions',
        creatable: true,
        type: 'Document',
        properties: ListDefinition.getProperties().filter((prop) =>
          [
            'grant',
            'roles',
            'skipAcl',
            'writeThrough',
            'updateOnWriteThrough',
            'inheritInstanceRoles',
            'implicitCreateAccessLevel',
            'inheritPropertyAccess',
            'defaultAcl',
            'createAcl',
            'hoistList'
          ].includes(prop.name)
        )
      },
      {
        label: 'List',
        name: 'list',
        type: 'List',
        dependencies: ['.name', '.listOptions'],
        linkedReferences: [{
          source: '_id',
          target: 'definition'
        }],

        // source object is fixed to the oo name.
        sourceObject: function() {
          return this.name
        },

        // readThrough is implicit.
        readThrough: true,

        // dynamic options
        grant: function() { return this.listOptions.grant },
        roles: function() { return this.listOptions.roles },
        skipAcl: function() { return this.listOptions.skipAcl },
        writeThrough: function() { return this.listOptions.writeThrough },
        updateOnWriteThrough: function() { return this.listOptions.updateOnWriteThrough },
        inheritInstanceRoles: function() { return this.listOptions.inheritInstanceRoles },
        implicitCreateAccessLevel: function() { return this.listOptions.implicitCreateAccessLevel },
        inheritPropertyAccess: function() { return this.listOptions.inheritPropertyAccess },
        defaultAcl: function() { return this.listOptions.defaultAcl },
        createAcl: function() { return this.listOptions.createAcl },
        hoistList: function() { return this.listOptions.hoistList }
      },
      {
        label: 'Context',
        name: 'context',
        type: 'Reference',
        sourceObject: '',
        creatable: true,
        nativeIndex: true,
        referenceAccess: acl.AccessLevels.None,
        allowObjectWrite: true,
        objectValidators: [{
          name: 'customName'
        }],
        validators: [{
          name: 'required'
        }]
      },
      {
        // expiry may be bumped.
        label: 'Expires At',
        name: 'expiresAt',
        type: 'Date',
        writable: true
      },
      {
        label: 'Cascade Delete',
        name: 'cascadeDelete',
        type: 'Boolean',
        default: true,
        creatable: true
      },
      {
        label: 'Deletable',
        name: 'isDeletable',
        type: 'Boolean',
        default: true,
        readable: false
      },
      {
        label: 'Unmanaged',
        name: 'isUnmanaged',
        type: 'Boolean',
        default: true,
        readable: false
      },
      {
        label: 'Schema Cache',
        name: 'schemaCache',
        type: 'String',
        readable: false,
        select: false
      },
      {
        label: 'Dataset Location',
        name: 'dataset',
        type: 'Document',
        readAccess: acl.AccessLevels.System,
        properties: [
          {
            label: 'Collection',
            name: 'collection',
            type: 'String',
            default: 'oo-data'
          }
        ]
      },
      new ObjectSlotsDefinition({
        label: 'Index Slots',
        name: 'slots',
        dependencies: ['properties']
      }),
      new PropertySetDefinition({
        creatable: true,
        exclude: ['File', 'Reference', 'List', 'Set', 'Geometry'],
        allowSets: false,
        label: 'Properties',
        name: 'properties',
        slots: 'slots',
        maxItems: 100
      })
    ]
  }

}

// shared methods --------------------------------------------------------

OODefinition.methods = {

}

// shared statics --------------------------------------------------------

OODefinition.statics = {

}

// indexes ---------------------------------------------------------------

OODefinition.indexes = [

  [{ org: 1, name: 1 }, { unique: true, name: 'idxUniqueObjectNames' }],

  [{ org: 1, object: 1, type: 1, 'context._id': 1, 'context.object': 1, cascadeDelete: 1 }, { name: 'idxSourceContext' }]

]

// shared hooks  ---------------------------------------------------------

OODefinition.apiHooks = [
  {
    name: 'create',
    before: function({ ac }, callback) {
      modules.schemas.generateSchema(ac.org, ac.subject, (err, schema) => {
        if (!err) {
          ac.subject.schemaCache = schema
        }
        callback(err)
      })
    }
  },
  {
    name: 'update',
    before: function({ ac }, callback) {
      modules.schemas.generateSchema(ac.org, ac.subject, (err, schema) => {
        if (!err) {
          ac.subject.schemaCache = schema
        }
        callback(err)
      })
    }
  },
  {
    name: 'save',
    before: function({ ac }, callback) {

      const { object, subject } = ac

      // last chance to add a property and have it indexed correctly by choosing a slot.
      // this happens after validation so we can do normally impossible things.
      if (subject.isNew) {
        subject.properties.unshift({
          label: 'Object Definition',
          name: 'definition',
          type: 'ObjectId',
          indexed: true,
          readAccess: acl.AccessLevels.Public,
          writeAccess: acl.AccessLevels.System,
          optional: true,
          readable: true,
          writable: false
        })
        object.schema.node.properties.properties.registerIndexUpdate(ac, subject.properties[0])

      }

      callback()
    }
  }
]

OODefinition.prototype.export = async function() {

  return Undefined

}

OODefinition.prototype.import = async function() {

  return Undefined

}

// exports --------------------------------------------------------

module.exports = OODefinition
