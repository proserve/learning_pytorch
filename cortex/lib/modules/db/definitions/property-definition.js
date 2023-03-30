'use strict'

const _ = require('underscore'),
      properties = require('./properties'),
      clone = require('clone'),
      async = require('async'),
      modules = require('../../../modules'),
      acl = require('../../../acl'),
      logger = require('cortex-service/lib/logger'),
      consts = require('../../../consts'),
      Fault = require('cortex-service/lib/fault'),
      {
        path: pathTo, rString, rBool, rInt, array: toArray, option: getOption,
        promised, deserializeObject, isPlainObject, isInteger, normalizeAcPathParts,
        equalIds, isInt, extend, rVal, digIntoResolved, pathToPayload, joinPaths, isSet,
        resolveOptionsCallback, naturalCmp, decodeME, isCustomName
      } = require('../../../utils'),
      UnhandledResult = require('./classes/unhandled-result'),
      safePathTo = require('../../../classes/pather').sandbox,
      { GroupedRead, DeferredRead } = require('./classes/deferred-read'),
      local = {
        _ValidatorDefinition: null,
        _AclDefinition: null,
        _PropertySetDefinition: null
      }

let Undefined

Object.defineProperty(local, 'ValidatorDefinition', { get: function() { return (this._ValidatorDefinition || (this._ValidatorDefinition = require('./validator-definition'))) } })
Object.defineProperty(local, 'PropertySetDefinition', { get: function() { return (this._PropertySetDefinition || (this._PropertySetDefinition = require('./property-set-definition'))) } })

async function testDependenciesForCircularReferences(ac) {

  const Model = await promised(modules.db.definitions, 'generateCustomModel', ac.subject.toObject()),
        masterNode = Model.schema.node,
        isTyped = !(!masterNode.typed && !masterNode.typeMasterNode),
        types = isTyped ? Object.values(masterNode.types) : [{ node: masterNode }]

  for (let type of types) {
    type.node.walk(node => {
      if (node.getTypeName() === 'Document') {
        node._getLocalSortedNodes()
      }
    })
  }

}

async function testDependencyPaths(doc, ac, node, dep) {

  const Model = await promised(modules.db.definitions, 'generateCustomModel', modules.db.getRootDocument(doc).toObject()),
        type = modules.db.definitions.getDefinitionPropertyObjectDocument(doc),
        TargetModel = Model.getModelForType(type) || Model,
        targetNode = TargetModel.schema.node.findNode(dep)

  return !!targetNode

}

function setupDependencyChecks(ac) {

  ac.hook('validate').fail(
    function(err, vars, callback) {
      testDependenciesForCircularReferences(vars.ac)
        .catch(e => { err.add(e) })
        .then(() => callback(err))
    },
    'property-dependency-validation-failed',
    true
  )

  ac.hook('validate').after(
    function(vars, callback) {
      let err
      testDependenciesForCircularReferences(vars.ac)
        .catch(e => {
          err = Fault.create('cortex.invalidArgument.validation')
          err.add(e)
        })
        .then(() => callback(err))
    },
    'property-dependency-validation',
    true
  )

}

/**
 * @constructor
 *
 * options
 *  inSet
 *
 *
 */
function PropertyDefinition(options) {

  options = options || {}

  // properties that act on the definition for acl reading.

  this.label = rString(options.label, '')
  this.name = String(options.name)
  this.description = rString(options.description, '')
  this._id = options._id // the property definition _id, NOT the property id of a document in a set.

  this.array = rBool(options.array, false)
  this.uniqueValues = rBool(options.uniqueValues, false)
  this.minItems = Math.max(0, rInt(options.minItems, 0))
  this.maxItems = Math.max(-1, rInt(options.maxItems, 100)) // internally, we allow -1.
  this.maxShift = rBool(options.maxShift, false)
  this.canPush = rBool(options.canPush, true)
  this.canPull = rBool(options.canPull, true)
  this.writeOnCreate = rBool(options.writeOnCreate, true)
  this.pusher = options.pusher // @todo. make sure it's a function? what about scripting.
  this.puller = options.puller
  this.apiType = options.apiType // exposed type name
  this.writePriority = rInt(options.writePriority, 0)
  this.deferWrites = Boolean(options.deferWrites)
  this.scoped = rBool(options.scoped, true)

  this._readAccess = (options.readAccess === acl.Inherit) ? acl.Inherit : acl.fixAllowLevel(options.readAccess, true, acl.AccessLevels.Read)
  this._writeAccess = (options.writeAccess === acl.Inherit) ? acl.Inherit : acl.fixAllowLevel(options.writeAccess, true, acl.AccessLevels.Update)
  this.aclOverride = rBool(options.aclOverride, false)
  this._acl = (options.acl === acl.Inherit) ? acl.Inherit : acl.mergeAndSanitizeEntries(options.acl)
  this.readable = rBool(options.readable, true)

  if (options.auditable !== Undefined) {
    this.auditable = options.auditable
  }
  if (options.auditing !== Undefined) {
    this.auditing = options.auditing
  }

  this.writable = rBool(options.writable, false)
  this.creatable = rBool(options.creatable, false)
  this.removable = rBool(options.removable, false)
  this.alwaysValidate = rBool(options.alwaysValidate, false)
  this.reader = options.reader
  this.groupReader = options.groupReader
  this.writer = options.writer
  this.remover = options.remover
  this.public = rBool(options.public, true)
  this.validators = toArray(options.validators)

  this.virtual = rBool(options.virtual, false)
  this.optional = rBool(options.optional, false)
  this.history = rBool(options.history, false)

  this.unique = rBool(options.unique, false)
  this.indexed = this.unique || rBool(options.indexed, false) // indexed. will cause property writes to appear in the index.
  // force a property to take a specific index slot
  if (isSet(options.indexSlot)) {
    this.indexSlot = {
      _id: this._id,
      unique: this.unique,
      name: modules.db.definitions[this.unique ? 'UNIQUE_SLOTS' : 'INDEX_SLOTS'][options.indexSlot]
    }
  }
  this.isIndexable = this.virtual ? false : rBool(options.isIndexable, this.isIndexable)
  this.nativeIndex = options.nativeIndex
  if (options.readerSearchOverride) this.readerSearchOverride = true // is actually backed by data.
  if (options.allowBenignProjectionAndGrouping) this.allowBenignProjectionAndGrouping = true // allowed in grouping anyway

  if (_.isFunction(options.onRemovingValue)) {
    this._onRemovingValue = options.onRemovingValue
  }
  if (_.isFunction(options.onValueAdded)) {
    this._onValueAdded = options.onValueAdded
  }
  if (_.isFunction(options.onInit)) {
    this._onInit = options.onInit
  }

  if (this.creatable) { // this to arrays as well.
    this.validators.push({
      name: 'adhoc',
      definition: {
        code: 'cortex.invalidArgument.creatableOnly',
        validator: function(ac, node) {
          return !this.isModified(node.docpath) || !!this.isNew
        }
      }
    })
  }

  // properties passed on to mongoose schemaType
  this.default = options.default
  this.select = options.select
  if (options.stub !== undefined) {
    if (_.isFunction(options.stub)) {
      this.stub = options.stub
    } else {
      const stub = options.stub
      this.stub = () => stub
    }
  }

  this.set = options.set ? toArray(options.set, true) : []
  this.get = options.get ? toArray(options.get, true) : []

  this._dependencies = modules.db.normalizeDependencies(options.dependencies || [])
  this.include = toArray(options.include) // top-level includes

  if (this.array) {
    if (this.minItems > 0) {
      this.validators.push({
        name: 'adhoc',
        definition: {
          code: 'cortex.invalidArgument.minItems',
          asArray: true,
          validator: function(ac, node, values) {
            if (values.length < node.minItems) {
              throw Fault.create('cortex.invalidArgument.minItems', { reason: 'Not enough items in the collection. length:' + values.length + ', min:' + node.minItems })
            }
            return true
          }
        }
      })
    }
    if (this.maxItems > -1) {
      this.validators.push({
        name: 'adhoc',
        definition: {
          code: 'cortex.invalidArgument.maxItems',
          asArray: true,
          validator: function(ac, node, values) {
            if (values.length > node.maxItems) {
              throw Fault.create('cortex.invalidArgument.maxItems', { reason: 'Too many items in the collection. length:' + values.length + ', max:' + node.maxItems })
            }
            return true
          }
        }
      })
    }

  }

  if (Array.isArray(options.defaultValue) && options.defaultValue.length) {
    const entry = options.defaultValue[0]
    if (entry) {
      this._defaultValue = entry // for export.
      if (entry.type === 'env') {
        this.defaultValue = this.constructor.defaultValues[entry.value]
      } else if (entry.type === 'static') {
        this.defaultValue = function() { return entry.value }
      } else if (entry.type === 'expression') {
        this.defaultValue = modules.expressions.parseExpression(decodeME(entry.value))
      }
    }
  }

  // override the default export function.
  if (_.isFunction(options.export)) {
    this.export = options.export
  } else if (options.export === false) {
    this.export = async() => Undefined
  }
  if (_.isFunction(options.import)) {
    this.import = options.import
  } else if (options.import === false) {
    this.import = async() => Undefined
  }
  if (isSet(options.exportAccess)) {
    this.exportAccess = acl.fixAllowLevel(options.exportAccess)
  }
  if (isSet(options.importAccess)) {
    this.importAccess = acl.fixAllowLevel(options.importAccess)
  }
  if (!this.uniqueKey && isSet(options.uniqueKey)) {
    this.uniqueKey = options.uniqueKey
  }

  this.mergeOverwrite = rBool(options.mergeOverwrite, this.array)

  // @todo. validators and attaching these to schema is still potentially a good thing, but will we ever use it?

  // -------------------------------
  // sanity checks for internals.

  // @todo. also, grouped reads cannot be expanded
  // if (this.groupReader && this.array) {
  //     throw Fault.create('cortex.unsupportedOperation.unspecified', {reason: 'properties with group readers must be virtual and non-arrays.'});
  /// }

}

