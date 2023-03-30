'use strict'

const util = require('util'),
      async = require('async'),
      { singularize, capitalize } = require('inflection'),
      modules = require('../../../../modules'),
      clone = require('clone'),
      acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      properties = require('../properties'),
      { transformAccessContext } = require('../properties/accessTransforms'),
      _ = require('underscore'),
      utils = require('../../../../utils'),
      {
        rBool, rString, array: toArray, idArrayUnion, isCustomName, isSet,
        uniqueIdArray, equalIds
      } = utils,
      ap = require('../../../../access-principal'),
      Fault = require('cortex-service/lib/fault'),
      DocumentDefinition = require('./document-definition'),
      UnhandledResult = require('../classes/unhandled-result'),
      AclDefinition = require('../acl-definition'),
      ObjectIdDefinition = require('./objectid-definition'),
      PropertyDefinition = require('../property-definition')

let Undefined

function ReferenceDefinition(options) {

  options = options || {}

  options.array = false // arrays of references are not allowed.
  options.forceId = true // there is always an _id property.
  options.autoId = false // the _id is not automatically set.

  this.objectValidators = toArray(options.objectValidators)
  this.allowObjectWrite = options.sourceObject === '' && rBool(options.allowObjectWrite, false)

  options.properties = [{
    label: 'Object',
    name: 'object',
    type: 'String',
    // description: 'The object',
    readable: true,
    writable: this.allowObjectWrite,
    readAccess: acl.Inherit,
    writeAccess: acl.Inherit,
    dependencies: ['._id'],
    validators: this.objectValidators
  }, {
    label: 'Path',
    name: 'path',
    type: 'String',
    // description: 'The context api path',
    virtual: true,
    readable: true,
    writable: false,
    readAccess: acl.Inherit,
    allowBenignProjectionAndGrouping: true,
    dependencies: ['.object', '._id'],
    reader: function(ac, node) {
      return node.parent._readUrlProperty(this, ac)
    }
  }]

  let auditable = options.auditable,
      idProperty

  options.auditable = false

  this.writeThrough = Boolean(options.writeThrough)
  this.updateOnWriteThrough = Boolean(options.updateOnWriteThrough)
  this.inheritInstanceRoles = Boolean(options.inheritInstanceRoles)
  this.inheritPropertyAccess = Boolean(options.inheritPropertyAccess)
  this.defaultAcl = utils.array(options.defaultAcl)
  this.defaultAclOverride = Boolean(options.defaultAclOverride)
  this.accessTransforms = utils.array(options.accessTransforms)

  options.dependencies = utils.array(options.dependencies, options.dependencies)
    .concat(this.accessTransforms.map(v => {
      if (v.name === 'direct') {
        return '.' + v.property // if there's a local property used in a transform, always load it.
      }
    }).filter(v => v))

  DocumentDefinition.call(this, options)

  if (this.writer && this.writeThrough) {
    throw new Error('writeThrough with custom writer is not permitted.')
  }

  if (!this.writer) {
    this.writer = function(ac, node, value) {
      const id = utils.getIdOrNull(value)
      if (id) {
        value = {
          _id: id
        }
      }
      return value
    }
  }

  // allow the _id to be written, based on the writable state of the reference itself.
  idProperty = this.properties['_id']

  utils.extend(idProperty, {

    _writeAccess: acl.Inherit,
    _readAccess: acl.Inherit,
    writable: this.writable,
    creatable: this.creatable,
    history: this.history,
    nativeIndex: this.nativeIndex,
    auditable: auditable,
    _id: this._id, // <-- for slot lookups.

    importAccess: this.importAccess,

    // add indexed and unique properties to the _id. the reference will handle the index rebuilding.
    indexed: this.indexed,
    unique: this.unique,
    _rebuildPropertyIndex: function(parentDocument) {
      this.parent._rebuildPropertyIndex(parentDocument)
    },

    writer: function(ac, node, value, options, callback) {

      let writes = ac.option(`$writes.${node.fqpp}`)
      if (!writes) {
        writes = new Set()
        ac.option(`$writes.${node.fqpp}`, writes)
      }
      writes.add(this)

      const oldValue = this._id,
            [err, newValue] = utils.tryCatch(() => {
              return node.castForQuery(ac, value)
            })

      if (err || !_.isFunction(node.parent.onSetReference)) {
        callback(err, newValue)
      } else {
        node.parent.onSetReference(ac, oldValue, newValue, callback)
      }

    }
  })

  idProperty.addDependency('.object')
  idProperty.addDependency('.type')

  if (options.nativeValidator !== false) {
    idProperty.validators = [
      {
        name: 'adhoc',
        definition: {
          validator: function(ac, node, value, callback) {
            const objectName = utils.path(this, node.parent.docpath + '.object') || node.parent.sourceObject
            // the caller must have access to the source reference.
            ac.org.createObject(objectName, (err, model) => {
              if (err) {
                return callback(err)
              }
              model.getAccessContext(ac.principal, value, { grant: ac.grant }, (err, ac) => {
                if (!err && (node.parent.referenceAccess !== acl.AccessLevels.None) && !ac.hasAccess(node.parent.referenceAccess)) {
                  err = Fault.create('cortex.accessDenied.referencedContext', { path: node.fullpath })
                }
                callback(err)
              })
            })
          },
          // only validate when the write was used, allowing the api to directly set references without consequence.
          when: function(ac, node) {
            let writes = ac.option(`$writes.${node.fqpp}`)
            return node.parent.validateReference && writes && writes.has(this)
          }
        }
      },
      ...idProperty.validators,
      ...utils.array(options.validators, options.validators)
    ]
  } else {
    idProperty.validators = [
      ...idProperty.validators,
      ...utils.array(options.validators, options.validators)
    ]
  }

  this.expandable = utils.rBool(options.expandable, false)
  this.autoCreate = utils.rBool(options.autoCreate, false)
  this.validateReference = utils.rBool(options.validateReference, true)
  this.grant = acl.fixAllowLevel(options.grant, true, acl.AccessLevels.None)
  this.roles = options.roles
  this.sourceObject = options.sourceObject
  this.cascadeDelete = options.cascadeDelete
  this.paths = utils.array(options.paths)
  this.referenceAccess = Math.max(acl.AccessLevels.None, acl.fixAllowLevel(options.referenceAccess, true, acl.AccessLevels.Share))
  this.pacl = utils.array(options.pacl)

  if (this.autoCreate) {
    this.addDependency('owner')
  }

  // internals

  // write event. called with old and new value. the returned value is set.
  this.onSetReference = options.onSetReference

  // expansion addition event.
  this.onCreateExpansion = options.onCreateExpansion

  if (options.objectIndexed) {
    this.properties.object.nativeIndex = true
  }

  if (this.groupReader) {
    throw new Error('references cannot have async readers or group readers!')
  }

}
util.inherits(ReferenceDefinition, DocumentDefinition)
ReferenceDefinition.typeName = 'Reference'
ReferenceDefinition.mongooseType = null