PropertyDefinition.getMappingProperties = function() {
  return [{
    label: '_id',
    name: '_id',
    type: 'ObjectId'
  }, {
    label: 'Label',
    name: 'label',
    type: 'String'
  }, {
    label: 'Name',
    name: 'name',
    type: 'String'
  }, {
    label: 'Is Array',
    name: 'array',
    type: 'Boolean'
  }]
}

PropertyDefinition.getProperties = function(depth, props, Type) {

  props = [
    {
      label: '_id',
      name: '_id',
      type: 'ObjectId',
      // description: 'The property identifier',
      dependencies: ['.name'],
      readable: true,
      auto: true, // the id will be created in the document writer.
      onRemovingValue: function(ac, node) {

        setupDependencyChecks(ac)

        const instancePath = modules.db.definitions.getInstancePath(this, node)

        ac.object.schema.node.walkDocument(
          modules.db.getRootDocument(this),
          function(d, n, v) {
            if (n.name === 'dependencies') {
              if (Array.isArray(d.dependencies) && d.dependencies.includes(instancePath)) {
                d.markModified('dependencies')
              }
            }
          },
          {
            filter: ['properties', 'documents', 'objectTypes', 'dependencies']
          }
        )

      }
    },
    {
      label: 'Label',
      name: 'label',
      type: 'String',
      // description: 'The property label.',
      readable: true,
      writable: true,
      localization: {
        enabled: true,
        strict: false,
        fallback: true
      },
      validators: [{
        name: 'required'
      }, {
        name: 'string',
        definition: {
          min: 1,
          max: 128
        }
      }]
    },
    {
      label: 'Alias',
      name: '_alias',
      type: 'String',
      // description: 'The old property aliases. left here for backwards compat file reaping.',
      readable: false
    },
    {
      label: 'Deployment Identifiers',
      name: 'did',
      type: 'ObjectId',
      readable: false,
      array: true
    },
    {
      label: 'Name',
      name: 'name',
      type: 'String',
      // description: 'The property name. The name is used as a discriminator in Set properties, and as the property name in schemas.',
      readable: true,
      writable: true,
      trim: true,
      dependencies: ['deletedProperties', 'objectTypes', 'feedDefinition'],
      validators: [{
        name: 'required'
      }, {
        name: 'customName'
      }, {
        name: 'uniqueInArray'
      }, {
        name: 'adhoc',
        definition: {
          message: 'This property name is not available for use.',
          validator: function(ac, node) {
            const fq = modules.db.definitions.getInstancePath(this, node, true)
            return toArray(ac.subject.deletedProperties).filter(deleted => deleted.fq === fq).length === 0
          }
        }
      }],
      writer: function(ac, node, v) {
        return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(v))
      }
    },
    {
      label: 'Description',
      name: 'description',
      type: 'String',
      // description: 'The property description.',
      readable: true,
      writable: true,
      localization: {
        enabled: true,
        strict: false,
        fallback: true
      },
      validators: [{
        name: 'string',
        definition: {
          min: 0,
          max: 1024
        }
      }]
    },
    {
      label: 'Is Array',
      name: 'array',
      type: 'Boolean',
      // description: 'Mark this property as an array of the specified type. It cannot changed once the property has been created.',
      default: false,
      readable: true,
      creatable: true
    },
    {
      label: 'Unique Values',
      name: 'uniqueValues',
      type: 'Boolean',
      // description: 'Applies to arrays. Values in the array are guaranteed to be unique. Supported by most primitive types.',
      default: false,
      readable: true,
      writable: true
    },
    {
      label: 'Min Items',
      name: 'minItems',
      type: 'Number',
      // description: 'Applies to arrays. The minimum number of items required in the array.',
      default: 0,
      readable: true,
      writable: true,
      validators: [{
        name: 'required'
      }, {
        name: 'number',
        definition: {
          allowNull: false,
          min: 0,
          max: 1000,
          allowDecimal: false
        }
      }]
    },
    {
      label: 'Max Items',
      name: 'maxItems',
      type: 'Number',
      // description: 'Applies to arrays. The maximum number of items allowed in the array.',
      default: 100,
      readable: true,
      writable: true,
      dependencies: ['.minItems'],
      validators: [{
        name: 'number',
        definition: {
          allowNull: false,
          min: 0,
          max: 1000,
          allowDecimal: false
        }
      }, {
        name: 'adhoc',
        definition: {
          name: 'adhoc',
          message: 'maxItems must be >= minItems',
          validator: function(ac, node, value) {
            return value === -1 || value >= this.minItems
          }
        }
      }]
    },
    {
      label: 'Dependencies',
      name: 'dependencies',
      type: 'String',
      // description: dependencies for write ordering (default values)
      array: true,
      maxItems: 20,
      uniqueValues: true,
      writable: true,
      default: [],
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'A valid property path name',
          validator: async function(ac, node, dep) {
            setupDependencyChecks(ac)
            return testDependencyPaths(this, ac, node, dep)
          }
        }
      }]
    },
    {
      label: 'Include',
      name: 'include',
      type: 'String',
      // description: top-level includes for readers/writers and triggers. these prop will always be loaded.
      array: true,
      maxItems: 20,
      uniqueValues: true,
      writable: true,
      default: [],
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'A valid property path name',
          validator: async function(ac, node, dep) {
            return testDependencyPaths(this, ac, node, dep)
          }
        }
      }]
    },
    properties.readAccess,
    properties.writeAccess,
    properties.acl,
    {
      label: 'ACL Override',
      name: 'aclOverride',
      type: 'Boolean',
      // description: 'resets acl for read and write operations',
      default: false,
      readable: true,
      writable: true
    },
    new local.ValidatorDefinition({
      // @todo. update to SetDefinition (multi schema)
      label: 'Validators',
      name: 'validators',
      type: 'Document',
      // description: 'A list of validators applied against this property.',
      readable: true,
      writable: true,
      canPush: true,
      canPull: true,
      array: true,
      mergeOverwrite: true,
      uniqueKey: 'name'
    }),
    {
      label: 'Public',
      name: 'public',
      type: 'Boolean',
      // description: 'If false, the property definition is not exposed to the client api.',
      public: false,
      readable: true,
      writable: true,
      default: true
    },
    {
      label: 'Max Shift',
      name: 'maxShift',
      // description: 'Applies to arrays. When true, shifts older items off the front of the array when max items is reached instead of producing a cortex.invalidArgument.maxAllowed fault',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false,
      validators: [{
        name: 'required'
      }]
    },
    {
      label: 'Can Push',
      name: 'canPush',
      // description: 'Applies to arrays. Can POST be used to push items onto the end of the array.',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: true,
      validators: [{
        name: 'required'
      }]
    },
    {
      label: 'Write on Create',
      name: 'writeOnCreate',
      // description: 'Applies to arrays. For new documents, allow use of the writer (overwrite) if no pusher is present and canPush is false.',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: true,
      validators: [{
        name: 'required'
      }]
    },
    {
      label: 'Can Pull',
      name: 'canPull',
      // description: 'Applies to arrays. Can DELETE be used to remove items from this array, by value or by identifier.',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: true,
      validators: [{
        name: 'required'
      }]
    },
    {
      label: 'Auditable',
      name: 'auditable',
      type: 'Boolean',
      // description: 'Set this property as auditable. changes to the property will be logged as an audit',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'History',
      name: 'history',
      type: 'Boolean',
      // description: 'Store property history',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Readable',
      name: 'readable',
      type: 'Boolean',
      // description: 'Set this property as readable. Non-readable properties are completely hidden from use.',
      readable: true,
      writable: true,
      default: true,
      validators: [{
        name: 'required'
      }]
    },
    {
      label: 'Writable',
      name: 'writable',
      type: 'Boolean',
      // description: 'Set this property as writable through the api.',
      readable: true,
      writable: true,
      default: true,
      validators: [{
        name: 'required'
      }]
    },
    {
      label: 'Creatable',
      name: 'creatable',
      type: 'Boolean',
      // description: 'If true, this property can only be written on creation.',
      default: false,
      readable: true,
      writable: true,
      validators: [{
        name: 'required'
      }]
    },
    {
      label: 'Removable',
      name: 'removable',
      type: 'Boolean',
      // description: 'If true, this property can be delete using the context DELETE apis.',
      default: false,
      readable: true,
      writable: true,
      validators: [{
        name: 'required'
      }]
    },
    {
      label: 'Optional',
      name: 'optional',
      type: 'Boolean',
      // description: 'If true, this property is not fetched unless it is explicitly included using the "include" option. This can dramatically decrease load times/transfer sizes for things like scripted items, large array sets, and for item lists with lots of properties. It is good pratice to use the "paths" option to fetch only what is needed when paging through context object lists.',
      default: false,
      readable: true,
      writable: true,
      validators: [{
        name: 'required'
      }]
    },
    {
      label: 'Indexed',
      name: 'indexed',
      type: 'Boolean',
      // description: 'If true, this property is indexed, allowing to be included in searches.',
      default: false,
      writable: true,
      dependencies: ['.unique', 'lookup'],
      onRemovingValue: function(ac, node, value, index) {
        void index
        if (value === true) {
          node._registerIndexUpdate(ac, this)
        }
      },
      writer: function(ac, node, indexed) {

        // find the parent property set and register the change.
        node._registerIndexUpdate(ac, this)
        return !!indexed

      },
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'Unique properties must also be indexed.',
          validator: function(ac, node, indexed) {
            return indexed || !this.unique
          }
        }
      }]
    },
    {
      label: 'Unique',
      name: 'unique',
      type: 'Boolean',
      // description: 'The property will be unique across the entire data set. Though not unique in the array. To achieve unique values within an array, use the uniqueValues property.',
      default: false,
      writable: true,
      dependencies: ['.indexed', 'lookup'],
      onRemovingValue: function(ac, node, value, index) {
        void index
        if (value === true) {
          node._registerIndexUpdate(ac, this)
        }
      },
      writer: function(ac, node, unique) {

        // find the parent property set and register the change.
        node._registerIndexUpdate(ac, this)
        return !!unique

      },
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'Unique properties must also be indexed.',
          validator: function(ac, node, unique) {
            return !unique || this.indexed
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Properties can only be made unique on creation.',
          validator: function(ac, node, unique) {
            return this.isNew || !unique
          }
        }
      }]
    },
    {

      // ------------------------------------------------------------------------------
      // for sets only.

      label: '_id',
      name: '_id',
      type: 'ObjectId',
      // description: 'The segment identifier.',
      readable: true,
      auto: true

      // ------------------------------------------------------------------------------
      // internal properties, used to cover hidden, internal mongoose options to pass on to schema generation.

    },
    {
      label: 'Stub Value',
      name: 'stub',
      type: 'Any',
      // description: 'A stub value to return when no value exists in the document.',
      readable: false,
      writable: false,
      public: false
    },
    {
      label: 'Virtual',
      name: 'virtual',
      type: 'Boolean',
      // description: 'If true, this property value is not persisted, and requires custom reader and writer to function.',
      readable: true,
      writable: false,
      public: false
    },
    {
      label: 'Group Reader',
      name: 'groupReader',
      type: 'Any',
      // description: 'Internal use only. Group reader function.',
      public: false,
      readable: false,
      writable: false
    },
    {
      label: 'Getter',
      name: 'get',
      type: 'Any',
      // description: 'Internal use only. Mongoose synchronous getter.',
      public: false,
      readable: false,
      writable: false
    },
    {
      label: 'Setter',
      name: 'set',
      type: 'Any',
      // description: 'Internal use only. Mongoose synchronous setter.',
      public: false,
      readable: false,
      writable: false
    }]

  const documents = [{
    label: 'Expression',
    name: 'expression',
    properties: [{
      label: 'Value',
      name: 'value',
      writable: true,
      type: 'Expression'
    }]
  }]

  if (Type.defaultValues) {

    documents.push({
      label: 'Environment',
      name: 'env',
      properties: [{
        label: 'Value',
        name: 'value',
        type: 'String',
        writable: true,
        dependencies: ['.type'],
        validators: [{
          name: 'stringEnum',
          definition: {
            values: Object.keys(Type.defaultValues)
          }
        }]
      }]
    })

    if (Type.staticDefaultValues) {
      documents.push({
        label: 'Static',
        name: 'static',
        properties: [{
          label: 'Value',
          name: 'value',
          writable: true,
          type: Type.typeName
        }]
      })
    }
  }

  props.push({
    label: 'Default Value',
    name: 'defaultValue',
    type: 'Set',
    writable: true,
    minItems: 0,
    maxItems: 1,
    canPush: false,
    canPull: false,
    mergeOverwrite: true,
    discriminatorKey: 'type',
    documents
  })

  return props

}

PropertyDefinition.equals = function(a, b) {
  if (a && b) {
    return a.name && b.name && a.name === b.name
  }
  return false
}

PropertyDefinition.prototype.equals = function(a, b) {
  if (isSet(a) && isSet(b)) {
    return a === b
  }
  return false
}

PropertyDefinition.prototype.compare = function(a, b) {
  return naturalCmp(a, b)
}

PropertyDefinition.prototype.__PropDef__ = true
PropertyDefinition.prototype.isIndexable = true

PropertyDefinition.prototype.getTypeName = function() {
  throw new Error('cortex.error.pureVirtual')
}

PropertyDefinition.prototype.getPublicTypeName = function() {
  return this.apiType || this.getTypeName()
}

PropertyDefinition.prototype.isPrimitive = function() {
  return true
}

PropertyDefinition.prototype.getMongooseType = function() {

  const Type = this.constructor
  return this.array ? [Type.mongooseType] : Type.mongooseType

}

PropertyDefinition.prototype.getRuntimeOption = function(option, document) {

  if (_.isFunction(this[option])) {
    return document ? this[option].call(document) : null
  }
  return this[option]

}

PropertyDefinition.prototype.apiSchema = function(options) {

  if (!this.public || !this.readable || this.readAccess > acl.AccessLevels.Delete) {
    return null
  }

  const schema = {
    label: this.label || this.name,
    name: this.name,
    type: this.apiType || (this.getTypeName() + (this.array ? '[]' : '')),
    read: this.readAccess,
    fqpp: this.fqpp
  }
  if (this.array) {
    schema.array = true
  }

  if (getOption(options, 'verbose')) {
    schema.description = this.description || ''
  }

  if (this.optional) schema.optional = true
  if (this.indexed || this.nativeIndex) schema.indexed = true
  if (this.unique) schema.unique = true
  if (this.auditable) schema.auditable = true
  if (this.history) schema.history = true

  let overwritable, writable = this.writeAccess < acl.AccessLevels.System && (this.writable || this.creatable || (this.array && (this.canPush || this.canPull)))

  if (this.array) {
    overwritable = writable && this.writable
  } else {
    overwritable = writable
  }

  schema.readOnly = !writable

  if (writable) {
    schema.create = this.writeAccess
    if (!this.creatable && overwritable) {
      schema.update = this.writeAccess
    }
    if (this.removable) {
      schema.delete = this.writeAccess
    }
  }

  if (writable && this.array) {

    schema.uniqueValues = this.uniqueValues
    schema.minItems = this.minItems
    schema.maxItems = this.maxItems
    schema.maxShift = this.maxShift

    if (this.canPush) {
      schema.push = this.writeAccess
    }
    if (this.canPull) {
      schema.pull = this.writeAccess
    }
  }

  if (writable && this.validators.length) {
    let hasDefault = (this.default !== undefined),
        validators = this.validators.filter(function(v) {
          if (v.name === 'required') {
            if (!hasDefault) {
              schema.required = true
            }
            return false
          }
          return ~modules.validation.exposed.indexOf(v.name)
        })

    if (validators.length) {
      schema.validators = validators.map(function(entry) {
        let definition = entry.definition || undefined
        try {
          if (definition && definition._dat_) {
            definition = deserializeObject(definition._dat_)
          } else if (definition) {
            definition = clone(definition)
          }
        } catch (err) {
          definition = undefined
        }
        return {
          name: entry.name,
          definition: definition
        }
      })
    }
  }

  // the schemas get too large with this included
  // if (this.constructor.defaultValues) {
  //   schema.defaultOptions = Object.keys(this.constructor.defaultValues).sort()
  // }

  return schema

}

/**
 *
 * @param parentPath
 * @param options
 *  nodePath substitutePath
 * @returns {*}
 */
PropertyDefinition.prototype.getExportResourcePath = function(parentPath, options) {

  return joinPaths(parentPath, getOption(options, 'nodePath', this.path))

}

PropertyDefinition.prototype.isUniqueKey = function() {

  return this.parent && this.parent.uniqueKey && (this.parent.uniqueKey === this.docpath)

}

PropertyDefinition.prototype.hasExportAccess = function() {

  const requiredLevel = acl.fixAllowLevel(this.exportAccess, false, acl.AccessLevels.Delete),
        readable = this.readable && this.readAccess <= requiredLevel,
        writable = this.writeAccess <= requiredLevel &&
          (this.isUniqueKey() ||
              ((this.isSetDocument && this.parent.isWritable()) || this.isWritable() || !this.parent)
          )

  return Boolean(readable && writable)
}

PropertyDefinition.prototype.hasImportAccess = function() {

  const requiredLevel = acl.fixAllowLevel(this.importAccess, false, acl.AccessLevels.Delete),
        readable = this.readable && this.readAccess <= requiredLevel,
        writable = this.writeAccess <= requiredLevel &&
      (this.isUniqueKey() ||
        ((this.isSetDocument && this.parent.isWritable()) || this.isWritable() || !this.parent)
      )

  return Boolean(readable && writable)
}

/**
 * @param ac
 * @param value
 * @param resourceStream
 * @param resourcePath
 * @param parentPath
 * @param options
 *  required - set to true if this is being required by a dependent resource
 * @returns {boolean}
 */
PropertyDefinition.prototype.isExportable = function(ac, value, resourceStream, resourcePath, parentPath, options) {

  const required = getOption(options, 'required')
  if (required || resourceStream.accept(resourcePath)) {
    return this.hasExportAccess()
  }
  return false

}

PropertyDefinition.prototype.isImportable = function(ac, value, resourceStream, resourcePath, parentPath, options) {

  const required = getOption(options, 'required')
  if (required || resourceStream.accept(resourcePath)) {
    return this.hasImportAccess()
  }
  return false

}

PropertyDefinition.prototype.export = async function(ac, value, resourceStream, parentPath, options) {
  const resourcePath = this.getExportResourcePath(parentPath, options)
  return this.isExportable(ac, value, resourceStream, resourcePath, parentPath, options)
    ? value
    : Undefined
}

PropertyDefinition.prototype.import = async function(ac, value, resourceStream, parentPath, options) {
  const resourcePath = this.getExportResourcePath(parentPath, options)
  return this.isImportable(ac, value, resourceStream, resourcePath, parentPath, options)
    ? value
    : Undefined
}

/**
 * Generates a mongoose schema for use in runtime models.
 * @param options
 *  location: 'property' or 'segment'. the output merges either the "property" or "segment" definition options with the root.
 * @param callback
 */
/**
 * Generates a runtime property definition.
 *
 * @param inSet
 */