ReferenceDefinition.prototype.isIndexable = true

ReferenceDefinition.prototype.getTypeName = function() {
  return ReferenceDefinition.typeName
}

ReferenceDefinition.prototype.getIndexableValue = function(rootDocument, parentDocument, node, value) {
  return utils.path(value, '_id')
}

ReferenceDefinition.prototype._removeProperty = function(ac, parentDocument, callback) {
  return PropertyDefinition.prototype._removeProperty.call(this, ac, parentDocument, callback)
}

ReferenceDefinition.prototype.apiSchema = function(options) {

  const schema = DocumentDefinition.prototype.apiSchema.call(this, options)
  if (schema) {

    // remove indexed and unique from the _id property is it exists.
    if (this.indexed || this.unique) {
      const idProp = _.find(schema.properties, function(p) { return p.name === '_id' })
      delete idProp.indexed
      delete idProp.unique
    }

    if (this.expandable) {
      schema.expandable = true
    }
    if (this.grant > acl.AccessLevels.None) {
      schema.grant = this.grant
    }
    if (this.sourceObject) {
      schema.sourceObject = this.sourceObject
    }
    schema.cascadeDelete = this.cascadeDelete

    if (this.autoCreate) {
      schema.autoCreate = true
    }
    if (this.paths.length) {
      schema.paths = this.paths
    }
    if (schema.create != null || schema.update != null) {
      schema.referenceAccess = this.referenceAccess
    }
    schema.pacl = this.pacl.map(function(entry) { entry = clone(entry); delete entry._id; return entry })
    if (this.writeThrough) {
      schema.writeThrough = this.writeThrough
      schema.updateOnWriteThrough = this.updateOnWriteThrough
    }
    schema.defaultAcl = this.defaultAcl.map(entry => _.omit(entry, '_id'))
    schema.inheritInstanceRoles = this.inheritInstanceRoles
    schema.inheritPropertyAccess = this.inheritPropertyAccess
    schema.accessTransforms = this.accessTransforms.map(entry => _.omit(entry, '_id'))

  }
  return schema

}