PropertyDefinition.prototype.generateMongooseProperty = function(inSet) {

  void inSet

  let runtime = {
    type: this.getMongooseType(),

    acValidation: toArray(this.validators).map(function(v) {
      // validator definitions are Any types for now.
      let def = v.definition
      if (def && def._dat_) {
        def = deserializeObject(def._dat_)
      }
      return def ? [v.name, def] : [v.name]
    }),

    virtual: !!this.virtual,

    propertyNode: this // turns into "node" backpointer from the schema.
  }

  if (this.set) runtime.set = this.set
  if (this.get) runtime.get = this.get

  if (this.select != null) runtime.select = this.select
  if (this.default !== undefined) runtime.default = this.default

  return runtime

}

PropertyDefinition.prototype._discernNode = function() {
  return null
}

PropertyDefinition.prototype.isWritable = function(ac) {
  void ac
  return (this.writable || this.creatable || (this.array && this.canPush))
}

PropertyDefinition.prototype.getResourcePath = function(ac, document, selection) {
  return this.array ? `${this.path}[]` : this.path
}

PropertyDefinition.prototype.aclAccess = function(ac, parentDocument, parts, options, callback) {

  if (!this.readable) {
    return callback(Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: this.fqpp }))
  }

  parts = normalizeAcPathParts(parts)

  if (parts.length === 0) {
    callback(null, {
      ...ac.toObject(),
      creatable: Boolean(options.bypassCreateAcl || ac.principal.bypassCreateAcl || ac.canCreate(options.createAcl, options.createAclOverride)),
      property: {
        fqpp: this.fqpp,
        access: this.getRuntimeAccess(ac)
      }
    })
  } else {
    callback(Fault.create('cortex.notFound.pathEndedPrematurely', { resource: ac.getResource(), path: this.fqpp }))
  }

}

PropertyDefinition.prototype.aclRead = function(ac, parentDocument, selection) {

  if (!this.readable) {
    if (ac.passive || selection.passive) {
      return undefined
    }
    throw Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: this.fullpath })
  }
  if (!this.hasReadAccess(ac)) {
    if ((ac.passive || selection.passive) && ac.propPath !== this.fullpath) {
      return undefined
    }
    throw Fault.create('cortex.accessDenied.propertyRead', { resource: ac.getResource(), path: this.fullpath })
  }

  if (this.path) {
    ac.addPath(this.path)
    ac.pushResource(this.getResourcePath(ac, parentDocument, selection))
  }

  let result, handled = !!this._compiledReader
  if (handled) {

    result = (this._compiledReader).call(parentDocument, ac, this, selection)
    if (result instanceof UnhandledResult) {
      handled = false
      result = result.result
    }

  } else {

    // always bypass getters and apply them here, because we don't know if we have a mongoose or plain doc.
    result = (parentDocument.getValue && parentDocument.getValue(selection.pathOverride || this.docpath)) || pathTo(parentDocument, selection.pathOverride || this.docpath)
    this.get.length && (result = this.get.reduce((v, fn) => fn.call(parentDocument, v), result))

    if (result === undefined) {
      if (this.array) {
        if (this.stub !== undefined) {
          result = toArray(this.stub(), true)
        } else if (!parentDocument.getValue && this.default !== undefined) { // have to handle default for plain docs.
          if (_.isFunction(this.default)) {
            result = this.default()
          } else {
            result = this.default
          }
        } else {
          result = []
        }
      } else if (this.stub !== undefined) {
        result = this.stub()
      } else if (!parentDocument.getValue && this.default !== undefined) { // have to handle default for plain docs.
        if (_.isFunction(this.default)) {
          result = this.default.call(parentDocument)
        } else {
          result = this.default
        }
      }
    }

  }

  if (!(result instanceof DeferredRead)) {
    if (!this.array) {
      result = this._readSingleResult(ac, parentDocument, result, handled, selection)
    } else {
      result = this._readArrayResult(ac, parentDocument, toArray(result, !Array.isArray(result)), handled, selection)
      if (selection.getTreatAsIndividualProperty() === true) {
        result = _.isArray(result) ? result[0] : result
      }
    }
  }

  if (this.path) {
    ac.delPath()
    ac.popResource()
  }

  return result

}

/**
 * @param value the payload object, which may look like {0: 'value', 1: 'value'}, meaning an indexed path update was requested.
 */
PropertyDefinition.prototype.assertPayloadValueIsSane = function(ac, value) {

  // do not allow updates via index.
  // @todo allow these if the client is sending a version number.

  if (isPlainObject(value) && !this.virtual) {
    if (_.every(Object.keys(value), function(key) { return isInteger(key) })) {
      throw Fault.create('cortex.notImplemented.indexedArrayUpdates', { resource: ac.getResource(), path: this.fullpath })
    } else {
      throw Fault.create('cortex.invalidArgument.primitiveExpected', { resource: ac.getResource(), path: this.fullpath })
    }
  }
}

PropertyDefinition.prototype.aclRemove = function(ac, parentDocument, value, callback_) {

  const callback = (err) => {
    ac.popResource()
    callback_(err)
  }
  ac.pushResource(this.getResourcePath(ac, parentDocument))

  if (!this.readable) {
    return callback(ac.passive ? null : Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: this.fullpath }))
  } else if (!this.isWritable(ac)) {
    return callback(ac.passive ? null : Fault.create('cortex.accessDenied.notWritable', { resource: ac.getResource(), path: this.fullpath }))
  } else if (value === undefined && !this.removable) {
    return callback(ac.passive ? null : Fault.create('cortex.accessDenied.notDeletable', { resource: ac.getResource(), path: this.fullpath }))
  } else if (value !== undefined && this.array && !this.canPull) {
    return callback(ac.passive ? null : Fault.create('cortex.accessDenied.notPullable', { resource: ac.getResource(), path: this.fullpath }))
  } else if (!this.hasWriteAccess(ac)) {
    return callback(ac.passive ? null : Fault.create('cortex.accessDenied.propertyDelete', { resource: ac.getResource(), path: this.fullpath }))
  }

  // removing entire property.
  if (value === undefined) {
    this._removeProperty(ac, parentDocument, callback)
  } else {
    this._removeElement(ac, parentDocument, value, callback)
  }

}

PropertyDefinition.prototype._castValue = function(parentDocument, value) {
  return parentDocument.schema.path(this.docpath).caster.cast(value)
}

PropertyDefinition.prototype._indexOf = function(parentDocument, value) {

  if (this.array) {
    const current = pathTo(parentDocument, this.docpath)
    if (Array.isArray(current)) {
      return current.indexOf(value)
    }
  }
  return -1

}

PropertyDefinition.prototype._equals = function(a, b) {

  // eslint-disable-next-line eqeqeq
  return this.isPrimitive() && a == b

}

PropertyDefinition.prototype._indexesOf = function(parentDocument, value) {
  const indexes = []
  if (this.array) {
    const current = pathTo(parentDocument, this.docpath)
    if (Array.isArray(current)) {
      return current.reduce((indexes, value_, index) => {
        if (this._equals(value, value_)) {
          indexes.push(index)
        }
        return indexes
      }, indexes)
    }
  }
  return indexes
}

PropertyDefinition.prototype.onValueAdded = function(ac, parentDocument, value, previous = undefined, index = null) {

  if (this.root.onPropertyValueAdded) {
    this.root.onPropertyValueAdded(ac, this, parentDocument, value, index)
  }

  this._checkShouldRecordHistory(ac, parentDocument, value, previous, index, index === null ? consts.history.operations.set : consts.history.operations.push)
  this._checkShouldAuditWrite(ac, parentDocument, value, previous, index, index === null ? consts.audits.operations.set : consts.audits.operations.push)
  this._checkShouldReIndex(ac, parentDocument)

  if (this._onValueAdded) {
    this._onValueAdded.call(parentDocument, ac, this, value, previous, index)
  }
}

/**
 * @param ac
 * @param parentDocument
 * @param value
 * @param index a specific index. if not present and an array, assume a pull was made and all matching items will be removed, affecting multiple indexes.
 * @param forModification - guarantees onValueAdded will be immediately called; the value is updating and not being removed
 */
PropertyDefinition.prototype.onRemovingValue = function(ac, parentDocument, value, index = null, forModification = false) {

  if (this.root.onPropertyRemovingValue) {
    this.root.onPropertyRemovingValue(ac, this, parentDocument, value, index)
  }

  this._checkShouldReIndex(ac, parentDocument)

  if (this._onRemovingValue) {
    this._onRemovingValue.call(parentDocument, ac, this, value, index)
  }

  if (!forModification) {
    this._checkShouldRecordHistory(ac, parentDocument, value, undefined, index, index === null ? consts.history.operations.remove : consts.history.operations.pull)
    this._checkShouldAuditWrite(ac, parentDocument, value, undefined, index, index == null ? consts.audits.operations.remove : consts.audits.operations.pull)
  }

}

PropertyDefinition.prototype._registerIndexUpdate = function(ac, parentDocument) {

  const node = this._getPropertySetNode(parentDocument)
  if (node) {
    node.registerIndexUpdate(ac, parentDocument)
  }
}

PropertyDefinition.prototype._getPropertySetNode = function(parentDocument) {

  let doc = parentDocument
  while (doc) {
    if (pathTo(doc, 'schema.node.parent') instanceof local.PropertySetDefinition) {
      return doc.schema.node.parent
    }
    doc = modules.db.getParentDocument(doc)
  }
  return null
}

PropertyDefinition.prototype._getHistoryValue = function(ac, rootDocument, value, previous, index, operation) {

  const { remove, pull, push } = consts.audits.operations,
        useCurrentValue = [remove, pull, push].includes(operation)

  if (useCurrentValue) {
    return value
  }

  return ac.org.configuration.legacyAuditHistoryValues
    ? rVal(previous, value)
    : previous

}

PropertyDefinition.prototype._updateHistoryDocument = function(ac, op, changes) {

  const subject = ac.subject,
        newValue = digIntoResolved(subject._doc, op.path, true, true)

  if (newValue !== undefined) {
    pathToPayload(op.path, newValue, changes.document)
  }

}