ReferenceDefinition.getProperties = function() {
  return [

    // refs cannot be arrays. must be wrapped in a document.
    { name: 'array', default: false, readable: false, writable: false, public: false },

    {
      name: 'indexed',
      default: false,
      writable: true,
      // @hack attack.
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'Unique properties must also be indexed.',
          validator: function(ac, node, indexed) {
            return indexed || !this.unique
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Cascade Delete properties must also be indexed.',
          validator: function(ac, node, indexed) {
            return indexed || !this.cascadeDelete
          }
        }
      }]
    },

    { name: 'auditable', default: false, writable: true },
    { name: 'unique', default: false, writable: true },
    { name: 'canPush', readable: false, writable: false, public: false },
    { name: 'canPull', readable: false, writable: false, public: false },
    { name: 'minItems', readable: false, writable: false, public: false },
    { name: 'maxShift', readable: false, writable: false, public: false },
    { name: 'maxItems', readable: false, writable: false, public: false },
    { name: 'writeOnCreate', default: false, readable: false, writable: false, public: false },
    { name: 'pusher', default: false, readable: false, writable: false, public: false },
    { name: 'puller', default: false, readable: false, writable: false, public: false },
    { name: 'uniqueValues', default: false, readable: false, writable: false, public: false },

    // custom readers and writers are not allowed, nor are default values.
    { name: 'reader', readable: false, writable: false, public: false },
    { name: 'writer', readable: false, writable: false, public: false },
    { name: 'default', readable: false, writable: false, public: false },

    {
      label: 'Expandable',
      name: 'expandable',
      type: 'Boolean',
      // description: 'If true, this property can be expanded using "expand" options',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Validate Reference',
      name: 'validateReference',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: true
    },
    {
      label: 'Required Access',
      name: 'referenceAccess',
      type: 'Number',
      // description: 'The access required by the calling principal on the referenced context in order to set the reference _id.',
      readable: true,
      writable: true,
      default: acl.AccessLevels.Share,
      validators: [{
        name: 'required'
      }, {
        name: 'numberEnum',
        definition: {
          values: [acl.AccessLevels.None, acl.AccessLevels.Public, acl.AccessLevels.Connected, acl.AccessLevels.Read, acl.AccessLevels.Share, acl.AccessLevels.Update, acl.AccessLevels.Delete]
        }
      }],
      writer: function(ac, node, value) {
        if (_.isString(value)) {
          const intValue = acl.AccessLevels[capitalize(value)]
          if (isSet(intValue)) {
            return intValue
          }
        }
        return value
      },
      export: async function(ac, input, resourceStream, parentPath, options) {
        const value = await PropertyDefinition.prototype.export.call(this, ac, input, resourceStream, parentPath, options)
        return value === Undefined ? value : rString(acl.AccessLevelsLookup[value], '').toLowerCase()
      },
      import: async function(ac, input, resourceStream, parentPath, options) {
        const value = await PropertyDefinition.prototype.import.call(this, ac, input, resourceStream, parentPath, options)
        return value === Undefined ? value : acl.AccessLevels[capitalize(value)]
      }
    },
    {
      label: 'Grant',
      name: 'grant',
      type: 'Number',
      // description: 'Applies to expansions. The access level granted to the calling principal through expansion. Warning! This option can expose private context details. Consider using object pacls instead, and leave the grant level low.',
      readable: true,
      writable: true,
      default: acl.AccessLevels.None,
      writer: function(ac, node, value) {
        if (_.isString(value)) {
          const intValue = acl.AccessLevels[capitalize(value)]
          if (isSet(intValue)) {
            return intValue
          }
        }
        return value
      },
      validators: [{
        name: 'numberEnum',
        definition: {
          values: [acl.AccessLevels.None, acl.AccessLevels.Public, acl.AccessLevels.Connected, acl.AccessLevels.Read, acl.AccessLevels.Share, acl.AccessLevels.Update],
          defaultValue: acl.AccessLevels.None
        }
      }],
      export: async function(ac, input, resourceStream, parentPath, options) {
        const value = await PropertyDefinition.prototype.export.call(this, ac, input, resourceStream, parentPath, options)
        return value === Undefined ? value : rString(acl.AccessLevelsLookup[value], '').toLowerCase()
      },
      import: async function(ac, input, resourceStream, parentPath, options) {
        const value = await PropertyDefinition.prototype.import.call(this, ac, input, resourceStream, parentPath, options)
        return value === Undefined ? value : acl.AccessLevels[capitalize(value)]
      }
    },
    {
      // description: 'Applies to expansions. Instance roles to apply to the calling principal through expansion.',
      label: 'Roles',
      name: 'roles',
      type: 'ObjectId',
      writable: true,
      array: true,
      uniqueValues: false,
      canPush: false,
      canPull: false,
      writer: function(ac, node, value) {
        return uniqueIdArray(
          value.map(role => {
            if (_.isString(role)) {
              const existing = ac.org.roles.find(r => (r.code && r.code === role) || equalIds(role, r._id))
              if (existing) {
                return existing._id
              }
            }
            return role
          })
        )
      },
      import: async function(ac, doc, resourceStream, parentPath, options) {

        const resourcePath = this.getExportResourcePath(parentPath, options),
              arr = await PropertyDefinition.prototype.import.call(this, ac, doc, resourceStream, parentPath, options),
              out = []

        if (arr === Undefined) {
          return Undefined
        }

        for (const id of toArray(arr)) {
          out.push = (await resourceStream.importMappedPrincipal(ac, `role.${id}`, `${resourcePath}.roles`))._id
        }
        return out

      },
      export: async function(ac, doc, resourceStream, parentPath, options) {

        const resourcePath = this.getExportResourcePath(parentPath, options),
              arr = await PropertyDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options)

        if (arr === Undefined) {
          return Undefined
        }

        return (await Promise.all(utils.array(arr).map(async(id) => {
          return resourceStream.addMappedPrincipal(ac, id, resourcePath)
        }))).sort(utils.naturalCmp)

      },
      validators: [{
        name: 'adhoc',
        definition: {
          asArray: true,
          validator: function(ac, node, values) {
            if (utils.intersectIdArrays(values, utils.array(ac.org.roles).map(role => role._id)).length < values.length) {
              throw Fault.create('cortex.notFound.role', { reason: `One or more roles do not exist for ${modules.db.definitions.getInstancePath(this, node)}` })
            }
            return true
          }
        }
      }]
    },
    {
      label: 'Cascade Delete',
      name: 'cascadeDelete',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false,
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'Cascade delete is only available in top-level references of custom objects.',
          validator: function(ac, node, value) {
            // the property must be at the top level, in a custom object.
            const objectName = modules.db.getRootDocument(this).name

            return !value || ((objectName.indexOf('c_') === 0 || ~objectName.indexOf('__')) && node.parent.fullpath === 'properties')
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Cascade delete properties must also be indexed.',
          validator: function(ac, node, cascade) {
            return !cascade || this.indexed
          }
        }
      }]
    },
    {
      label: 'Auto Create',
      name: 'autoCreate',
      type: 'Boolean',
      // description: 'If true, a referenced object is auto-created, owned by the owner of the host context (in the case of account, the account holder)',
      readable: true,
      writable: true,
      default: false,
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'Only objects with owners (and accounts) can have auto-created properties.',
          validator: function(ac, node, value) {

            if (!value) return true

            // all custom objects, and accounts have owners. Object always loads lookup and name.
            let objectName = ac.subject.name,
                def

            // custom objects always have an owner.
            if (objectName.indexOf('c_') === 0 || ~objectName.indexOf('__')) {
              return true
            }

            // accounts use '_id' for auto-create.
            if (utils.equalIds(ac.subject.lookup, consts.NativeIds.account)) {
              return true
            }

            // any built-in def with an owner.
            def = modules.db.definitions.builtInObjectDefsMap[objectName]
            return !!(def && def.hasOwner)

          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Auto created references are only allowed as top-level object properties.',
          validator: function(ac, node, value) {

            if (!value) return true

            let curr = this,
                root = modules.db.getRootDocument(this)

            while (curr) {

              if (curr.parent() === root) { // if the current node is the object's properties node.
                return true
              }
              curr = curr.parent()
              if (!curr || curr.type !== 'Document' || !!curr.array) { // only allow parents that are nested documents
                return false
              } else {
                curr = curr.parent() // move up to the document properties Set node.
              }
            }
            return false
          }
        }
      }]
    },
    {
      label: 'Source Object',
      name: 'sourceObject',
      type: 'String',
      // description: 'Applies to expansions. The name of the object from which to expand.',
      readable: true,
      creatable: true,
      trim: true,
      lowercase: true,
      dependencies: ['.autoCreate', '.paths'],
      export: async function(ac, doc, resourceStream, parentPath, options) {

        const resourcePath = this.getExportResourcePath(parentPath, options),
              sourceObject = await PropertyDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options)

        if (sourceObject === Undefined) {
          return Undefined
        }
        return resourceStream.addMappedObject(ac, sourceObject, resourcePath)

      },
      writer: function(ac, node, value) {
        return value && singularize(value)
      },
      validators: [{
        name: 'adhoc',
        definition: {
          validator: function(ac, node, value, callback) {
            ac.org.createObject(value, err => callback(err))
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Organization cannot be referenced.',
          validator: function(ac, node, value) {
            return value !== 'org'
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Output objects cannot be referenced',
          validator: function(ac, node, value) {
            return !isCustomName(value, 'o_', false)
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Auto-created references can only reference custom objects.',
          validator: function(ac, node, value) {
            return !this.autoCreate || (value.indexOf('c_') === 0 || ~value.indexOf('__'))
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Auto-created references cannot cause circular creation.',
          validator: function(ac, node, value, callback) {
            if (!this.autoCreate) {
              return callback()
            }
            const name = modules.db.getRootDocument(this).name
            ac.org.createObject(value, function(err, object) {
              if (err) {
                return callback(err)
              }
              modules.db.definitions.validateAutoCreate(ac.org, object, { chain: [name] }, function(err) {
                callback(err)
              })
            })
          }
        }
      }]
    },
    {
      label: 'Expansion Paths',
      name: 'paths',
      type: 'String',
      // description: 'Applies to expansions. A list of fixed property names to load if the property is expanded. If set, access is always granted to these paths.',
      array: true,
      maxItems: 20,
      uniqueValues: true,
      readable: true,
      writable: true,
      canPush: true,
      canPull: true,
      dependencies: ['.sourceObject'],
      groupReader: function(node, principal, entries, req, script, selection, callback) {

        const names = Array.from(entries.reduce(function(names, entry) { names.add(entry.input.sourceObject); return names }, new Set()))

        async.reduce(names, new Map(), function(objects, name, callback) {
          if (objects.has(name)) {
            return callback(null, objects)
          }
          principal.org.createObject(name, function(err, object) {
            if (!err) {
              objects.set(name, object)
            }
            callback(null, objects)
          })

        }, function(err, objects) {
          if (!err) {
            entries.forEach(function(entry) {
              const object = objects.get(entry.input.sourceObject)
              entry.parent[entry.key] = !object ? [] : utils.array(entry.value).map(function(path) {
                const node = object.schema.node.findNode(path)
                if (node) {
                  return node.fullpath
                }
                return null
              }).filter(function(v) { return !!v })

            })
          }
          callback(err)

        })

      },
      pusher: function(ac, node, values) {
        return values.map(path => utils.normalizeObjectPath(path, true, true, true))
      },
      writer: function(ac, node, values) {
        return values.map(path => utils.normalizeObjectPath(path, true, true, true))
      },
      validators: [{
        name: 'adhoc',
        definition: {
          validator: function(ac, node, values, callback) {
            ac.org.createObject(this.sourceObject, function(err, object) {
              if (err) {
                return callback(err)
              }
              let i, path, node
              for (i = 0; i < values.length; i++) {
                path = values[i]
                node = object.schema.node.findNode(path)
                if (!node || !node.readable) {
                  return callback(Fault.create('cortex.notFound.property', { path: path, reason: 'Reference property not found: ' + path }))
                }
                // don't allow nodes that would otherwise not be readable.
                if (node.readAccess > acl.AccessLevels.Delete) {
                  return callback(Fault.create('cortex.notFound.property', { path: node.fullpath, reason: 'Reference property cannot be accessed: ' + path }))
                }
              }
              callback()
            })
          },
          asArray: true
        }
      }]
    },
    new AclDefinition({
      label: 'Property Acl',
      name: 'pacl',
      type: 'Document',
      // description: 'Adds augmented access to individual properties in the expanded object.',
      readable: true,
      writable: true,
      array: true,
      maxItems: 20,
      canPush: true,
      canPull: true,
      includeId: true,
      forReference: true,
      withExpressions: true
    }),
    {
      label: 'Write Through',
      name: 'writeThrough',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Update On Write Through',
      name: 'updateOnWriteThrough',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Inherit Instance Roles',
      name: 'inheritInstanceRoles',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Inherit Property Access',
      name: 'inheritPropertyAccess',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    new AclDefinition({
      label: 'Default Acl',
      name: 'defaultAcl',
      type: 'Document',
      readable: true,
      writable: true,
      array: true,
      maxItems: 20,
      canPush: true,
      canPull: true,
      includeId: true,
      withExpressions: true
    }),
    {
      label: 'Default Acl Override',
      name: 'defaultAclOverride',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    properties.accessTransforms
  ]
}

ReferenceDefinition.prototype._readUrlProperty = function(doc, ac) {

  let refId = utils.path(doc, this.docpath + '._id'),
      object,
      def

  if (!utils.isId(refId)) {
    return undefined
  }

  object = utils.path(doc, this.docpath + '.object') || this.sourceObject // internally, the object could be saved to the database (like for posts).
  def = modules.db.definitions.cachedFindObjectDef(ac.org, object)

  if (def) {
    return '/' + def.pluralName + '/' + refId
  }

  return undefined

}

ReferenceDefinition.prototype.aclWrite = function(topAc, parentDocument, value, options, callback_) {

  [options, callback_] = utils.resolveOptionsCallback(options, callback_, true, false)

  // do not allow write through unless the reference is already set.
  let thisDoc = utils.path(parentDocument, this.docpath),
      isWriteThrough = this.writeThrough && this.sourceObject && thisDoc && thisDoc._id && !parentDocument.isNew && !thisDoc.isNew && !utils.getIdOrNull(value) && utils.isPlainObjectWithSubstance(value) && !value._id

  if (!isWriteThrough) {
    return DocumentDefinition.prototype.aclWrite.call(this, topAc, parentDocument, value, options, callback_)
  }

  const callback = (err) => {
    topAc.popResource()
    callback_(err)
  }
  topAc.pushResource(this.getResourcePath(topAc, parentDocument))

  this.transformAccessContext(topAc, parentDocument, { forWrite: true }, (err, ac) => {

    if (err) {
      return callback(err)
    }

    ac.org.createObject(this.sourceObject, (err, Source) => {
      if (err) {
        return callback(err)
      }
      const writeOptions = {
        method: ac.method,
        script: ac.script,
        req: ac.req,
        grant: Math.max(this.grant, ac.grant),
        roles: idArrayUnion(this.roles, ac.instance_roles),
        skipAcl: ac.principal.skipAcl,
        defaultAcl: this.defaultAcl,
        defaultAclOverride: this.defaultAclOverride,
        dryRun: ac.dryRun,
        locale: ac.getLocale(false, false),
        resourcePath: ac.getResource()
      }

      Source.aclUpdate(ac.principal, thisDoc._id, value, writeOptions, (err, { resultAc, modified }) => {
        if (this.updateOnWriteThrough && modified && modified.length) {
          const mod = topAc.option('$readableModified') || []
          mod.push(this.fullpath)
          topAc.option('$readableModified', mod)
          return topAc.sidebandUpdate({ updated: new Date(), updater: { _id: topAc.principal._id } }, {}, err => {
            callback(err, resultAc, modified)
          })
        }
        callback(err, resultAc, modified)
      })
    })

  })

}

ReferenceDefinition.prototype.aclRemove = function(topAc, parentDocument, value, callback_) {

  // do not allow write through unless the reference is already set.
  let thisDoc = utils.path(parentDocument, this.docpath),
      isWriteThrough = this.writeThrough && this.sourceObject && thisDoc && thisDoc._id && !parentDocument.isNew && !thisDoc.isNew && !utils.getIdOrNull(value) && utils.isPlainObjectWithSubstance(value) && !value._id

  if (!isWriteThrough) {
    return DocumentDefinition.prototype.aclRemove.call(this, topAc, parentDocument, value, callback_)
  }

  const callback = (err) => {
    topAc.popResource()
    callback_(err)
  }
  topAc.pushResource(this.getResourcePath(topAc, parentDocument))

  this.transformAccessContext(topAc, parentDocument, { forWrite: true }, (err, ac) => {

    if (err) {
      return callback(err)
    }

    ac.org.createObject(this.sourceObject, (err, Source) => {
      if (err) {
        return callback(err)
      }
      const options = {
        method: ac.method,
        script: ac.script,
        req: ac.req,
        grant: Math.max(this.grant, ac.grant),
        roles: idArrayUnion(this.roles, ac.instance_roles),
        skipAcl: ac.principal.skipAcl,
        defaultAcl: this.defaultAcl,
        defaultAclOverride: this.defaultAclOverride,
        dryRun: ac.dryRun,
        locale: ac.getLocale(false, false),
        resourcePath: ac.getResource()
      }
      Source.aclRemovePath(ac.principal, thisDoc._id, value, options, (err, { resultAc, modified }) => {
        if (this.updateOnWriteThrough && modified && modified.length) {
          const mod = topAc.option('$readableModified') || []
          mod.push(this.fullpath)
          topAc.option('$readableModified', mod)
          return topAc.sidebandUpdate({ updated: new Date(), updater: { _id: topAc.principal._id } }, {}, err => {
            callback(err, resultAc, !!modified && modified.length > 0)
          })
        }
        callback(Fault.from(err), !!modified && modified.length > 0)
      })
    })

  })

}

ReferenceDefinition.prototype.transformAccessContext = transformAccessContext

/**
 * does not save the context but does perform all validation. also, looks
 * deep into auto-create to find circular dependencies.
 *
 * @param ac
 * @param callback
 * @returns {*}
 *
 */
ReferenceDefinition.prototype.autoCreateContext = function(ac, callback) {

  const subject = ac.subject
  if (!subject || !subject.isNew) {
    return callback(null, null)
  }

  async.waterfall([

    callback => {
      ac.org.createObject(this.sourceObject, callback)
    },

    (object, callback) => {

      const isAccount = ac.objectName === 'account',
            ownerId = utils.getIdOrNull(isAccount ? ac.subjectId : ac.ownerId)

      if (!ownerId) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'auto-created reference must have an owner or be an account.' }))
      }

      if (isAccount) {
        callback(null, object, ap.synthesizeAccount({ org: ac.org, accountId: ownerId }))
      } else {
        ap.create(ac.org, ownerId, function(err, ownerPrincipal) {
          callback(err, object, ownerPrincipal)
        })
      }
    },

    (object, principal, callback) => {

      const createOptions = {
        req: ac.req,
        script: ac.script,
        method: 'post',
        bypassCreateAcl: true,
        dryRun: true,
        grant: Math.max(this.grant, this.inheritPropertyAccess ? this.getRuntimeAccess(ac, true) : acl.AccessLevels.None),
        beforeWrite: (ac, payload, callback) => {
          ac.option('$autoCreate', true)
          callback()
        },
        ignoreObjectMode: true // the parent will have taken care of this.
      }

      object.aclCreate(principal, {}, createOptions, function(err, { ac }) {
        if (ac) {
          ac.dryRun = false
        }
        callback(err, ac)
      })
    }

  ], callback)

}

ReferenceDefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {

  // always include the entire property for a reference. the sub-paths might extend into an expansion, so we would be in danger of losing this entire selection.
  DocumentDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, null, options)
  for (let name in this.properties) {
    if (this.properties.hasOwnProperty(name)) {
      this.properties[name].collectRuntimePathSelections(principal, selections, null, options)
    }
  }

}

ReferenceDefinition.prototype.onRemovingValue = function(ac, parentDocument, value, index) {
  PropertyDefinition.prototype.onRemovingValue.call(this, ac, parentDocument, value, index)
}

ReferenceDefinition.prototype.castForQuery = ObjectIdDefinition.prototype.castForQuery

ReferenceDefinition.prototype.initReader = function() {
  this._compiledReader = this._readerExpand
}

ReferenceDefinition.prototype.aclAccess = function(ac, parentDocument, parts, options, callback) {

  parts = utils.normalizeAcPathParts(parts)
  if (parts.length === 0) {
    return PropertyDefinition.prototype.aclAccess.call(this, ac, parentDocument, parts, options, callback)
  }

  if (!this.readable) {
    return callback(Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: this.fqpp }))
  } else if (!this.expandable) {
    return callback(Fault.create('cortex.notFound.property', { resource: ac.getResource(), reason: 'Property not expandable', path: this.fqpp }))
  }

  this.transformAccessContext(ac, parentDocument, (err, ac) => {

    if (err) {
      return callback(err)
    }

    ac.org.createObject(this.sourceObject, (err, Source) => {
      if (err) {
        return callback(err)
      }
      const accessOptions = {
        method: ac.method,
        script: ac.script,
        req: ac.req,
        grant: Math.max(this.grant, ac.grant),
        roles: utils.idArrayUnion(this.roles, ac.instance_roles),
        skipAcl: ac.principal.skipAcl,
        defaultAcl: this.defaultAcl,
        defaultAclOverride: this.defaultAclOverride
      }
      Source.buildAccessContext(ac.principal, parts, accessOptions, callback)

    })
  })

}