PropertyDefinition.prototype._checkShouldRecordHistory = function(ac, parentDocument, value, previous, index, operation) {

  if (this.history && !(ac.object && ac.object.isUnmanaged)) {

    const doc = modules.db.getRootDocument(parentDocument)

    if (doc.isNew) {
      // return
    } else if (!doc.isSelected('hist')) {
      logger.error('history is not selected for recording!')
      return
    } else if (doc !== ac.subject) {
      logger.error('subject does not match root document for history recording!')
      return
    }

    if (!Array.isArray(ac.subject.hist)) {
      ac.subject.hist = []
    }

    let op,
        sequence = doc.isNew ? 0 : rInt(doc.sequence, 0) + 1,
        path = modules.db.definitions.getFullyMaterializedPropertyPathParts(parentDocument, parentDocument.schema ? parentDocument.schema.node : this, false).slice(2).concat(this.docpath).join('.'),
        changes = ac.subject.hist.find(v => equalIds(v._id, ac._id)),
        historyValue = this._getHistoryValue(ac, doc, value, previous, index, operation)

    if (!changes) {
      changes = {
        ac, // store the ac because the hook might involve multiple acs and we want data from it.
        _id: ac._id,
        context: {
          _id: ac.subject._id,
          object: ac.subject.object,
          updater: ac.principal._id,
          updated: new Date(),
          sequence: sequence
        },
        ops: [],
        document: {}
      }
      if (ac.object.isVersioned) {
        changes.context.version = doc.isNew ? 0 : rInt(doc.version, 0) + 1
      }
      ac.subject.hist.push(changes)
    }

    // get the existing raw value and store it in the changes
    op = {
      pid: this._id,
      updater: ac.principal._id,
      type: operation,
      path,
      node: this
    }
    if (historyValue !== Undefined || ac.org.configuration.legacyAuditHistoryValues) {
      op.value = historyValue
    }

    index = rInt(index, undefined)
    if (index !== undefined) {
      op.index = index
    }
    changes.ops.push(op)

    ac.hook('save').before((vars, callback) => {

      if (Array.isArray(vars.ac.subject.hist)) {

        const changes = vars.ac.subject.hist.filter(v => v.ac instanceof acl.AccessContext)

        if (changes.length) {

          changes.forEach(changes => {

            const ac = changes.ac,
                  subject = ac.subject,
                  message = ac.option('$historyMessage') // might have been written later in the process

            delete changes.ac

            changes.ops.forEach(op => {
              op.node._updateHistoryDocument(ac, op, changes)
              delete op.node
            })

            if (message) {
              changes.message = message
            }

            subject.meta.up.addToSet(consts.metadata.updateBits.history)
            ac.subject.markModified('hist')

          })

          ac.hook('save').after(() => {
            modules.workers.runNow('history-processor')
          }, 'run-history-processor', true)
        }

      }

      callback()

    }, 'process-history', true)

  }

}

PropertyDefinition.prototype._checkShouldAuditWrite = function(ac, parentDocument, value, previous, index, operation) {

  if (!ac.object || ac.object.isUnmanaged || !acl.isAccessSubject(modules.db.getRootDocument(parentDocument))) {
    return
  }

  const doc = modules.db.getRootDocument(parentDocument),
        category = this.auditing.category || pathTo(ac.object, 'auditing.category'),
        subcategory = this.auditing.updateSubcategory,
        storeChanges = this.auditing.changes

  if (doc !== ac.subject) {
    logger.error(`subject does not match root document for audit recording. node: ${this.fqpp}, subject: ${ac.subjectId}`)
    return
  } else if (!category) {
    logger.error(`the object has no auditing category. node: ${this.fqpp}, subject: ${ac.subjectId}`)
    return
  }

  // ensure at least something gets stored for each instance at a macro level, even if no property changes were audited.
  if (ac.object.auditing.enabled || this.auditable) {
    ac.hook('save').after(PropertyDefinition._processAudit, 'context-audit-event', true)
  }

  // get the top context because options may only be found there.
  let topAc = ac,
      auditChanges,
      objectChanges,
      contextChanges,
      subcategoryMetadata,
      path = modules.db.definitions.getFullyMaterializedPropertyPathParts(parentDocument, parentDocument.schema ? parentDocument.schema.node : this, false).slice(2).concat(this.docpath).join('.'),
      op,
      defaultMetadata = {
        updater: ac.principal._id,
        updated: new Date(),
        ops: [],
        document: storeChanges ? {} : Undefined,
        version: ac.object.isVersioned ? (doc.isNew ? 0 : rInt(doc.version, 0) + 1) : Undefined
      }

  while (topAc.$__parentAc) {
    topAc = topAc.$__parentAc
  }

  auditChanges = topAc.option('$auditChanges')
  if (!auditChanges) {
    auditChanges = {}
    topAc.option('$auditChanges', auditChanges)
  }

  // separate by object, contexts, categories and subcategories.
  objectChanges = auditChanges[ac.objectName] || (auditChanges[ac.objectName] = {
    category,
    contexts: {}
  })

  contextChanges = objectChanges.contexts[ac.subjectId] || (objectChanges.contexts[ac.subjectId] = {
    ac,
    subcategories: {}
  })

  // to force at least a change update even if there are no ops.
  if (ac.object.auditing.enabled && !contextChanges.subcategories.update && category === 'update') {
    contextChanges.subcategories.update = defaultMetadata
  }

  // the above is the minimum required to at least force an update for an audit enabled object, even if no property changes are audited.
  if (!this.auditable) {
    return
  }

  subcategoryMetadata = contextChanges.subcategories[subcategory] || (contextChanges.subcategories[subcategory] = defaultMetadata)

  // get the existing raw value and store it in the changes
  op = {
    pid: this._id,
    updater: ac.principal._id,
    type: operation,
    path: path,
    value: storeChanges ? rVal(previous, value) : Undefined

  }
  index = rInt(index, undefined)
  if (index !== undefined) {
    op.index = index
  }
  subcategoryMetadata.ops.push(op)

}

PropertyDefinition._processAudit = function(vars, callback) {

  const auditChanges = vars.ac.option('$auditChanges'),
        tasks = []

  for (const objectChanges of Object.values(auditChanges)) {

    for (const contextChanges of Object.values(objectChanges.contexts)) {

      const ac = contextChanges.ac

      for (let [subcategory, metadata] of Object.entries(contextChanges.subcategories)) {

        // if there are no ops, this is simple top-level update record. don't store an empty metadata object.
        // a a document exists, we're expecting to storeChanges
        if (Object.keys(metadata).length === 0) {

          metadata = Undefined

        } else if (metadata.document) {

          metadata.ops.forEach(op => {
            const newValue = digIntoResolved(ac.subject._doc, op.path, true, true)
            if (newValue !== undefined) {
              pathToPayload(op.path, newValue, metadata.document)
            }
          })

        }

        tasks.push(((ac, category, subcategory, options) => {
          return callback => {
            modules.audit.recordEvent(ac, category, subcategory, options, callback)
          }
        })(ac, objectChanges.category, subcategory, { context: ac.subject, metadata }))

      }

    }

  }

  async.series(tasks, callback)

}

PropertyDefinition.prototype.forceImmediateIndexRebuild = function(ac, parentDocument, callback) {

  const top = modules.db.getRootDocument(parentDocument)
  if (top !== ac.subject) {
    logger.error('top doc does not match index rebuild target')
  }

  let err = null
  if (this.unique || this.indexed) {
    ac.indexRebuilds.add(this)
    try {
      ac.rebuildSubjectIndex()
    } catch (e) {
      err = e
    }
  }
  callback(err)

}

PropertyDefinition.prototype._checkShouldReIndex = function(ac, parentDocument) {

  // rebuild the index for this property. because we want exact matches, we *must* ensure
  // the entire array is loaded. for deeply nested properties, this implementation will
  // fail if we ever change how selections work. at the moment, all array siblings are sure to be loaded.

  const top = modules.db.getRootDocument(parentDocument)
  if (top !== ac.subject) {
    logger.error('top doc does not match index rebuild target')
  }
  if (this.unique || this.indexed) {
    ac.indexRebuilds.add(this)
  }
}

PropertyDefinition.prototype.getIndexableValue = function(rootDocument, parentDocument, node, value) {
  return value
}

PropertyDefinition.prototype._rebuildPropertyIndex = function(document) {

  if (!isInt(document.idx.v)) {
    document.idx.v = 0
  }
  if (!isPlainObject(document.idx.d)) {
    document.idx.d = {}
    document.markModified('idx.d')
  }

  let slots = document.constructor.schema.node.slots,
      slot = _.find(slots, slot => equalIds(slot._id, this._id) && !slot.refName),
      len,
      values = [], // find every branch document and include in the index.
      exists = false // some items will not exist in the index because they have no documents at all. like an indexed document array property that does not exist.

  if (!slot) {
    return
  }
  if (!this.indexed) {
    if (document.idx.d[slot.name]) {
      delete document.idx.d[slot.name]
      document.markModified('idx.d')
    }
    return
  }

  this.root.walkDocument(document, (parentDocument, node, value) => {

    // found node.
    if (equalIds(node._id, this._id)) {
      let indexable = this.getIndexableValue(document, parentDocument, node, value)
      if (indexable !== undefined) {
        exists = true // if undefined, the property should not be indexed as it does not exist.
        values = values.concat(indexable)
      }
      return -2 // return -1 at the end of this array
    }

  })

  // to save space, only store unique values. properties marked as unique must complain right here if there are duplicate values in the array.
  // otherwise, the index won't catch it.
  len = values.length
  values = this._getUniqueArrayValues(values).filter(v => v !== Undefined)
  if (this.unique && values.length !== len) {
    throw Fault.validationError('cortex.conflict.duplicateKey', { path: this.fullpath })
  }

  // unique empty arrays don't work! $size will not work for unique arrays.
  if (!exists || (len === 0 && slot.unique)) {

    // the property does not exist anywhere in the document. remove the index entry altogether.
    if (document.idx.d[slot.name]) {
      delete document.idx.d[slot.name]
      document.markModified('idx.d')
    }

  } else {

    const indexedValue = Array.isArray(values) ? len === 1 ? values[0] : values.sort() : values

    let docSlot = document.idx.d[slot.name]
    if (slot.unique) {
      if (!equalIds(slot._id, pathTo(docSlot, 'k'))) {
        document.idx.d[slot.name] = {
          k: slot._id,
          v: indexedValue
        }
        document.markModified('idx.d')
      } else if (JSON.stringify(indexedValue) !== JSON.stringify(docSlot.v)) {
        docSlot.v = indexedValue
        document.markModified('idx.d')
      }
    } else if (docSlot === undefined || JSON.stringify(indexedValue) !== JSON.stringify(docSlot)) {
      document.idx.d[slot.name] = indexedValue
      document.markModified('idx.d')
    }

  }
}

PropertyDefinition.prototype._removeProperty = function(ac, parentDocument, callback) {

  const done = (err, result) => {

    if (!err) {
      // never set virtual nodes, they don't have any real concrete value.
      if (result === true && !this.virtual) {
        if (this.array) {
          toArray(pathTo(parentDocument, this.docpath)).forEach((value, index) => {
            this.onRemovingValue(ac, parentDocument, value, index)
          })
        } else {
          const current = pathTo(parentDocument, this.docpath)
          if (current !== undefined) {
            this.onRemovingValue(ac, parentDocument, current)
          }
        }

        // setting undefined tells mongoose to delete the property.
        pathTo(parentDocument, this.docpath, undefined)

      }
      // bubble up any setter errors caused by the write.
      err = modules.db.getDocumentSetError(parentDocument)
    }
    callback(err)

  }

  if (!this.remover) {
    done(null, true) // default remover
  } else if (this.remover.length > 3) {
    this.remover.call(parentDocument, ac, this, {}, done)
  } else {
    try {
      done(null, this.remover.call(parentDocument, ac, this, {}))
    } catch (err) {
      done(err)
    }
  }

}

PropertyDefinition.prototype._removeElement = function(ac, parentDocument, value, callback) {

  if (!this.array) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'Cannot remove value from non-array property.', path: this.fullpath }))
  }

  // ensure the target document array value is sane. in this case, we have to be sure the whole thing was loaded, so don't mark as safe to update.
  let casted,
      current = pathTo(parentDocument, this.docpath)

  if (current === undefined || !_.isArray(current)) {
    pathTo(parentDocument, this.docpath, current === undefined ? [] : [current])
    current = pathTo(parentDocument, this.docpath)
  }

  // cast value. expect a cast error. we need to check for the existence of the value.
  try {
    casted = this._castValue(parentDocument, value)
  } catch (err) {
    return callback(Fault.from(err))
  }

  // run the pull to transform the removed item, which might end up being undefined (cancelling the removal)
  const done = (err, result) => {

    if (!err) {
      // never remove virtual nodes, they don't have any real concrete value.
      if (result !== undefined && !this.virtual) {
        // re-cast value. it may have been modified by the puller.
        try {
          casted = this._castValue(parentDocument, result)
        } catch (err) {
          callback(Fault.from(err))
          return
        }

        const indexes = this._indexesOf(parentDocument, casted)
        if (indexes.length === 0) {
          return callback(ac.passive ? null : Fault.create('cortex.notFound.arrayValue', { resource: ac.getResource(), path: this.fullpath }))
        }
        indexes.sort().reverse().forEach(index => {
          this.onRemovingValue(ac, parentDocument, casted, index)
        })
        current.pull(casted)

      }

      // bubble up any setter errors caused by the write.
      err = modules.db.getDocumentSetError(parentDocument)

    }
    callback(err)

  }

  if (!this.puller) {
    done(null, casted)
  } else if (this.puller.length > 4) {
    this.puller.call(parentDocument, ac, this, casted, {}, done)
  } else {
    try {
      done(null, this.puller.call(parentDocument, ac, this, casted, {}))
    } catch (err) {
      done(err)
    }
  }

}

PropertyDefinition.prototype.aclWrite = function(ac, parentDocument, value, options, callback_) {

  [options, callback_] = resolveOptionsCallback(options, callback_, true, false)

  if (!this.readable) {
    return callback_(ac.passive ? null : Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: this.fullpath }))
  }

  const isWritable = (this.isWritable(ac) || options.forceWritableDefaultValue) || (this.isUniqueKey() && pathTo(options, 'overwriteUniqueKeys')),
        callback = (err) => {
          ac.popResource()
          callback_(err)
        }
  ac.pushResource(this.getResourcePath(ac, parentDocument))

  if (!isWritable) {
    return callback(ac.passive ? null : Fault.create('cortex.accessDenied.notWritable', { resource: ac.getResource(), path: this.fullpath }))
  }

  if (this.array) {

    // operation permitted
    let canUseWriter = this.writeOnCreate && !!pathTo(parentDocument, 'isNew') && (this.writable || this.creatable)
    if (options.mergeDocuments) {
      if (!(canUseWriter || this.writable)) {
        return callback(Fault.create('cortex.unsupportedOperation.documentMerge', { resource: ac.getResource(), path: this.fullpath }))
      }
    } else {
      if (!((ac.method === 'post' && (this.canPush || canUseWriter)) || (ac.method === 'put' && this.writable))) {
        return callback(Fault.create('cortex.unsupportedOperation.requestMethodDoesNotMatchOperationSemantics', { resource: ac.getResource(), reason: 'Unsupported request method ' + ac.method, path: this.fullpath }))
      }
    }

    try {

      value = toArray(value, true)
      if (this.uniqueValues) {
        value = this._getUniqueArrayValues(value)
      }

      for (let idx = 0; idx < value.length; idx++) {
        this.assertPayloadValueIsSane(ac, value[idx])
      }

    } catch (err) {
      return callback(err)
    }

  } else if (!options.mergeDocuments && !((ac.method === 'post' && !!pathTo(parentDocument, 'isNew')) || (ac.method === 'put'))) {
    return callback(Fault.create('cortex.unsupportedOperation.requestMethodDoesNotMatchOperationSemantics', { resource: ac.getResource(), reason: 'Unsupported request method ' + ac.method, path: this.fullpath }))
  }

  this._doPropertyWrite(ac, parentDocument, value, options, callback)

}

PropertyDefinition.prototype._readSingleResult = function(ac, parentDocument, result, handled, selection) {

  if ((result === undefined || selection.keys.length > 0) && !ac.passive && !selection.passive && !selection.ignoreMissing) {
    throw Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: this.fullpath + (selection.keys.length > 0 ? (selection.keys.length === 1 ? ('.' + selection.keys[0]) : ('.[' + selection.keys.join(',') + ']')) : '') })
  }
  return result

}

PropertyDefinition.prototype._readAdHocPath = function(ac, parentDocument, result, handled, selection) {

  // create an object from the selected sub paths, if possible, allowing deeper reads into random data.

  let obj = selection.keys.reduce(function(obj, path) {
    let value = safePathTo(result, path)
    if (value !== undefined) {
      safePathTo(obj, path, value)
    } else if (!ac.passive && !selection.passive && !selection.ignoreMissing) {
      throw Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: `${this.fullpath}${this.fullpath ? '.' : ''}${path}` })
    }
    return obj
  }.bind(this), {})
  if (Object.keys(obj).length === 0) {
    obj = undefined
  }
  return obj

}

PropertyDefinition.prototype._readArrayResult = function(ac, parentDocument, array, handled, selection) {

  if (selection.keys.length === 0) {
    return (array && _.isFunction(array.toObject)) ? array.toObject() : array
  }

  const hasPossibleMixedSubSelections = !handled && selection.hasSubSelections(true, false)

  // if there are sub keys and reading wasn't handled, it means we are trying to look into a primitive.
  if (hasPossibleMixedSubSelections && !selection.ignoreMixedPaths) {
    if (ac.passive || selection.passive || selection.ignoreMissing) {
      return undefined
    }
    throw Fault.create('cortex.notFound.primitivePropertySelection', { resource: ac.getResource(), path: this.fullpath + '[' + selection.getSubSelections(true, false) + ']' })
  }

  // determine which indexes we are selecting. when expanding, there may be non-indexed paths.
  // if there are no keys, assume the entire array is being read.
  // collect paths for each branch
  let selectedKeys = hasPossibleMixedSubSelections || selection.keys.length === 0 ? _.range(array.length) : selection.keys,
      i,
      index,
      path,
      entry,
      entries = []

  for (i = 0; i < selectedKeys.length; i++) {

    path = selectedKeys[i]

    if (isInteger(path)) {
      // selecting an index. fix the index and resolve it to an existing value.
      index = parseInt(path)
      if (index < 0) index = array.length + index // support negative indexes
      if (array[index] === undefined) {
        throw Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: `${this.fullpath}${this.fullpath ? '.' : ''}${path}` })
      } else {
        entry = entries[index]
        if (!entry) {
          entry = entries[index] = {
            index: index
          }
        }
      }
    } else {
      // selecting a path in each element.
      throw Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: `${this.fullpath}${this.fullpath ? '.' : ''}${path}` })
    }
  }

  return entries.map(function(entry) {
    entry.result = array[entry.index]
    return entry
  }).sort(function(a, b) {
    return a.index - b.index
  }).map(function(entry) {
    return entry.result
  }).filter(function(result) {
    return result !== undefined
  })

}

/**
 *
 * @param ac
 * @param parentDocument
 * @param value
 * @param options
 *  forceWritableDefaultValue
 * @param callback
 * @returns {function(this:PropertyDefinition)}
 *
 *
 *
 */