ReferenceDefinition.prototype._readerExpand = function(ac, node, selection) {

  let wasRead, isUnhandled, reference, object, def

  if (selection.runtimeProcessor) {
    selection = selection.runtimeProcessor(ac, node, this, selection)
  }

  const isExpansion = selection.projection || selection.expand || (selection.keys.length > 0 && _.difference(selection.keys || [], Object.keys(node.properties)).length > 0),
        isLinked = selection.getOption('readFromLinkedReferences')

  // auto expand / read-through when sub paths are present and not reading the standard _id/object/path.
  if (isExpansion || isLinked) {

    const document = (isLinked && this.$__linked && this.$__linked[node.docpath]) || null

    // check for an undefined reader result. the read may have been cancelled even though we want to expand.
    // if it's unhandled and has a result use what was returned.
    if (node.reader) {
      wasRead = true
      reference = node.reader.call(this, ac, node, selection)
      isUnhandled = (reference instanceof UnhandledResult)
      if (!isUnhandled) { // undefined or hard-coded result?
        return undefined
      }
    }

    if (isExpansion && !node.expandable) {
      throw Fault.create('cortex.invalidArgument.illegalExpansion', { resource: ac.getResource(), path: node.fullpath, reason: 'Expansion not allowed for path: ' + node.fullpath + (selection.keys.length === 1 ? ('.' + selection.keys[0]) : ('.[' + selection.keys.join(',') + ']')) })
    }

    reference = isUnhandled ? reference.result : utils.path(this, selection.pathOverride || node.docpath)
    if (reference || document) {

      object = reference.object || node.sourceObject
      def = modules.db.definitions.cachedFindObjectDef(ac.org, object)

      // let  _readSingleResult think we used a custom reader. this way, we can bypass the standard reader.
      if (def && utils.isId(reference._id)) {

        // if there is a path option, pass along a substring to the expansion.
        let singlePath = ac.singlePath,
            pacl = node.pacl,
            grant = node.grant

        if (singlePath) {
          if (singlePath.indexOf(node.fullpath) === 0) {
            singlePath = singlePath.substr(node.fullpath.length + 1)
          } else {
            singlePath = null
          }
        }

        // limit to specific paths
        if (node.paths.length > 0) {
          selection = selection.cloneWithSelections({})
          node.paths.forEach(path => selection.addPath(path))
          grant = Math.min(acl.AccessLevels.Delete, node.referenceAccess)
          pacl = [{
            type: acl.AccessTargets.Account,
            target: acl.AnonymousIdentifier,
            allow: grant,
            paths: node.paths
          }]
        }

        const roles = utils.array(node.roles).slice()
        if (node.inheritInstanceRoles) {
          roles.push(...ac.instance_roles)
        }

        if (node.inheritPropertyAccess) {
          grant = Math.max(grant, node.getRuntimeAccess(ac, false))
        }

        if (isExpansion || (isLinked && document)) {
          let pointer = ac.eq.add(ac, this, reference, node, selection, def.lookup || def.objectId, reference._id, singlePath, singlePath && ac.singleCursor, singlePath && ac.singleOptions, singlePath && ac.singleCallback, grant, pacl, roles, node.defaultAcl, node.defaultAclOverride, node.accessTransforms, document)
          if (pointer && _.isFunction(node.onCreateExpansion)) {
            pointer = node.onCreateExpansion.call(this, ac, node, pointer)
          }
          return pointer
        }
      }
    }

  }

  if (node.reader) {
    if (!wasRead) {
      reference = node.reader.call(this, ac, node, selection)
      isUnhandled = (reference instanceof UnhandledResult)
    }
    if (!isUnhandled) { // undefined or hard-coded result?
      return undefined
    }
  }

  reference = isUnhandled ? reference.result : utils.path(this, selection.pathOverride || node.docpath)

  // optimization
  if (selection.keys.length === 0) {
    if (reference === undefined || !utils.isId(reference._id)) {
      return undefined
    }
    object = reference.object || node.sourceObject
    def = modules.db.definitions.cachedFindObjectDef(ac.org, object)
    return {
      _id: reference._id,
      object: object,
      path: def ? '/' + def.pluralName + '/' + reference._id : undefined
    }
  }

  if (reference === undefined) {
    if (node.stub !== undefined) {
      reference = node.stub()
    }
  }
  return new UnhandledResult(reference)

}