PropertyDefinition.prototype._doPropertyWrite = function(ac, parentDocument, value, options, callback) {

  let self = this,
      writer

  if (!options?.forceWritableDefaultValue) {

    if (!parentDocument.isNew && this.creatable) {
      return callback(ac.passive ? null : Fault.validationError('cortex.invalidArgument.creatableOnly', { resource: ac.getResource(), path: this.fqpp }))
    }

    if (!this.hasWriteAccess(ac)) {
      return callback(ac.passive ? null : Fault.create('cortex.accessDenied.propertyUpdate', { resource: ac.getResource(), path: this.fqpp }))
    }

  }

  // ensure the target document array value is sane. if the array is not yet present and we're posting, allow a $set.
  // sequencing will take care of this and if it fails, the next run will complete.
  if (this.array) {
    let current = pathTo(parentDocument, this.docpath)
    if (current === undefined || !_.isArray(current)) {
      pathTo(parentDocument, this.docpath, current === undefined ? [] : [current])
      ac.markSafeToUpdate(this)
    }
  }

  // when overwriting, always use the writer. post selects the pusher by default for an array.
  // note: array writers act on the array as a whole.
  if (this.array) {
    let canUseWriter = this.writeOnCreate && !!pathTo(parentDocument, 'isNew') && (this.writable || this.creatable)
    if (options.mergeDocuments) {
      writer = this.writer
    } else if (ac.method === 'put') {
      writer = this.writer
    } else {
      writer = this.pusher
      if (!writer && canUseWriter) {
        writer = this.writer
      }
    }
  } else {
    writer = this.writer
  }

  if (!writer) {
    done(null, value) // default writer
  } else if (writer.length > 4) {
    writer.call(parentDocument, ac, this, value, options, done)
  } else {
    let err = null, result = null
    try {
      result = writer.call(parentDocument, ac, this, value, options)
    } catch (e) {
      err = e
    }
    done(err, result)
  }

  function done(err, result) {

    if (err || result === undefined || self.virtual || (self.array && !_.isArray(result))) {
      return callback(err)
    }

    // assume the path was not found, if it was not collected.
    try {
      const isSelected = parentDocument.isSelected(self.docpath)
      if (!isSelected) err = Fault.create('cortex.notFound.propertySelection', { resource: ac.getResource(), path: self.fullpath })
    } catch (e) {
      err = Fault.create('cortex.notFound.propertySelection', { resource: ac.getResource(), path: self.fullpath })
    }
    if (err) {
      return callback(ac.passive ? null : err)
    }

    if (self.array) {
      self._writeArrayValues(ac, parentDocument, result, options, callback)
    } else {
      self._writeSingleValue(ac, parentDocument, result, options, callback)
    }
  }

}

PropertyDefinition.prototype._writeSingleValue = function(ac, parentDocument, result, options, callback) {

  const current = pathTo(parentDocument, this.docpath)
  if (current !== undefined) {
    this.onRemovingValue(ac, parentDocument, current, null, true)
  }
  this._setSingleValue(ac, parentDocument, result)

  this.onValueAdded(ac, parentDocument, pathTo(parentDocument, this.docpath), current)

  // bubble up any setter errors caused by the write.
  callback(modules.db.getDocumentSetError(parentDocument))

}

PropertyDefinition.prototype._writeDefaultValue = async function(ac, document, options) {

  if (!isSet(this.defaultValue)) {
    return
  }

  const { expressions } = modules,
        { Expression } = expressions

  let value

  if (this.defaultValue instanceof Expression) {

    const ec = modules.expressions.createContext(
      ac,
      this.defaultValue,
      {
        $$ROOT: ac.subject
      }
    )

    value = await ec.evaluate()

  } else if (this.defaultValue?.length > 2) {
    value = await promised(document, this.defaultValue, ac, this)
  } else {
    value = this.defaultValue.call(document, ac, this)
    if (this.array && !Array.isArray(value)) {
      value = [value]
    }
  }
  if (value !== Undefined) {

    const forceWritableDefaultValue = isCustomName(this.name)

    await promised(this, '_doPropertyWrite', ac, document, value, { ...options, forceWritableDefaultValue })
  }

}

/**
 * low-level value setter.
 * @param ac
 * @param parentDocument
 * @param value
 * @private
 */
PropertyDefinition.prototype._setSingleValue = function(ac, parentDocument, value) {
  pathTo(parentDocument, this.docpath, value)
}

/**
 * low-level array index setter.
 *
 * @param ac
 * @param parentDocument
 * @param currentArray
 * @param docIdx
 * @param value
 * @private
 */
PropertyDefinition.prototype._setArrayValue = function(ac, parentDocument, currentArray, docIdx, value) {
  currentArray.set(docIdx, value)
}

/**
 * low-level array addToSet
 * @param ac
 * @param parentDocument
 * @param currentArray
 * @param value
 * @private
 */
PropertyDefinition.prototype._addToSet = function(ac, parentDocument, currentArray, value) {
  return currentArray.addToSet(value)
}

/**
 * low-level array push
 * @param ac
 * @param parentDocument
 * @param currentArray
 * @param value
 * @private
 */
PropertyDefinition.prototype._pushValue = function(ac, parentDocument, currentArray, value) {
  currentArray.push(value)
}

/**
 *
 * @param ac
 * @param parentDocument
 * @param array
 * @param options
 *  overwrite: false
 * @param callback
 * @private
 */
PropertyDefinition.prototype._writeArrayValues = function(ac, parentDocument, array, options, callback) {

  let err

  if (_.isArray(array)) {

    if (this.uniqueValues) { // take only unique items.
      array = _.uniq(array)
    }
    array = array.filter(function(v) { return v !== undefined }) // filter out undefined values.

    // as long as we ensure the entire array is loaded. this is ok.
    ac.markSafeToUpdate(this)

    const reset = (
      options.op !== 'push' &&
            (
              options.mergeDocuments ||
              ac.method === 'put'
            )
    )

    if (reset) { // reset existing value.
      toArray(pathTo(parentDocument, this.docpath)).forEach((value, index) => {
        this.onRemovingValue(ac, parentDocument, value, index)
      })
      pathTo(parentDocument, this.docpath, [])
    }

    let current = pathTo(parentDocument, this.docpath)

    if (current === undefined || !_.isArray(current)) {
      pathTo(parentDocument, this.docpath, current === undefined ? [] : [current])
    }

    try {
      for (let i = 0; i < array.length; i++) {
        let added, docIdx
        if (this.uniqueValues) {
          added = this._addToSet(ac, parentDocument, current, array[i])
          if (added.length) {
            this.onValueAdded(ac, parentDocument, added[0], undefined, current.length - 1)
          }
        } else {
          this._pushValue(ac, parentDocument, current, array[i])
          docIdx = current.length - 1
          this.onValueAdded(ac, parentDocument, current[docIdx], undefined, docIdx)
        }
        if (this.maxItems >= 0) {
          while (current.length > 0 && this.maxShift && current.length > this.maxItems) {
            this.onRemovingValue(ac, parentDocument, current[0], 0)
            current.shift()
          }
        }
      }
    } catch (e) {
      err = e
    }
  }
  if (!err) {

    // bubble up any setter errors caused by the write.
    err = modules.db.getDocumentSetError(parentDocument)
  }

  callback(err)

}

PropertyDefinition.prototype.hasScopeReadAccess = function(ac) {
  return !this.scoped || ac.inAuthScope(`object.read.${this.fqpparts[0]}.${ac.subjectId}.${this.fqpparts[1]}`, false)
}

PropertyDefinition.prototype.hasReadAccess = function(ac) {

  if (!this.hasScopeReadAccess(ac)) {
    return false
  }

  const required = acl.fixAllowLevel(this.readAccess, true, acl.AccessLevels.Read)
  let resolved = ac ? ac.resolved : acl.AccessLevels.None

  // augmenting acl? this acl can grant greater access at the property level.
  if ((resolved < required || this.aclOverride) && this.acl.length > 0 && ac) {
    const access = ac.resolveAccess({ acl: this.acl, withGrants: true })
    if (access.allow > resolved || this.aclOverride) resolved = Math.min(access.allow, acl.AccessLevels.Max)
  }
  // augmenting pacl? this pacl can grant greater access at the property level from the ac side.
  if (resolved < required && ac && ac.pacl) {
    if (_.isArray(ac.pacl)) {
      const pacl = [], fullpathLen = this.fullpath.length
      for (let i = 0; i < ac.pacl.length; i++) {
        for (let j = 0; j < ac.pacl[i].paths.length; j++) {
          // name allows name.first. name.first allows name
          const path = ac.pacl[i].paths[j]
          if (this.fullpath === path || (fullpathLen > path.length && this.fullpath.indexOf(path + '.') === 0) || (fullpathLen < path.length && (path.substr(0, path.indexOf('.'))) === this.fullpath)) {
            pacl.push(ac.pacl[i])
            break
          }
        }
      }
      if (pacl && pacl.length) {
        const access = ac.resolveAccess({ acl: pacl })
        if (access.allow > resolved) resolved = Math.min(access.allow, acl.AccessLevels.Max)
      }
    }
  }

  return resolved >= required
}

PropertyDefinition.prototype.hasScopeWriteAccess = function(ac) {
  return !this.scoped || ac.inAuthScope(`object.update.${this.fqpparts[0]}.${ac.subjectId}.${this.fqpparts[1]}`, false)
}

PropertyDefinition.prototype.hasWriteAccess = function(ac, requiredAccess = null) {

  if (!this.hasScopeWriteAccess(ac)) {
    return false
  }

  if (ac.option('isImport') && this.hasImportAccess(ac)) {
    return true
  }

  let resolved = ac ? ac.resolved : acl.AccessLevels.None

  const required = isSet(requiredAccess) ? requiredAccess : acl.fixAllowLevel(this.writeAccess, true, acl.AccessLevels.Update)

  // augmenting acl? this acl can grant greater/lesser access at the property level.
  if (this.acl.length > 0 && ac) {
    const access = ac.resolveAccess({ acl: this.acl, withGrants: true })
    if (access.allow > resolved || this.aclOverride) resolved = Math.min(access.allow, acl.AccessLevels.Max)
  }
  return resolved >= required
}