ReferenceDefinition.getMappingProperties = function() {
  return [{
    label: 'Source Object',
    name: 'sourceObject',
    type: 'ObjectId'
  }]
}

ReferenceDefinition.prototype.export = async function(ac, doc, resourceStream, parentPath, options) {

  const value = await PropertyDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options),
        objectName = utils.rString(value && value.object, this.sourceObject),
        isExpanded = _.difference(Object.keys(value || {}), Object.keys(this.properties)).length > 0,
        resourcePath = utils.joinPaths(parentPath, this.path)

  if (value === Undefined) {
    return Undefined
  } else if (isExpanded) {
    throw Fault.create('cortex.unsupportedOperation.unspecified', {
      resource: ac.getResource(),
      reason: 'Expansions in references are not supported.',
      path: this.fqpp
    })
  }

  // include reference. we do not need the object definition here. eg 'script.c_ucumber'
  return resourceStream.addMappedInstance(
    ac,
    objectName,
    value._id,
    resourcePath,
    { includeResourcePrefix: true }
  )

}

ReferenceDefinition.prototype.import = async function(ac, doc, resourceStream, parentPath, options) {

  const value = await PropertyDefinition.prototype.import.call(this, ac, doc, resourceStream, parentPath, options),
        [objectName, uniqueKey] = utils.pathParts(value),
        resourcePath = utils.joinPaths(parentPath, this.path)

  if (value === Undefined) {
    return Undefined
  }

  return {
    _id: (await resourceStream.importMappedInstance(ac, objectName, uniqueKey, resourcePath))._id,
    object: objectName
  }

}

module.exports = ReferenceDefinition