PropertyDefinition.prototype.getRuntimeAccess = function(ac, forWrite = false) {

  if (ac.scoped && !this.hasScopeReadAccess(ac)) {
    return acl.AccessLevels.None
  }

  let resolved = ac ? ac.resolved : acl.AccessLevels.None

  // augmenting acl? this acl can grant greater access at the property level.
  if ((resolved < acl.AccessLevels.Max || this.aclOverride) && this.acl.length > 0) {
    const access = ac.resolveAccess({ acl: this.acl, withGrants: true })
    if (access.allow > resolved || this.aclOverride) resolved = Math.min(access.allow, acl.AccessLevels.Max)
  }

  if (forWrite === false) {
    // augmenting pacl? this pacl can grant greater access at the property level from the ac side.
    if (resolved < acl.AccessLevels.Max && ac && ac.pacl) {
      if (Array.isArray(ac.pacl)) {
        const pacl = [], fullPathLen = this.fullpath.length
        for (let i = 0; i < ac.pacl.length; i++) {
          for (let j = 0; j < ac.pacl[i].paths.length; j++) {
            // name allows name.first. name.first allows name
            const path = ac.pacl[i].paths[j]
            if (this.fullpath === path || (fullPathLen > path.length && this.fullpath.indexOf(path + '.') === 0) || (fullPathLen < path.length && (path.substr(0, path.indexOf('.'))) === this.fullpath)) {
              pacl.push(ac.pacl[i])
              break
            }
          }
        }
        if (pacl && pacl.length) {
          const access = ac.resolveAccess({ acl: pacl })
          if (access.allow > resolved) resolved = Math.min(access.allow, acl.AccessLevels.Max)
        }
      }
    }
  }

  return resolved

}

Object.defineProperties(PropertyDefinition.prototype, {
  readAccess: {
    get: function() {
      if (this._readAccess === acl.Inherit) {
        return this.parent ? this.parent.readAccess : acl.AccessLevels.Read
      }
      return this._readAccess
    },
    set: function() {
      logger.error('read access set for ' + this.name)
    }
  },
  writeAccess: {
    get: function() {
      if (this._writeAccess === acl.Inherit) {
        return this.parent ? this.parent.writeAccess : acl.AccessLevels.Update
      }
      return this._writeAccess
    },
    set: function() {
      logger.error('write access set for ' + this.name)
    }
  },
  acl: {
    get: function() {
      if (this._acl === acl.Inherit) {
        return this.parent ? this.parent.acl : null
      }
      return this._acl
    }
  },
  root: {
    get: function() {
      if (!this.$_nxroot) {
        let node = this
        while (node.parent) {
          node = node.parent
        }
        this.$_nxroot = node
      }
      return this.$_nxroot
    }
  },
  dependencies: {
    get: function() {
      return (this.root.dependencyMap || {})[this.fullpath]
    }
  },
  auditable: {
    get: function() {
      // either inherit
      if (this.readable && ((this.isSetDocument && this.parent.isWritable()) || this.isWritable() || !this.parent)) {
        if (this._auditable !== Undefined) {
          return this._auditable
        }
        if (this.parent) {
          this._auditable = this.parent.auditable
          return this._auditable
        }
      }
      return false
    },
    set: function(auditable) {
      this._auditable = _.isBoolean(auditable) ? auditable : Undefined
    }
  },
  auditing: {
    get: function() {
      // either inherit
      if (this.readable && ((this.isSetDocument && this.parent.isWritable()) || this.isWritable() || !this.parent)) {
        if (this._auditing !== Undefined) {
          return this._auditing
        }
        if (this.parent) {
          this._auditing = this.parent.auditing
          return this._auditing
        }
      }
      return {
        updateSubcategory: 'update',
        changes: false
      }
    },
    set: function(auditing) {

      this._auditing = auditing === Undefined ? Undefined
        : Object.assign({
          updateSubcategory: 'update',
          changes: false
        }, auditing)

    }

  }

})

PropertyDefinition.prototype.findNode = function(path) {
  void path
  return null
}

PropertyDefinition.prototype.findNodes = function(path, into) {
  return into
}

PropertyDefinition.prototype.castForQuery = function(ac, value) {
  return value
}

PropertyDefinition.prototype.initNode = function(root, parent, initializingASetDocument, isSetProperty) {

  // already initialized
  if (this.parent) {
    return false
  }

  // the parent node.
  this.parent = parent

  // the node that represents the actual document path chain (due to sets and other types with intermediary properties)
  // in the case of a property in a set, the pathParent will be the set, not the parent document.
  this.pathParent = isSetProperty ? parent.parent : parent

  // if this is a document in a set, then the path should match the parent. otherwise, use the property name.
  this.path = initializingASetDocument ? (parent ? parent.path : '') : (this.name || '')

  // if the node is an object type node but has a matching node in the master object, it will be set here.
  this.master = null

  // the docpath reflects the fully qualified path inside of the current document instance. when reading properties, the docpath
  // is what's generally used to read from embedded documents in doc[] and set[] properties.
  if (!this.pathParent || this.pathParent.array || !this.pathParent.docpath) {
    this.docpath = this.path
  } else {
    if (initializingASetDocument) {
      this.docpath = this.pathParent.docpath
    } else {
      this.docpath = this.pathParent.docpath + '.' + this.path
    }
  }

  // the full path.
  if (this.pathParent) {
    if (initializingASetDocument) {
      this.fullpath = this.pathParent.fullpath
    } else {
      this.fullpath = this.pathParent.fullpath ? (this.pathParent.fullpath + '.' + this.path) : (this.path)
    }
  } else {
    logger.error('node without parent: ' + this.docpath)
    this.fullpath = this.docpath
  }

  // the fully qualified path.
  if (this.pathParent === root) {
    this.fqpp = root.objectName || root.modelName
    if (root.objectTypeName) {
      if (!(this.master = root.typeMasterNode.findNode(this.fullpath))) {
        this.fqpp += '#' + root.objectTypeName
      }
    } else if (root.postType) {
      // @todo https://github.com/Medable/MedableAPI/issues/281 body sets should be implemented as types. (like script configuration)
      this.fqpp += '#' + root.postType
    }
  } else {
    this.fqpp = parent.fqpp
  }
  if (initializingASetDocument) {
    this.fqpp += '#' + this.name
  } else {
    this.fqpp += '.' + this.path
    if (this.array) this.fqpp += '[]'
  }

  const dotPos = this.fqpp.indexOf('.')
  this.fqpparts = [this.fqpp.substring(0, dotPos), this.fqpp.substring(dotPos + 1).replace(/\[\]/g, '')]

  // a property is considered nested if it's an embedded document in a non-array document or set.
  // when the property is in a document array, always ensure the _id at the same level is loaded.
  if (this.pathParent && this.pathParent.array) {
    this.addDependency('._id')
  }

  if (this.history) {
    root.historyNodeIds.push(this._id)
    this.addDependency('hist')
  }

  this.isSetDocument = initializingASetDocument
  this.initReader()

  if (this.uniqueKey) {
    this.addDependency(`.${this.uniqueKey}`)
  }

  if (this.indexSlot) {
    this.root.slots.push(this.indexSlot)
  }

  if (this._onInit) {
    this._onInit()
    delete this._onInit
  }

  return true

}

PropertyDefinition.prototype.initReader = function() {

  if (!this.reader) {
    if (this.groupReader) {
      this._compiledReader = this._readerGroupReader
    } else {
      this._compiledReader = null
    }
  } else {
    this._compiledReader = this.reader
  }

}

PropertyDefinition.prototype._readerGroupReader = function(ac, node, selection) {

  return new GroupedRead(node, ac, this, selection, pathTo(this, node.docpath))
}

PropertyDefinition.prototype.walk = function(fn) {
  return fn(this)
}

PropertyDefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {

  // select the index.
  if (this.unique || this.indexed) {
    selections.idx = true
  }

  // only ignore problem sub paths for virtuals as they might have diggable properties.
  if (!path || this.virtual) {

    // only select non-virtual paths for actual lookup.
    if (!this.virtual) {
      selections[this.fullpath] = true
    }

    let dependencies = this.dependencies,
        value

    for (const depKey of this.include) {
      selections[depKey] = true
    }

    if (dependencies) {
      for (let depKey in dependencies) {
        if (dependencies.hasOwnProperty(depKey)) {
          if (selections[depKey] !== true) {
            value = _.isFunction(dependencies[depKey]) ? dependencies[depKey].call(this, principal, options) : dependencies[depKey]
            if (value) {
              if (value === true) {
                selections[depKey] = true
              } else if (_.isObject(value)) {
                if (_.isObject(selections[depKey])) {
                  extend(true, selections[depKey], value)
                } else {
                  selections[depKey] = value
                }
              }
            }
          }
        }
      }
    }
  }

}

PropertyDefinition.prototype.eachChild = function(fn) {

}

PropertyDefinition.prototype.addDependency = function(path, value) {

  if (path === ('.' + this.path)) return
  if (value === undefined) value = true
  if (!this._dependencies) this._dependencies = {}
  let current = this._dependencies[path]
  if (current != null) {
    // not already explicitly loaded?
    if ((!_.isBoolean(current) || current !== true)) {
      value = modules.db.normalizeDependencyValue(value)
      if ((_.isBoolean(current) && _.isBoolean(value)) || (_.isBoolean(value) && value === true)) {
        this._dependencies[path] = value || this._dependencies[path]
      } else {
        logger.error('dependency value conflict for path "' + path + '" in property "' + this.fullpath + '" for model ' + this.root.modelName)
      }
    }
  } else {
    this._dependencies[path] = value
  }
}

PropertyDefinition.prototype._getUniqueArrayValues = function(values) {
  return _.uniq(values)
}

module.exports = PropertyDefinition
