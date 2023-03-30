'use strict'

const Fault = require('cortex-service/lib/fault'),
      async = require('async'),
      clone = require('clone'),
      acl = require('../../../acl'),
      { isSet, promised, pathParts, array: toArray, path: pathTo, rInt, rBool,
        option: getOption, extend, getIdOrNull, joinPaths,
        rString, idArrayUnion, inIdArray, resolveOptionsCallback,
        toJSON, normalizeObjectPath, isPlainObject, dotPath,
        isPrimitive, isId, pathToPayload, stringToBoolean, findIdInArray,
        equalIds, uniqueIdArray, intersectIdArrays, isInt,
        profile, isCustomName, getIdArray,
        visit, couldBeId, isEmpty, isEmptyObject, digIntoResolved,
        OutputCursor, normalizeAcPathParts
      } = require('../../../utils'),
      modules = require('../../../modules'),
      logger = require('cortex-service/lib/logger'),
      SelectionTree = require('./classes/selection-tree'),
      ap = require('../../../access-principal'),
      _ = require('underscore'),
      consts = require('../../../consts'),
      util = require('util'),
      { pluralize } = require('inflection'),
      crypto = require('crypto'),
      config = require('cortex-service/lib/config'),
      ModelDefinition = require('./model-definition'),
      AclDefinition = require('./acl-definition'),
      ExpansionQueue = require('./classes/expansion-queue'),
      NativeDocumentCursor = require('./classes/native-document-cursor'),
      local = Object.defineProperties({}, {
        PropertyDefinition: { get: function() { return (this._prop || (this._prop = require('./property-definition'))) } },
        ReferenceDefinition: { get: function() { return (this._ReferenceDefinition || (this._ReferenceDefinition = require('./types/reference-definition'))) } },
        PostDefinition: { get: function() { return (this._PostDefinition || (this._PostDefinition = require('./feeds/post-definition'))) } },
        FacetsIndexDefinition: { get: function() { return (this._FacetsIndexDefinition || (this._FacetsIndexDefinition = require('./facets-index-definition'))) } },
        Parser: { get: function() { return (this._Parser || (this._Parser = require('../../parser'))) } },
        ProjectedNode: { get: function() { return (this._ProjectedNode || (this._ProjectedNode = require('../../parser/property').ProjectedNode)) } },
        ProjectedDocument: { get: function() { return (this._ProjectedDocument || (this._ProjectedDocument = require('../../parser/property').ProjectedDocument)) } }
      }),
      readerMetrics = {
        lightweightLoadCount: 0,
        lightweightLoadMs: 0,
        lightweightReadCount: 0,
        lightweightReadMs: 0,
        loadCount: 0,
        readCount: 0,
        loadMs: 0,
        readMs: 0
      },
      DELETE_HOOKS = ['delete.before', 'delete.after'],
      noSkipCreateAcl = new Set(['org', 'account', 'upload', 'history', 'audit', 'schema', 'roomevent', 'composition'])

let Undefined

modules.metrics.register('reader', readerMetrics)

Object.defineProperty(config('runtime'), 'resetReaderMetrics', {
  get: function() {
    return false
  },
  set: function(v) {
    if (v) {
      Object.keys(readerMetrics).forEach(k => {
        readerMetrics[k] = 0
      })
    }
  }
})

function payloadToPaths(payload) {

  return toArray(Object.keys(flattenPayloadPaths(payload)))

}

function assignId(object, _id) {
  object = object || {}
  if (isSet(object._id)) {
    object = { $and: [object, { _id }] }
  } else {
    object._id = _id
  }
  return object
}

function flattenPayloadPaths(obj, parentPath) {

  const out = {}
  if (obj) {
    Object.keys(obj).forEach(function(key) {

      // stop at keys with dots in them, but select the whole branch.
      if (key.includes('.')) {
        out[parentPath] = 1
        return
      }

      const prop = obj[key]

      let path
      if (key[0] === '$') { // move up $ to allow and bypass elemMatch type selections
        path = parentPath
      } else {
        path = parentPath ? parentPath + '.' + key : key
      }

      if (Array.isArray(prop) && prop.length === 0) {
        out[path] = 1
      } else {
        (Array.isArray(prop) ? prop : [prop]).forEach(function(obj) {

          if (_.isObject(obj)) {
            if (isId(obj)) {
              out[path] = 1
            } else if (_.isDate(obj)) {
              out[path] = 1
            } else if (Buffer.isBuffer(obj)) {
              out[path] = 1
            } else if (obj instanceof RegExp) {
              out[path] = 1
            } else if (Object.keys(obj).length === 0) {
              out[path] = 1
            } else if (isPlainObject(obj)) {
              const paths = flattenPayloadPaths(obj, path)
              out[path] = 1
              extend(out, paths)
            } else {
              out[path] = 1
            }
          } else {
            out[path] = 1
          }
        })
      }

    })
  }
  return out

}

class ContextCursor extends OutputCursor {

  constructor(model, parser, cursor, options = {}) {

    super()

    this._model = model
    this._cursor = cursor
    this._parser = parser
    this._options = options
    this._batchSize = config('connections.batchSize') || 250
    this._buffer = []

    // HACK! @hack. move this to proper location. if there has been a group stage, acl will be missing.
    if (parser._pipeline.filter(stage => stage.key === '$group').length) {
      this._sharedAcl = [{ type: acl.AccessTargets.Account, target: parser.ac.principalId, allow: parser.accessLevel }]
    }

  }

  toJSON() {

    return {
      ...super.toJSON(),
      type: 'context'
    }
  }

  hasNext(callback) {
    if (this._buffer.length > 0) {
      this._replyHasNext(null, true, callback)
    } else if (this.isClosed() || this._cursor.isClosed()) {
      this._replyHasNext(null, false, callback)
    } else {
      this._nextBatch(err => {
        this._replyHasNext(err, this._buffer.length > 0, callback)
      })
    }
  }

  next(callback) {
    if (this._buffer.length > 0) {
      return this._replyNext(null, this._buffer.shift(), callback)
    } else {
      this.hasNext((err, has) => {
        if (err || !has) {
          this._replyNext(err, Undefined, callback)
        } else {
          this._nextBatch(err => {
            this._replyNext(err, this._buffer.length > 0 ? this._buffer.shift() : Undefined, callback)
          })
        }
      })
    }
  }

  hasMore() {
    return !!this._cursor.hasMore
  }

  close(callback) {
    if (!this._cursor.isClosed()) {
      this._cursor.close(() => super.close(callback))
    } else {
      super.close(callback)
    }
  }

  _nextBatch(callback) {

    const options = this._options,
          parser = this._parser,
          principal = parser.principal,
          selectionTree = options.selectionTree || new SelectionTree(options),
          acOptions = {
            override: options.override,
            grant: options.grant,
            roles: options.roles,
            req: options.req,
            script: options.script,
            locale: options.locale,
            pacl: options.pacl,
            passive: options.passive,
            eq: ExpansionQueue.create(principal, options.req, options.script, options.eq),
            options: getOption(options, 'acOptions')
          }

    selectionTree.setOption('deferGroupReads', true)
    selectionTree.setOption('forgiving', true)

    let start = config('runtime.recordReaderMetrics') ? process.hrtime() : null

    async.waterfall([
      // load the next batch from the underlying cursor.
      callback => {
        const buffer = []
        let sanityNullSheck = false
        async.whilst(
          () => buffer.length < this._batchSize && !sanityNullSheck,
          callback => {
            this._next((err, doc) => {
              if (!err) {
                if (!doc) {
                  sanityNullSheck = true
                } else {
                  buffer.push(doc)
                }
              }
              callback(err)
            })
          },
          err => setImmediate(callback, err, buffer)
        )
      },

      // action group readers and expanders on the entire batch.
      (buffer, callback) => {

        if (!rBool(this._options.json, true)) {
          return callback(null, buffer)
        }

        parser.getUnwoundPaths().forEach(path => selectionTree.setTreatAsIndividualProperty(path))

        async.mapSeries(
          buffer,
          (document, callback) => {
            const ac = new acl.AccessContext(principal, document, acOptions)
            ac.option('$defaultAcl', options.defaultAcl)
            ac.option('$defaultAclOverride', options.defaultAclOverride)
            if (options.defaultAcl) {
              ac.resolve(true, acl.mergeAndSanitizeEntries(options.defaultAcl, options.defaultAclOverride || ac.object.defaultAcl, document.acl))
            }
            if (options.singlePath) {
              ac.singlePath = options.singlePath
            }
            document.aclRead(ac, selectionTree, callback)
          },
          (err, buffer) => setImmediate(callback, err, buffer)
        )

      },

      // perform deferred group reads and expansions.
      (buffer, callback) => {

        if (!rBool(this._options.json, true)) {
          return callback(null, buffer)
        }

        if (start) {
          const diff = process.hrtime(start), duration = ((diff[0] * 1e9 + diff[1]) / 1e6)
          if (this._options.lightweight) {
            readerMetrics.lightweightReadCount += buffer.length
            readerMetrics.lightweightReadMs += duration
            readerMetrics.avgLightweightReadMs = (readerMetrics.lightweightReadMs / readerMetrics.lightweightReadCount).toFixed(3)
          } else {
            readerMetrics.readCount += buffer.length
            readerMetrics.readMs += duration
            readerMetrics.avgReadMs = (readerMetrics.readMs / readerMetrics.readCount).toFixed(3)
          }
        }

        this._model.schema.node.readGrouped(this._parser.principal, buffer, getOption(options, 'req'), getOption(options, 'script'), err => {
          if (err) {
            return callback(err, buffer)
          }
          acOptions.eq.expand(buffer, err => {
            if (!err && options.jsonTransformer) {
              async.mapSeries(buffer, (json, callback) => {
                options.jsonTransformer(principal, json, callback)
              }, callback)
            } else {
              callback(err, buffer)
            }
          })
        })

      }
    ],
    (err, buffer) => {
      if (!err) {
        this._buffer = this._buffer.concat(buffer)
      }
      // if (err || this._buffer.length === 0) {
      //   this._closed = true
      // }
      callback(err)
    }
    )

  }

  /**
   * load next raw document. if loading raw, excluded fields are omitted.
   */
  _next(callback) {

    if (this.isClosed() || this._cursor.isClosed()) {
      return setImmediate(callback, null, null)
    }
    this._cursor.next((err, raw) => {
      let doc = null
      if (!err && raw) {

        let start = config('runtime.recordReaderMetrics') ? process.hrtime() : null

        try {
          if (this._sharedAcl) {
            raw.acl = this._sharedAcl
          }
          const Model = this._parser.discernDocumentModel(raw)
          if (this._options.lightweight) {
            doc = modules.db.definitions.makeLightweightSubject(raw, Model)
          } else {
            doc = new Model(Undefined, this._parser.projectedPaths, true)
            doc.init(raw, null, null, true)
            doc.$raw = raw
          }

        } catch (e) {
          err = e
        }

        if (start) {
          const diff = process.hrtime(start), duration = ((diff[0] * 1e9 + diff[1]) / 1e6)
          if (this._options.lightweight) {
            readerMetrics.lightweightLoadCount++
            readerMetrics.lightweightLoadMs += duration
            readerMetrics.avgLightweightLoadMs = (readerMetrics.lightweightLoadMs / readerMetrics.lightweightLoadCount).toFixed(3)
          } else {
            readerMetrics.loadCount++
            readerMetrics.loadMs += duration
            readerMetrics.avgLoadMs = (readerMetrics.loadMs / readerMetrics.loadCount).toFixed(3)
          }
        }

      }
      setImmediate(callback, err, doc)
    })

  }

}

function ContextModelDefinition(options) {

  const objectOptions = ContextModelDefinition.createOptions(options)

  let isTyped,
      properties,
      ModelConstructor,
      skip = []

  for (let prop in objectOptions) {
    if (objectOptions.hasOwnProperty(prop)) {
      this[prop] = objectOptions[prop]
    }
  }

  // add object type store in 'types', keyed by id string.
  this.typed = !options.typeMasterNode && this.objectTypes.length > 0
  this.types = {}
  this.typeIds = []
  this.typeNames = []
  this.typeMasterNode = options.typeMasterNode
  this.objectTypeName = options.objectTypeName
  this.objectTypeId = options.objectTypeId
  this.historyNodeIds = options.historyNodeIds || []

  // skip unused properties.
  if (this.isUnmanaged || !this.hasCreator) {
    skip.push('creator')
  }
  if (this.isUnmanaged || !this.hasOwner) {
    skip.push('owner')
  }
  if (this.isUnmanaged || !this.hasETag) {
    skip.push('ETag')
  }
  if (this.isVersioned) {
    this.requiredAclPaths.push('version')
  } else {
    skip.push('version')
  }
  if (this.isUnmanaged || !this.isFavoritable) {
    skip.push('favorite')
    skip.push('favorites')
  }
  if (!this.isDeployable) {
    skip.push('did')
  }
  if (this.isUnmanaged || !this.wasCreated) {
    skip.push('created')
  }

  // const isTyped = !this.isUnmanaged && !(!this.typed && !this.typeMasterNode)
  // allow unmanaged built-in typed
  isTyped = (!this.isUnmanaged || !isCustomName(this.objectName)) && !(!this.typed && !this.typeMasterNode)
  if (isTyped) {
    this.requiredAclPaths.push('type')
  }

  if (this.isUnmanaged || !this.allowConnections) {
    skip.push('shared')
    skip.push('connections')
  }

  if (this.isUnmanaged) {
    skip.push('facets')
    skip.push('acl')
    skip.push('aclv')
    skip.push('updated')
    skip.push('updater')
    skip.push('accessRoles')
    skip.push('favorites')
    skip.push('favorite')
    skip.push('posts')
    skip.push('hist')
    skip.push('audit')
  }

  // set at the top-level influences all properties auditable property by inheritance.
  this.auditable = !!(this._auditing.enabled && this._auditing.all)

  skip = this._adjustSkippedPaths(skip) // @hack

  // add passed in properties, but not if they replace the originals. also, filter out things we don't need.
  // allow projected nodes to replace originals.
  properties = ContextModelDefinition.getProperties(isTyped).filter(function(prop) {
    return !~skip.indexOf(prop.name)
  })

  toArray(getOption(options, 'properties')).forEach(function(prop) {
    if (!~skip.indexOf(prop.name)) {
      if ((prop instanceof local.ProjectedNode) || (prop instanceof local.ProjectedDocument) || !_.find(properties, function(v) { return local.PropertyDefinition.equals(prop, v) })) {
        const pos = (prop instanceof local.ProjectedNode) ? _.findIndex(properties, v => local.PropertyDefinition.equals(prop, v)) : -1
        if (~pos) {
          properties[pos] = prop
        } else {
          properties.push(prop)
        }

      }
    }
  })

  // merge feed definitions
  toArray(this.feedDefinition).forEach(function(postTypeDoc, i, a) {
    if (!(postTypeDoc instanceof local.PostDefinition)) {
      a[i] = new local.PostDefinition(postTypeDoc)
    }
  })

  options = extend(options, { properties, name: this.objectName })

  ModelDefinition.call(this, options)

  // typeBaseNode is set by types as a back reference to the top-level node.
  if (this.typeMasterNode) {
    return
  }

  ModelConstructor = this.constructor

  this.objectTypes.forEach((typeDoc) => {

    const typeOptions = extend(options, {
            typeMasterNode: this,
            objectTypeName: typeDoc.name,
            objectTypeId: typeDoc._id,
            objectTypes: [],
            historyNodeIds: this.historyNodeIds
          }),
          // don't overwrite base properties.
          newPropertyNames = typeDoc.properties.map(prop => prop.name),
          existingPropertyNames = properties.map(prop => prop.name)

    typeOptions.properties = properties.slice()

    typeDoc.properties.forEach(prop => {
      if (!~existingPropertyNames.indexOf(prop.name)) {
        typeOptions.properties.push(prop)
      }
    })

    let typeObj = this.types[typeDoc._id] = {
      _id: typeDoc._id,
      label: typeDoc.label,
      name: typeDoc.name,
      properties: {},
      node: new ModelConstructor(typeOptions),
      model: null
    }

    newPropertyNames.forEach(name => {
      const node = typeObj.node.properties[name]
      typeObj.properties[node.name] = node
    })

    this.typeIds.push(typeDoc._id)
    this.typeNames.push(typeDoc.name)

  })
  delete this.objectTypes

}
util.inherits(ContextModelDefinition, ModelDefinition)

ContextModelDefinition.prototype.findTypedByName = function(name) {

  const node = this.typeMasterNode || this

  for (let _id in node.types) {
    if (node.types.hasOwnProperty(_id)) {
      if (node.types[_id].name === name) {
        return node.types[_id]
      }
    }
  }
  return null

}

ContextModelDefinition.prototype._adjustSkippedPaths = function(skipped) {
  return skipped
}

ContextModelDefinition.prototype.findTypedById = function(typeId) {

  const node = this.typeMasterNode || this
  return node.types[getIdOrNull(typeId)]

}

ContextModelDefinition.prototype.getDefinitionForType = function(type = null) {

  const root = this.typeMasterNode || this,
        typeId = getIdOrNull(type)

  let entry

  if (!root.typed || type === null) {
    return this
  }

  if (typeId) {
    entry = root.findTypedById(typeId)
  } else {
    entry = root.findTypedByName(type)
  }
  return entry ? entry.node : this

}

ContextModelDefinition.prototype.initNode = function(root) {

  ModelDefinition.prototype.initNode.call(this, root)

  this.fqpp = this.objectName
  if (this.objectTypeName) {
    this.fqpp += '#' + this.objectTypeName
  }
  this.fqpparts = [this.fqpp, '']
}

ContextModelDefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {

  ModelDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, path, options)

  // when typed, always select type name, which is used as a discriminator.
  if (this.typed) {
    selections.type = true
  }

}

ContextModelDefinition.prototype.findTypedNode = function(path, findAll = false) {
  const root = this.typeMasterNode || this,
        all = []

  let found = root.findNode(path)
  if (found && findAll) {
    all.push(found)
  }

  if (!found && root.typed) {
    for (const typeIdStr in this.types) {
      if (this.types.hasOwnProperty(typeIdStr)) {
        found = this.types[typeIdStr].node.findNode(path)
        if (found) {
          if (findAll) {
            all.push(found)
          } else {
            break
          }
        }
      }
    }
  }
  return findAll ? all : found
}

ContextModelDefinition.prototype.findNodeByFqpp = function(fqpp) {
  const root = this.typeMasterNode || this
  let found = ModelDefinition.prototype.findNodeByFqpp.call(this, fqpp)
  if (!found && root.typed) {
    for (const typeIdStr in this.types) {
      if (this.types.hasOwnProperty(typeIdStr)) {
        found = ModelDefinition.prototype.findNodeByFqpp.call(this.types[typeIdStr].node, fqpp)
        if (found) {
          break
        }
      }
    }
  }
  return found
}

ContextModelDefinition.prototype.findNodeById = function(id) {
  const root = this.typeMasterNode || this
  let found = ModelDefinition.prototype.findNodeById.call(this, id)
  if (!found && root.typed) {
    for (const typeIdStr in this.types) {
      if (this.types.hasOwnProperty(typeIdStr)) {
        found = ModelDefinition.prototype.findNodeById.call(this.types[typeIdStr].node, id)
        if (found) {
          break
        }
      }
    }
  }
  return found
}

ContextModelDefinition.createOptions = function(other) {

  other = other || {}

  let options = {},
      requiredAclPaths

  options.sequence = other.sequence || 0
  options.nativeSchemaVersion = other.nativeSchemaVersion
  options.created = other.created
  options.obeyObjectMode = rBool(other.obeyObjectMode, true)
  options._id = other.lookup || other._id
  options.objectId = other.lookup || other._id
  options.objectLabel = other.objectLabel || other.label || ''
  options.objectName = other.objectName || other.name || ''
  options.pluralName = other.pluralName || pluralize(options.objectName)

  options.auditing = Object.assign({
    enabled: false,
    all: false,
    category: options.objectName,
    updateSubcategory: 'update', // default subcategory for updates
    changes: false // when auditing update operations, store changes

  }, other.auditing)

  options.isUnmanaged = rBool(other.isUnmanaged, false)
  options.isDeletable = rBool(other.isDeletable, true)
  options.canCascadeDelete = rBool(other.canCascadeDelete, true)

  options.hasCreator = !options.isUnmanaged && rBool(other.hasCreator, true)
  options.hasOwner = !options.isUnmanaged && rBool(other.hasOwner, true)
  options.validateOwner = rBool(other.validateOwner, true)
  options.isExtensible = rBool(other.isExtensible, false)

  options.isFavoritable = !options.isUnmanaged && rBool(other.isFavoritable, true)
  options.isDeployable = rBool(other.isDeployable, false)
  options.uniqueKey = rString(other.uniqueKey, '')

  options.wasCreated = !options.isUnmanaged && rBool(other.wasCreated, true)
  options.hasETag = !options.isUnmanaged && rBool(other.hasETag, false)
  options.isVersioned = rBool(other.isVersioned, false)
  options.localized = rBool(other.localized, false)
  options.useBundles = rBool(other.useBundles, false)

  options.allowConnections = !options.isUnmanaged && rBool(other.allowConnections, true)

  options.defaultAcl = toArray(other.defaultAcl)
  options.createAcl = toArray(other.createAcl)
  options.shareAcl = toArray(other.shareAcl)
  options.shareChain = _.uniq(toArray(other.shareChain).sort().reverse())

  options.feedDefinition = toArray(other.feedDefinition)
  options.objectTypes = toArray(other.objectTypes)

  options.slots = other.slots || []

  // overriding
  options.defaultAclOverride = rBool(other.defaultAclOverride, false)
  options.defaultAclExtend = rBool(other.defaultAclExtend, false)
  options.createAclOverwrite = rBool(other.createAclOverwrite, false)
  options.createAclExtend = rBool(other.createAclExtend, false)
  options.shareChainOverride = rBool(other.shareChainOverride, false)
  options.shareAclOverride = rBool(other.shareAclOverride, false)
  options.allowBypassCreateAcl = rBool(other.allowBypassCreateAcl, false)

  requiredAclPaths = acl.requiredPaths.slice()

  if (options.uniqueKey) {
    requiredAclPaths.push(options.uniqueKey)
  }

  requiredAclPaths.push('updater')
  if (options.hasCreator) requiredAclPaths.push('creator')
  if (options.hasOwner) requiredAclPaths.push('owner')
  if (_.isArray(other.requiredAclPaths)) {
    requiredAclPaths = requiredAclPaths.concat(other.requiredAclPaths)
  }
  options.requiredAclPaths = _.uniq(requiredAclPaths)

  // connection options.
  options.allowConnectionOptionsOverride = rBool(other.allowConnectionOptionsOverride, false)
  options.connectionOptions = {
    requireAccept: rBool(pathTo(other, 'connectionOptions.requireAccept'), true),
    requiredAccess: acl.fixAllowLevel(rInt(pathTo(other, 'connectionOptions.requiredAccess'), acl.AccessLevels.Share), false, acl.AccessLevels.Share),
    sendNotifications: rBool(pathTo(other, 'connectionOptions.sendNotifications'), true)
  }

  options.dataset = other.dataset || {
    collection: other.collection || 'contexts'
  }

  options.collection = pathTo(other, 'dataset.collection') || other.collection || 'contexts'
  options.locales = other.locales

  return options
}

ContextModelDefinition.prototype.ensureIndexes = function(options, callback) {

  [options, callback] = resolveOptionsCallback(options, callback)

  if (this.collection === 'contexts') {
    return callback()
  }

  async.waterfall(
    [

      callback => modules.db.connection.db.collection(this.collection, { strict: true }, (err, collection) => callback(err, collection)),

      (collection, callback) => {
        if (options.drop) {
          collection.dropAllIndexes(err => {
            callback(err, collection)
          })
        } else {
          callback(null, collection)
        }
      },

      (collection, callback) => {
        async.eachSeries(
          this.generateMongooseSchema({ addIndexesToSchema: true }).indexes(),
          (indexDef, callback) => collection.createIndex(indexDef[0], Object.assign({}, indexDef[1], { background: true }), callback),
          callback
        )
      }
    ],
    callback)

}

/**
 * @param options
 *      @see DocumentDefinition.generateMongooseSchema
 *      registerModel: false. registers with mongoose. if false, does not create indexes.
 *      options: null. schema options
 *      apiHooks: null. object hooks
 *      methods: null. methods
 *      statics: null. statics
 *      indexes: null. indexes
 */
ContextModelDefinition.prototype.generateMongooseSchema = function(options) {

  let objectOptions = ContextModelDefinition.createOptions(this), // get clean options to apply to the schema statics.
      indexDefs,
      schema

  options = options || {}

  options.registerModel = !!options.registerModel
  options.options = extend({
    versionKey: 'sequence',
    collection: 'contexts'
  }, options.options)

  if (objectOptions.collection) {
    options.options.collection = objectOptions.collection
  }

  options.statics = extend({}, options.statics, objectOptions, ContextModelDefinition.statics) // can't overwrite base statics.
  options.methods = extend({}, options.methods, ContextModelDefinition.methods) // can't overwrite base methods.

  options.indexes = options.indexes || []

  options.options.autoIndex = false

  options.statics.postModels = {}
  options.statics.commentModels = {}
  options.statics.isNative = !!consts.NativeIdsReverseLookup[objectOptions._id]
  options.statics.isExtension = this.typeMasterNode ? this.typeMasterNode.isExtension : this.__isExtension
  options.statics.sequence = objectOptions.sequence || 0
  options.statics.created = objectOptions.created

  // prepare indexes for models that will be registered. non-registered object models cannot have their own indexes.
  if (options.registerModel || options.addIndexesToSchema) {

    let managed = !objectOptions.isUnmanaged,
        exclusive = options.exclusiveCollection

    indexDefs = toArray(options.indexes).slice()

    if (!exclusive || (managed && objectOptions.isFavoritable)) {
      indexDefs.push([{ org: 1, object: 1, type: 1, favorites: 1, _id: 1 }, { name: 'idxFavorites', partialFilterExpression: { 'favorites.0': { $exists: true } } }])
    }

    // required for searching orgs cross-org. @temp
    if (!exclusive || (objectOptions.objectName === 'org')) {
      indexDefs.push([{ object: 1, name: 1, _id: 1 }, { name: 'idxOrg_x', partialFilterExpression: { object: 'org' } }])
    }

    // required for reaping instances.
    indexDefs.push([{ reap: 1, object: 1, org: 1 }, { name: 'idxReap' }])

    // facets
    indexDefs.push([{ 'facets._kl': 1 }, { name: 'idxDeletedFacets', partialFilterExpression: { 'facets._kl': true } }])
    indexDefs.push([{ 'facets.pid': 1 }, { name: 'idxFacetInstanceId', partialFilterExpression: { 'facets.pid': { $exists: true } } }])
    indexDefs.push([{ 'facets._pi': 1 }, { name: 'idxFacetPropertyId', partialFilterExpression: { 'facets._pi': { $exists: true } } }])

    // acl lookups
    indexDefs.push([{ org: 1, object: 1, type: 1, 'acl.target': 1, _id: 1 }, { name: 'idxAcl' }])

    if (!exclusive || (managed && objectOptions.hasOwner)) {
      indexDefs.push([{ org: 1, object: 1, type: 1, 'owner._id': 1, _id: 1 }, { name: 'idxOwner' }])
    }
    if (!exclusive || (managed && objectOptions.hasCreator)) {
      indexDefs.push([{ org: 1, object: 1, type: 1, 'creator._id': 1, _id: 1 }, { name: 'idxCreator' }])
    }
    if (!exclusive) {
      indexDefs.push([{ org: 1, object: 1, type: 1, _id: 1 }, { name: 'idxSelf' }])
    }
    if (!exclusive || (managed && objectOptions.wasCreated)) {
      indexDefs.push([{ org: 1, object: 1, type: 1, created: 1, _id: 1 }, { name: 'idxCreated' }])
    }
    if (!exclusive || managed) {
      indexDefs.push([{ org: 1, object: 1, type: 1, updated: 1, _id: 1 }, { name: 'idxUpdated' }])
    }

    // indexes view names, etc.
    if (!exclusive) {
      indexDefs.push([{ org: 1, object: 1, type: 1, name: 1, _id: 1 }, { name: 'idxContextName', partialFilterExpression: { name: { $type: 'string' } } }])
    }

    // searchable and unique "indexed" properties index.
    if (!exclusive || (objectOptions.isExtensible)) {
      indexDefs = indexDefs.concat(modules.db.definitions.getIndexDefinitions())
    }

    // metadata updates.
    indexDefs.push([{ 'meta.up': 1, org: 1, object: 1 }, { name: 'idxMetadataUpdates' }])

  }
  options.indexes = indexDefs

  schema = ModelDefinition.prototype.generateMongooseSchema.call(this, options)

  if (this.typed) {

    schema.statics.objectTypeId = null
    schema.statics.objectTypeName = null

    // build a new schema for each model. share the statics, methods and apiHooks.
    for (let typeName in this.types) {
      if (this.types.hasOwnProperty(typeName)) {

        const type = this.types[typeName],
              schemaOptions = {
                statics: schema.statics,
                methods: schema.methods,
                options: options.options
              },
              collection = options.options.collection,
              typedSchema = type.node.generateMongooseSchema(schemaOptions)

        typedSchema.statics.objectTypeId = type._id
        typedSchema.statics.objectTypeName = type.name

        let model = modules.db.mongoose.Model.compile(this.modelName, typedSchema, collection, modules.db.connection, modules.db.mongoose)
        model.init()
        type.model = model
      }
    }

  }

  return schema

}

ContextModelDefinition.prototype.selectPaths = function(principal, options) {

  let selections = ModelDefinition.prototype.selectPaths.call(this, principal, options)

  if (this.typed) {
    selections = Object.keys(this.types).reduce(
      (selections, typeName) => extend(selections, this.types[typeName].node.selectPaths(principal, options)),
      selections
    )
  }
  return selections

}

/**
 *
 * @param {AccessContext} ac
 * @param {Object} document
 * @param {SelectionTree} selection
 * @param {function(err, v)} callback
 */
ContextModelDefinition.prototype.aclRead = function(ac, document, selection, callback) {

  if (selection && (this.typed || this.typeMasterNode)) {
    selection.addInclude('type')
  }

  ModelDefinition.prototype.aclRead.call(this, ac, document, selection, callback)

}

ContextModelDefinition.prototype.apiSchema = function(options) {

  let schema = ModelDefinition.prototype.apiSchema.call(this, options),
      feedOpts = extend({}, options, { asRoot: false })

  schema = extend({
    allowConnections: !!this.allowConnections,
    connectionOptions: this.connectionOptions,
    defaultAcl: this.defaultAcl.map(function(entry) { entry = clone(entry); delete entry._id; return entry }),
    createAcl: this.createAcl.map(function(entry) { entry = clone(entry); delete entry._id; return entry }),
    shareAcl: this.shareAcl.map(function(entry) { entry = clone(entry); delete entry._id; return entry }),
    shareChain: this.shareChain,
    feedDefinition: this.feedDefinition.map(function(def) {
      return def.apiSchema(feedOpts)
    })
  }, schema, {
    extensible: true,
    custom: true,
    hasETag: this.hasETag,
    isVersioned: this.isVersioned,
    isUnmanaged: this.isUnmanaged,
    auditing: this.auditing
  })

  if (this.typed) {
    schema.types = []
    for (let typeIdStr in this.types) {
      if (this.types.hasOwnProperty(typeIdStr)) {
        const type = this.types[typeIdStr], typeSchema = {
          _id: type._id,
          label: type.label,
          name: type.name,
          properties: []
        }
        for (let name in type.properties) {
          if (type.properties.hasOwnProperty(name) && !this.properties[name]) {
            const prop = type.properties[name].apiSchema(options)
            if (prop) {
              typeSchema.properties.push(prop)
            }
          }
        }
        schema.types.push(typeSchema)
      }
    }
  }

  return schema

}

// shared properties ----------------------------------------------------

ContextModelDefinition.getProperties = function(isTyped) {

  return [
    {
      label: 'Id',
      name: '_id',
      type: 'ObjectId',
      auto: true,
      readable: true,
      readAccess: acl.AccessLevels.Min,
      nativeIndex: true,
      scoped: false
    },
    {
      label: 'System Metadata',
      name: 'meta',
      type: 'Document',
      readable: !!config('debug.readableMeta'),
      writable: false,
      properties: [{
        label: 'Updates',
        description: 'See consts.metadata.updateBits.documentSize',
        name: 'up',
        array: true,
        type: 'Number'
      }, {
        label: 'BSON Size',
        description: 'Calculated on creation and updated on a schedule',
        name: 'sz',
        type: 'Number',
        default: 0
      }]
    },
    {
      label: 'History Holding',
      name: 'hist',
      readable: !!config('debug.readableHist'),
      public: !!config('debug.readableHist'),
      dependencies: ['creator', 'created', 'updater', 'updated'],
      type: 'Any',
      serializeData: false
    },
    {
      label: 'Audit',
      name: 'audit',
      optional: true,
      readable: true,
      writable: true,
      readAccess: acl.AccessLevels.Public,
      writeAccess: acl.AccessLevels.Public,
      type: 'Document',
      dependencies: ['hist'],
      writer: function(ac, node, value) {
        ac.option('$historyMessage', rString(pathTo(value, 'message'), '').trim().substr(0, 512))
        return Undefined
      },
      properties: [
        {
          label: 'Message',
          name: 'message',
          type: 'String',
          optional: true,
          writable: true,
          virtual: true,
          readAccess: acl.AccessLevels.Inherit,
          writeAccess: acl.AccessLevels.Inherit
        },
        {
          label: 'History',
          name: 'history',
          type: 'List',
          sourceObject: 'history',
          linkedReferences: [{
            source: '_id',
            target: 'context._id'
          }],
          readAccess: acl.AccessLevels.Read,
          inheritPropertyAccess: true,
          inheritInstanceRoles: true,
          readThrough: true,
          grant: acl.AccessLevels.Public,
          preSort: { 'context.sequence': -1 },
          jsonTransformer: function(principal, value, callback) {
            callback(null, value && value.document)
          }
        }
      ]
    },
    {
      label: 'Created',
      name: 'created',
      type: 'Date',
      nativeIndex: true,
      default: function() {
        return new Date()
      },
      readAccess: acl.AccessLevels.Public
    },
    {
      label: 'Org',
      name: 'org',
      type: 'ObjectId',
      public: false,
      readable: true,
      optional: true,
      readAccess: acl.AccessLevels.Script,
      nativeIndex: true,
      ref: 'org'
    },
    {
      label: 'Deployment Identifiers',
      name: 'did',
      type: 'ObjectId',
      public: false,
      optional: true,
      readable: true,
      writable: true,
      nativeIndex: true,
      readAccess: acl.AccessLevels.System,
      writeAccess: acl.AccessLevels.System,
      array: true
    },
    {
      label: 'Object',
      name: 'object',
      type: 'String',
      nativeIndex: true,
      readable: true,
      readAccess: acl.AccessLevels.Min,
      scoped: false,
      dependencies: ['_id', 'ETag'],
      set: function(value) {
        if (this.constructor.hasETag) {
          const shaSum = crypto.createHash('md5')
          shaSum.update(this._id + value)
          this.ETag = shaSum.digest('hex')
        }
        return value
      }
    },
    {
      label: 'ETag',
      name: 'ETag',
      type: 'String',
      readable: true,
      readAccess: acl.AccessLevels.Connected,
      scoped: false
    },
    {
      label: 'Version',
      name: 'version',
      type: 'Number',
      readable: true,
      writable: true,
      readAccess: acl.AccessLevels.Public,
      writeAccess: acl.AccessLevels.Public,
      default: 0,
      scoped: false,
      writer: function(ac, node, value) {
        // require a version to be written for existing documents, storing the value in $setVersion for save.
        value = rInt(value, this.isNew ? 0 : null)
        if (value !== (this.version || 0)) {
          throw Fault.create('cortex.conflict.versionOutOfDate', { resource: ac.getResource(), path: node.fqpp })
        }
        ac.option('$setVersion', value)
        return Undefined
      }
    },
    isTyped
      ? {
        // note that the type property only exists for typed objects.
        label: 'Type',
        name: 'type',
        type: 'String',
        readable: true,
        readAccess: acl.AccessLevels.Min,
        scoped: false,
        writable: true,
        nativeIndex: true,
        writer: function(ac, node, value) {
          if (this.$__originalType == null) {
            this.$__originalType = this.type
          }
          return value
        },
        onValueAdded: function() {
          if (this.isModified('type') && !this.isNew) { // re-typed from null where typing was added later.
            // force validation on all properties in the type.
            const properties = pathTo(this.constructor.schema.node.findTypedByName(this.type), 'properties') || {}
            Object.keys(properties).forEach(name => {
              const prop = properties[name]
              prop.walk(prop => {
                this.markModified(prop.fullpath)
              })
            })
          }
        },
        validators: [{
          name: 'required'
        }, {
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value) {
              // cannot re-type unless new or null.
              if (this.$__originalType != null) {
                throw Fault.create('cortex.invalidArgument.instanceRetyping')
              }
              // double-check the model selection happened correctly.
              if (node.root.objectTypeName !== value) {
                throw Fault.create('cortex.invalidArgument.instanceTypeMismatch', { path: value })
              }
              // cannot write null-typed.
              if (node.root.typed) {
                throw Fault.create('cortex.invalidArgument.nullInstanceType')
              }
              return true
            }
          }
        }]
      }
      : {
        label: 'Type',
        name: 'type',
        type: 'String',
        readable: false,
        writable: false,
        default: null
      },
    {
      label: 'Creator',
      // description: 'The account id of the context creator',
      name: 'creator',
      type: 'Reference',
      readable: true,
      readAccess: acl.AccessLevels.Public,
      expandable: true,
      sourceObject: 'account',
      grant: acl.AccessLevels.Public,
      nativeIndex: true
    },
    {
      label: 'Owner',
      // description: 'The account id of the context owner',
      name: 'owner',
      type: 'Reference',
      nativeValidator: false,
      readable: true,
      readAccess: acl.AccessLevels.Public,
      expandable: true,
      creatable: true,
      writeAccess: acl.AccessLevels.Script,
      exportAccess: acl.AccessLevels.Script, // lower requirement for env exports
      importAccess: acl.AccessLevels.Script, // lower requirement for env imports
      sourceObject: 'account',
      grant: acl.AccessLevels.Public,
      nativeIndex: true,
      validators: [{
        name: 'required'
      }, {
        name: 'adhoc',
        definition: {
          validator: function(ac, node, value, callback) {
            if (!ac.object.validateOwner || ac.option('$autoCreate')) {
              return callback(null, true)
            }
            ap.create(ac.org, value, (err) => callback(err))
          }
        }
      }],
      export: async function(ac, doc, resourceStream, parentPath, options) {

        const { manifest } = resourceStream,
              resourcePath = joinPaths(parentPath, this.path),
              owner = manifest.getExportOwner(resourcePath)

        if (owner === false) {
          return Undefined
        } else if (isSet(owner)) {
          const { _id } = await resourceStream.loadLocalPrincipal(ac, owner, resourcePath)
          doc = { _id }
        }
        return local.ReferenceDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options)

      },
      import: async function(ac, doc, resourceStream, parentPath, options) {

        const { manifest } = resourceStream,
              resourcePath = joinPaths(parentPath, this.path),
              owner = manifest.getImportOwner(resourcePath)

        if (owner === false) {
          doc = ac.principal.uniqueKey
        } else if (isSet(owner)) {
          doc = owner
        }

        return local.ReferenceDefinition.prototype.import.call(this, ac, doc, resourceStream, parentPath, options)
      }
    },
    new AclDefinition({
      label: 'Acl',
      name: 'acl',
      type: 'Document',
      public: false,
      array: true,
      uniqueValues: false,
      maxItems: -1,
      optional: true,
      readAccess: acl.AccessLevels.Share
    }),
    new local.FacetsIndexDefinition({
      label: 'Facets Index',
      name: 'facets'
    }),
    {
      label: 'Acl Version',
      name: 'aclv',
      type: 'Number',
      public: false,
      readable: false,
      default: 0
    },
    {
      label: 'Internal Sequence',
      name: 'sequence',
      type: 'Number',
      public: false,
      readable: true,
      readAccess: acl.AccessLevels.System,
      default: 0
    },
    {
      label: 'Updated',
      name: 'updated',
      type: 'Date',
      // description: 'The date the latest update was made to a context\'s properties',
      readAccess: acl.AccessLevels.Connected,
      readable: true,
      dependencies: ['_id', 'object', 'ETag'],
      // nativeIndex: true,
      set: function(value) {
        if (this.constructor.hasETag) {
          const shasum = crypto.createHash('md5')
          shasum.update(this._id + this.object + value + Math.random())
          this.ETag = shasum.digest('hex')
        }
        return value
      }
    },
    {
      label: 'Updater',
      // description: 'The account id of the context updater',
      name: 'updater',
      type: 'Reference',
      readable: true,
      readAccess: acl.AccessLevels.Connected,
      expandable: true,
      sourceObject: 'account',
      grant: acl.AccessLevels.Public
    },
    {
      label: 'Access Level',
      name: 'access',
      type: 'Number',
      // description: 'The current caller\'s context access level.',
      virtual: true,
      readable: true,
      readAccess: acl.AccessLevels.Min,
      dependencies: ['_id'],
      reader: function(ac) {
        if (ac.org.configuration.stringAccessRoles) {
          return rString(acl.AccessLevelsLookup[ac.resolved], '').toLowerCase()
        }
        return ac.resolved
      }
    },
    {
      label: 'Access Roles',
      name: 'accessRoles',
      type: 'ObjectId',
      array: true,
      virtual: true,
      readable: true,
      readAccess: acl.AccessLevels.Min,
      reader: function(ac) {
        if (ac.org.configuration.stringAccessRoles) {
          return ac.roleCodes
        }
        return ac.roles
      },
      canPush: false,
      canPull: false
    },
    {
      label: 'Property Access',
      name: 'propertyAccess',
      type: 'Document',
      optional: true,
      virtual: true,
      readable: true,
      readAccess: acl.AccessLevels.Min,
      groupReader: function(node, principal, entries, req, script, selection, callback) {

        const stopAt = ['Reference', 'File']

        async.eachSeries(entries, (entry, callback) => {

          const ac = entry.ac,
                result = {},
                lists = []

          ac.object.schema.node.walk(n => {
            if (!n.fullpath) {
              return
            } else if (!n.readable || n.readAccess > acl.AccessLevels.Script) {
              return -2
            }
            const typeName = n.getTypeName(),
                  read = n.hasReadAccess(ac),
                  write = read && n.isWritable(ac) && n.hasWriteAccess(ac),
                  del = read && write && n.removable

            pathTo(result, `${n.fullpath}.read`, read)
            pathTo(result, `${n.fullpath}.update`, write)
            pathTo(result, `${n.fullpath}.delete`, del)
            if (typeName === 'List') {
              pathTo(result, `${n.fullpath}.push`, false)
              pathTo(result, `${n.fullpath}.pull`, false)
              if (n.writeThrough) {
                lists.push(n)
              }
            } else if (n.array) {
              pathTo(result, `${n.fullpath}.push`, Boolean(write && n.canPush))
              pathTo(result, `${n.fullpath}.pull`, Boolean(write && n.canPull))
            }
            if (stopAt.includes(typeName)) {
              return -2
            }
          })
          entry.output[node.docpath] = result
          if (lists.length === 0) {
            return setImmediate(callback)
          }

          async.eachSeries(lists, (n, callback) => {
            n._createBaseContext(ac.principal, null, (err, baseCtx, Model) => {
              if (err) {
                return callback()
              }
              n.transformAccessContext(ac, entry.input, { forWrite: true }, (err, ac) => {
                if (err) {
                  return callback()
                }
                const subjectAc = new acl.AccessContext(principal, null, {
                  grant: n.inheritPropertyAccess ? Math.max(n.grant, n.inheritPropertyAccess && n.getRuntimeAccess(ac)) : n.grant,
                  roles: idArrayUnion(n.roles, ac.instance_roles),
                  object: Model
                })
                subjectAc.resolve(true, acl.mergeAndSanitizeEntries(n.defaultAcl, entry.input.acl, n.defaultAclOverride || Model.defaultAcl))

                pathTo(result, `${n.fullpath}.roles`, subjectAc.roles)
                pathTo(result, `${n.fullpath}.access`, subjectAc.resolved)
                pathTo(result, `${n.fullpath}.push`, Boolean(principal.bypassCreateAcl || subjectAc.canCreate(n.createAcl.length ? n.createAcl : Undefined, n.createAclOverride)))
                pathTo(result, `${n.fullpath}.pull`, subjectAc.hasAccess(acl.AccessLevels.Delete))
                setImmediate(callback)
              })
            })
          }, callback)

        }, callback)

      }
    },
    {
      label: 'Collect for Reaping',
      name: 'reap',
      type: 'Boolean',
      public: false,
      readable: false,
      default: false
    },
    {
      label: 'Favorites',
      name: 'favorites',
      public: false,
      type: 'ObjectId',
      array: true,
      uniqueValues: true,
      readable: false,
      maxItems: -1
    },
    {
      label: 'Favorite',
      // description: 'Tags the context as a favorite, which can then be filtered using the API.',
      name: 'favorite',
      type: 'Boolean',
      readable: true,
      writable: true,
      virtual: true,
      readAccess: acl.AccessLevels.Connected,
      writeAccess: acl.AccessLevels.Connected,
      dependencies: ['favorites'],
      reader: function(ac) {
        return inIdArray(this.favorites, ac.principalId)
      },
      writer: function(ac, node, value) {
        var fav = !!value, is = inIdArray(this.favorites, ac.principalId)
        if (is !== fav) {
          if (fav) {
            this.favorites.addToSet(ac.principalId)
          } else {
            this.favorites.pull(ac.principalId)
          }
        }
        return Undefined
      }
    },
    {
      label: 'Posts',
      name: 'posts',
      type: 'Any',
      apiType: 'Reference[]',
      virtual: true,
      optional: true,
      dependencies: ['_id'],
      readAccess: acl.AccessLevels.Min,
      readable: true,
      groupReader: function(node, principal, entries, req, script, selection, callback) {

        const isProjection = !!selection.runtimeProcessor

        if (isProjection) {
          selection = selection.runtimeProcessor(node, principal, entries, req, script, selection)
        }

        let query = isProjection ? selection.projection : dotPath(pathTo(req, 'query'), selection.fullPath),
            readOpts = _.pick(query, 'unviewed', 'account', 'creator', 'patientFile', 'participants', 'postTypes', 'startingAfter', 'endingBefore', 'limit', 'skip', 'where', 'map', 'group', 'pipeline')

        readOpts.unviewed = stringToBoolean(query.unviewed)
        readOpts.filterCaller = stringToBoolean(query.filterCaller)
        readOpts.req = req
        readOpts.script = script
        readOpts.batchField = 'context._id'
        readOpts.batchValues = entries.map(function(v) { return v.output._id })
        readOpts.selectionTree = selection

        // set options at this level.
        selection.setOption('deferGroupReads', true)
        selection.setOption('forgiving', false)

        modules.db.models.Post.postList(principal, readOpts, function(err, lists) {
          if (!err) {
            entries.forEach(function(entry) {
              const result = lists.data[entry.output._id] || {
                object: 'list',
                data: [],
                hasMore: false
              }
              pathTo(entry.output, node.docpath, result)
            })
          }
          callback(err)
        })

      }

    },
    {
      label: 'Connections',
      name: 'connections',
      type: 'Any',
      apiType: 'Reference[]',
      // description: '',
      virtual: true,
      dependencies: ['_id'],
      readAccess: acl.AccessLevels.Connected,
      readable: true,
      optional: true,
      groupReader: function(node, principal, entries, req, script, selection, callback) {

        const isProjection = !!selection.runtimeProcessor,
              showable = ['creator', 'target'],
              states = [consts.connectionStates.pending, consts.connectionStates.active]

        if (isProjection) {
          selection = selection.runtimeProcessor(node, principal, entries, req, script, selection)
        }

        let isAccount = node.root.objectName === 'account',
            selfEntry = isAccount ? findIdInArray(entries, 'input._id', principal._id) : null,
            query = isProjection ? selection.projection : dotPath(pathTo(req, 'query'), selection.fullPath),
            readOpts = _.pick(query, 'state', 'show', 'startingAfter', 'endingBefore', 'limit', 'map', 'group', 'sort', 'where', 'skip', 'pipeline'),
            ac = pathTo(entries, '0.ac'),
            find,
            show,
            state

        readOpts.req = req
        readOpts.script = script
        readOpts.batchField = 'context._id'
        readOpts.batchValues = entries.map(function(v) { return v.output._id })
        readOpts.selectionTree = selection

        // set options at this level.
        selection.setOption('deferGroupReads', false)
        selection.setOption('forgiving', false)

        find = {
          org: principal.orgId,
          'context.object': this.objectName
        }

        if (query && query.show != null) {

          show = query.show
          if (!~showable.indexOf(show)) {
            return callback(Fault.create('cortex.invalidArgument.enumValue', { resource: ac.getResource(), path: showable }))
          }
          switch (show) {
            case 'creator':
              find['creator._id'] = principal._id
              break
            case 'target':
              find['target.account._id'] = principal._id
              break
          }

        } else {

          // the connection is viewable when:
          //      the caller is the target (in either state)
          //      the caller is the creator (in either state)
          //      the caller has share access (in either state)
          //      the caller has connected access and the state is active.
          let shareable = [], connected = []
          entries.forEach(function(v) {
            var ac = new acl.AccessContext(principal, v.input)
            if (ac.hasAccess(acl.AccessLevels.Share)) {
              shareable.push(v.output._id)
            } else if (ac.hasAccess(acl.AccessLevels.Connected)) {
              connected.push(v.output._id)
            }
          })
          find.$or = [{
            'target.account._id': principal._id
          }, {
            'creator._id': principal._id
          }]
          if (shareable.length > 0) {
            find.$or.push({ 'context._id': { $in: shareable } })
          }
          if (connected.length > 0) {
            find.$or.push({ state: consts.connectionStates.active, 'context._id': { $in: connected } })
          }

        }

        if (query && query.state != null) {
          state = rInt(query.state, -1)
          if (!~states.indexOf(state)) {
            return callback(Fault.create('cortex.invalidArgument.enumValue', { resource: ac.getResource(), path: states }))
          }
          find.state = state
        }

        // special case. when looking at their own account, the caller should see invitations to them on other account contexts.
        if (selfEntry) {

          find.$or = [{
            'context._id': find['context._id'], // @todo @bug https://github.com/Medable/MedableAPI/issues/290
            $or: find.$or
          }]
          delete find['context._id']

          find.$or.push({
            'target.account._id': principal._id
          })
        }

        setImmediate(function() {
          modules.db.models.Connection.nodeList(principal, find, readOpts, function(err, lists) {
            if (!err) {
              entries.forEach(function(entry) {

                var result = lists.data[entry.output._id] || {
                  object: 'list',
                  data: [],
                  hasMore: false
                }

                pathTo(entry.output, node.docpath, result)
              })

              // add any in the list where i am the target.
              if (selfEntry) {
                var connections = pathTo(selfEntry.output, node.docpath)
                Object.keys(lists.data).forEach(function(_id) {
                  lists.data[_id].data.forEach(function(connection) {
                    if (equalIds(pathTo(connection, 'target.account._id'), principal._id)) {
                      connections.data.push(connection)
                    }
                  })
                })
              }
            }
            callback(err)
          })
        })

      }
    },
    {
      label: 'Shared',
      name: 'shared',
      type: 'Boolean',
      // description: 'True if there are any active or pending connections for this context.',
      virtual: true,
      dependencies: ['_id'],
      readAccess: acl.AccessLevels.Connected,
      readable: true,
      groupReader: function(node, principal, entries, req, script, selection, callback) {

        const contextIds = entries.map(function(v) { return v.output._id }),
              find = {
                org: principal.orgId,
                'context.object': this.objectName,
                'context._id': { $in: contextIds }
              }

        if (contextIds.length === 0) {
          return callback()
        }

        modules.db.models.Connection.find(find).select('context._id').lean().exec(function(err, docs) {
          if (!err) {
            entries.forEach(function(entry) {
              pathTo(entry.output, node.docpath, _.some(docs, function(v) { return equalIds(v.context._id, entry.output._id) }))
            })
          }
          callback(err)
        })

      }
    },
    modules.db.definitions.getInstanceIndexDefinition()

  ]
}

// shared methods --------------------------------------------------------

ContextModelDefinition.methods = {
  isAccessSubject: function(including) {
    var self = this
    including = (_.isString(including) ? [including] : toArray(including)).map(function(v) { return normalizeObjectPath(v, true, true) }).filter(function(v) { return !!v })
    return _.every(this.constructor.requiredAclPaths.concat(including), function(path) { return self.isSelected(path) })
  },
  isOwner: function(principal) {
    return this.constructor.hasOwner && ap.is(principal) && this.isSelected('owner') && equalIds(principal._id, pathTo(this, 'owner._id'))
  },

  isCreator: function(principal) {
    return this.constructor.hasCreator && ap.is(principal) && this.isSelected('creator') && equalIds(principal._id, pathTo(this, 'creator._id'))
  }
}

// shared statics --------------------------------------------------------

ContextModelDefinition.statics = {

  __ObjectSchema__: true,

  computeShareAccessLevel: function(org, ac, desiredAccess, desiredRoles) {

    // establish a minimum for access level. orgs allow invitations which do not produce a connection but allow
    // invitation-only orgs to function without an invitation to a real object.
    const callerAccess = ac ? ac.resolved : acl.AccessLevels.System, // no acl amounts to skipAcl.
          shareChain = toArray(this.shareChain),
          shareAcl = toArray(this.shareAcl),
          minimum = this.objectName === 'org' ? acl.AccessLevels.None : acl.AccessLevels.Connected

    let shareAccessLevel = acl.AccessLevels.None,
        shareAccessRoles = []

    // start at one lower than the caller. shared access must always be lower than the caller access.
    desiredAccess = Math.max(minimum, Math.min(callerAccess - 1, acl.fixAllowLevel(desiredAccess, true)))
    desiredRoles = uniqueIdArray(desiredRoles)

    if (!ac) {

      shareAccessLevel = desiredAccess
      shareAccessRoles = desiredRoles.length === 0 ? desiredRoles : intersectIdArrays(desiredRoles, org.roles.map(v => v._id))

    } else if (shareAcl.length) {

      const orgRoleIds = org.roles.map(v => v._id),
            addEntry = (entry) => {
              if (isInt(entry.allow)) {
                shareAccessLevel = Math.min(desiredAccess, Math.max(shareAccessLevel, entry.allow))
              } else if (isId(entry.allow)) {
                if (inIdArray(desiredRoles, entry.allow) && inIdArray(orgRoleIds, entry.allow) && !inIdArray(shareAccessRoles, entry.allow)) {
                  shareAccessRoles.push(entry.allow)
                }
              }
            }
      for (let i = 0; i < shareAcl.length; i++) {
        const entry = shareAcl[i]
        switch (entry.type) {
          case acl.EntryTypes.Account:
            if (equalIds(entry.target, ac.principalId)) {
              addEntry(entry)
            }
            break
          case acl.EntryTypes.Self:
            if (ac.objectName === 'account' && equalIds(ac.subjectId, ac.principalId)) {
              addEntry(entry)
            }
            break
          case acl.EntryTypes.Role:
            if (ac.principal.hasRole(entry.target)) {
              addEntry(entry)
            }
            break
          case acl.EntryTypes.Owner:
            if (equalIds(ac.ownerId, ac.principalId)) {
              addEntry(entry)
            }
            break
          case acl.EntryTypes.Access:
            if (isInt(entry.target) && callerAccess >= entry.target) {
              addEntry(entry)
            }
            break
        }
      }

    } else if (shareChain.length) {

      // you should be able to give any access level as long as your access level is above the next step in the share chain.
      // (5, 2), 8 can give 5,4,3,2
      // but 5 can only give 2

      // find the spot in the chain from which to start (the callers access - 1) the share chain is in revers order, btw (eg, [5, 4, 2])
      for (let i = 0; i < shareChain.length; i++) {
        if (callerAccess > shareChain[i]) {
          shareAccessLevel = Math.min(shareChain[i], desiredAccess)
          break
        }
      }
      shareAccessLevel = Math.max(minimum, acl.fixAllowLevel(shareAccessLevel, true))
    }

    return [Math.min(shareAccessLevel, acl.AccessLevels.Delete), shareAccessRoles] // cannot share past Delete.
  },

  normalizePatchOperations: function(payload, pathPrefix) {

    let changedPaths = [],
        forceObjectType = null

    const operations = []

    // ensure array, cloning so we can append operations.
    payload = toArray(payload, !!payload).slice()

    // ensure correct payload format, and collect paths, while prepping payloads
    for (let i = 0; i < payload.length; i++) {

      let entry = payload[i],
          removedPath,
          path

      if (!isPlainObject(entry)) {
        throw Fault.create('cortex.invalidArgument.objectExpectedForPatchOperation')
      }
      const operation = {
        op: entry.op
      }
      path = _.isString(entry.path) ? normalizeObjectPath(entry.path.replace(/\//g, '.')) : null

      switch (operation.op) {
        case 'unset':
          if (!isPlainObject(entry.value)) {
            throw Fault.create('cortex.invalidArgument.objectExpectedForPatchValue')
          }
          if (pathPrefix) {
            path = path ? `${pathPrefix}.${path}` : pathPrefix
          }
          // convert to multiple removes.
          payload.splice(i + 1, 0, ...Object.keys(entry.value).reduce((entries, path) => {
            entries.push({
              op: 'remove',
              path: normalizeObjectPath(path, false, false, true)
            })
            return entries
          }, []))
          continue
        case 'pull':

          // if there is no path and the value is an object, explode into multiple removes.
          if (isPlainObject(entry.value)) {
            const ops = []
            visit(entry.value, {
              fnObj: (val, currentKey, parentObject, parentIsArray, depth, fullpath) => {
                if (!parentIsArray && Array.isArray(val)) {
                  ops.push({
                    op: 'remove',
                    path: fullpath,
                    value: val
                  })
                }
              },
              fnVal: (val, currentKey, parentObject, parentIsArray, depth, fullpath) => {
                if (!parentIsArray) {
                  ops.push({
                    op: 'remove',
                    path: fullpath,
                    value: val
                  })
                }
              }
            })
            payload.splice(i + 1, 0, ...ops)
            continue
          }

          // treat it like a remove, but a value must always exist
          if (!path || entry.value === Undefined) {
            throw Fault.create('cortex.invalidArgument.pathAndValueExpectedForPullOperation')
          }
          entry.op = 'remove'
          i--
          continue

        case 'remove':
          operation.method = 'put'
          // if there is no path and the value is an object, explode into multiple removes.
          if (!path && isPlainObject(entry.value)) {
            const ops = []
            visit(entry.value, {
              fnObj: () => {},
              fnVal: (val, currentKey, parentObject, parentIsArray, depth, fullpath, parentFullpath) => {
                ops.push({
                  op: 'remove',
                  path: parentFullpath,
                  value: val
                })
              }
            })
            payload.splice(i + 1, 0, ...ops)
            continue
          }
          if (pathPrefix) {
            path = path ? `${pathPrefix}.${path}` : pathPrefix
          }
          if (!path) {
            throw Fault.create('cortex.invalidArgument.stringExpectedforPatchPath')
          }
          operation.path = path

          // are we removing a value in an array somewhere? find the correct path in order to include the right paths.
          removedPath = normalizeObjectPath(path, true, true, true)

          // remove ops trigger a property delete if no value is set (for removable properties - so allow missing value)
          // ensure all values are primitives.
          if (entry.value !== Undefined) {
            operation.value = toArray(entry.value, true)
            for (let j = 0; j < operation.value.length; j++) {
              let val = operation.value[j]
              // this is temporary. we'll allow null with a revamp of remove.
              if (!(isPrimitive(val) || isId(val) || _.isDate(val))) {
                throw Fault.create('cortex.invalidArgument.primitiveExpectedforPatchRemoveValue')
              }
            }
          } else {

            // are we removing a value in an array somewhere? find the correct path in order to include the right paths.
            if (!this.schema.node.findTypedNode(removedPath)) {
              const testPath = removedPath.split('.')[0]
              if (this.schema.node.findTypedNode(testPath)) {
                removedPath = testPath
              }
            }
          }

          changedPaths = _.uniq(changedPaths.concat(removedPath))

          break
        case 'set':
        case 'push':

          if (operation.op === 'set' && rBool(entry.overwrite)) {
            operation.overwrite = true
          }

          operation.method = operation.op === 'set' ? 'put' : 'post'
          if (entry.value === Undefined) {
            throw Fault.create('cortex.invalidArgument.valueExpectedForPatchValue')
          } else {
            operation.value = entry.value
          }
          if (pathPrefix) {
            path = path ? `${pathPrefix}.${path}` : pathPrefix
          }
          if (entry.path !== Undefined && !path) {
            throw Fault.create('cortex.invalidArgument.stringExpectedforPatchPath')
          } else if (path) {
            operation.value = pathToPayload(path, operation.value)
            operation.singlePath = path
          } else if (!isPlainObject(operation.value)) {
            throw Fault.create('cortex.invalidArgument.objectExpectedForPatchValue')
          }
          changedPaths = _.uniq(changedPaths.concat(payloadToPaths(operation.value)))

          // for untyped objects becoming typed, the payload will have a type in it.
          if (operation.op === 'set' && !operation.singlePath && entry && entry.value && entry.value.type) {
            forceObjectType = entry.value.type
          }

          break
        default:
          throw Fault.create('cortex.unsupportedOperation.patchOp', { path: entry.op })

      }
      operations.push(operation)
    }

    return { operations, changedPaths, forceObjectType }

  },

  aclPatch: function(principal, match, payload, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)
    options = Object.assign({}, options, {
      returnAcs: true,
      skipAcl: true, // skip acl for loading single items in order to test for access on load.
      ignoreScriptTiming: true,
      limit: 1
    })

    this.aclPatchMany(principal, match, payload, options, (err, result) => {
      err = err || result.writeErrors[0]
      if (!err && result.accessContexts.length === 0) {
        err = Fault.create('cortex.notFound.instance', { resource: options.resourcePath, path: this.objectName, reason: this.objectName + ' not found.' })
      }
      const { ac, modified } = (!err && result && result.accessContexts && result.accessContexts[0]) || {}
      callback(err, { ac, modified })
    })

  },

  /**
   *
   * @param {AccessPrincipal} principal
   * @param {ObjectId|object} match
   * @param {object} payload
   * @param {object|function=} options
   *  req: null
   *  override: false, accesslevel, true, false
   *  method string, 'put', 'post''
   *  document: use an existing document. ENSURE required paths are already loaded.
   *  acOptions: null. an object containing options to set on the AccessContext.
   *  singlePath
   *  writer. this can do the writing.
   *  mergeDocuments: use merging instead of put/posts semantics
   *  disableTriggers: false.
   *
   * @param {function=} callback err, {ac, modified}
   */
  aclUpdate: function(principal, match, payload, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const _id = getIdOrNull(match, false),
          changedPaths = payloadToPaths(payload),
          isUnmanaged = options.isUnmanaged || this.isUnmanaged

    if (_id) {
      match = { _id }
    } else if (!isPlainObject(match)) {
      return callback(Fault.create('cortex.invalidArgument.matchExpected'), {})
    }

    modules.db.sequencedWaterfall(
      [

        // if there is a trigger, load the entire document.
        callback => {
          this._loadForUpdate(principal, match, changedPaths, pathTo(payload, 'type'), options, callback)
        },

        (ac, parser, selections, callback) => {
          if (_.isFunction(options.writer)) {
            options.writer(ac, payload, callback)
          } else {
            ac.singlePath = options.singlePath
            if (_.isFunction(options.beforeWrite)) {
              return options.beforeWrite(ac, payload, (err) => {
                if (err) {
                  return callback(err)
                }
                ac.subject.aclWrite(ac, payload, { mergeDocuments: options.mergeDocuments, overwriteUniqueKeys: options.overwriteUniqueKeys }, err => callback(err, ac))
              })
            }
            ac.subject.aclWrite(ac, payload, { mergeDocuments: options.mergeDocuments, overwriteUniqueKeys: options.overwriteUniqueKeys }, err => callback(err, ac))
          }

        },

        (ac, callback) => {
          ac.save({ changedPaths, isUnmanaged, disableTriggers: options.disableTriggers }, (err, modified) => {
            callback(err, { ac, modified })
          })
        }

      ],
      10,
      (err, result) => callback(err, result || {})
    )

  },

  aclCreateMany: function(principal, documents, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    let dissimilarTypes = false,
        insertIndex = 0

    callback = profile.fn(callback, 'ac.aclCreateMany')

    options = extend({
      req: null,
      script: null,
      locale: null,
      bypassCreateAcl: false,
      isUnmanaged: false,
      forceAllowCreate: false,
      ignoreObjectMode: false,
      override: false,
      grant: null,
      creatorId: null,
      ownerId: null,
      scoped: true,
      dryRun: false,
      defaultAcl: null,
      defaultAclOverride: false,
      beforeWrite: null,
      returnAcs: false,
      ignoreScriptTiming: false,
      disableTriggers: false,
      resourcePath: null,
      skipValidation: false
    }, options)

    if (!options.ignoreObjectMode && this.obeyObjectMode && !principal.org.configuration.objectMode.includes('c')) {
      return callback(Fault.create('cortex.invalidArgument.creationDisabled'))
    }

    documents = toArray(documents, documents)

    const Model = this.getModelForType(pathTo(documents, '0.type')),
          isUnmanaged = options.isUnmanaged || Model.isUnmanaged,
          result = {
            insertedCount: 0,
            insertedIds: [],
            writeErrors: [],
            accessContexts: options.returnAcs ? [] : Undefined
          },
          maxInserts = isUnmanaged ? principal.org.configuration.maxUnmanagedInserts : principal.org.configuration.maxManagedInserts,
          defaultAcl = acl.mergeAndSanitizeEntries(options.defaultAcl, options.defaultAclOverride || Model.defaultAcl)
          // script = options.script // @todo limit time to script time if we can. adding hasMore: true to result. do this for deleteMany as well.

    if (documents.length > maxInserts) {
      return callback(Fault.create('cortex.invalidArgument.maxInsertsPerCall', { resource: options.resourcePath, path: maxInserts }))
    }

    for (let i = 0; i < documents.length; i++) {
      if (this.getModelForType(documents[i] && documents[i].type) !== Model) {
        dissimilarTypes = true
        break
      }
    }
    if (dissimilarTypes) {
      const groupedByType = documents.reduce((groupedByType, document, originalIndex) => {
        let Model = this.getModelForType(document && document.type),
            groupedArray = groupedByType.get(Model)
        if (!groupedArray) {
          groupedArray = []
          groupedByType.set(Model, groupedArray)
        }
        groupedArray.push({ originalIndex, document })
        return groupedByType
      }, new Map())
      async.eachSeries(
        Array.from(groupedByType.entries()),
        ([Model, groupedArray], callback) => {
          const documents = groupedArray.map(v => v.document)
          function getOriginalIndex(index) {
            const document = documents[index]
            if (document) {
              const groupedEntry = groupedArray.find(entry => document === entry.document)
              if (groupedEntry) {
                return groupedEntry.originalIndex
              }
            }
            return -1
          }
          Model.aclCreateMany(principal, documents, options, (err, groupResults) => {
            if (!err && groupResults) {
              result.insertedCount += groupResults.insertedCount
              result.insertedIds.push(...groupResults.insertedIds.map(v => Object.assign(v, { index: getOriginalIndex(v.index) })))
              result.writeErrors.push(...groupResults.writeErrors.map(v => Object.assign(v, { index: getOriginalIndex(v.index) })))
              if (result.accessContexts && groupResults.accessContexts) {
                result.accessContexts.push(...groupResults.accessContexts.map(v => Object.assign(v, { index: getOriginalIndex(v.index) })))
              }
            }
            callback(err)
          })
        },
        err => {
          result.insertedIds.sort((a, b) => a.index - b.index)
          result.writeErrors.sort((a, b) => a.index - b.index)
          if (result.accessContexts) {
            result.accessContexts.sort((a, b) => a.index - b.index)
          }
          callback(err, result)
        }
      )
      return
    }

    if (!options.forceAllowCreate && noSkipCreateAcl.has(Model.objectName)) {
      return callback(Fault.create('cortex.accessDenied.instanceCreate'))
    }

    if (options.scoped) {
      const requiredScope = `object.create.${Model.objectName}` + (Model.objectTypeName ? `#${Model.objectTypeName}` : '')
      if (!modules.authentication.authInScope(principal.scope, requiredScope)) {
        return callback(Fault.create('cortex.accessDenied.scope', { resource: options.resourcePath, path: requiredScope }))
      }
    }

    async.mapLimit(
      documents,
      50,
      (payload, callback) => {

        const subject = (payload instanceof Model) ? payload : new Model(),
              ac = new acl.AccessContext(principal, subject, {
                override: options.override,
                grant: options.grant,
                roles: options.roles,
                locale: options.locale,
                req: options.req,
                method: 'post',
                scoped: false,
                script: options.script,
                dryRun: options.dryRun,
                passive: options.passive,
                object: Model,
                options: options.acOptions
              })

        ac.index = insertIndex++
        ac.inheritResource(options.resourcePath)

        subject.org = principal.orgId
        subject.object = Model.objectName
        if (Model.hasCreator) {
          subject.creator = { _id: getIdOrNull(options.creatorId) || principal._id }
        }
        if (Model.hasOwner) {
          subject.owner = { _id: getIdOrNull(options.ownerId) || principal._id }
        }

        if (_.isFunction(options.beforeWrite)) {
          return options.beforeWrite(ac, payload, (err) => {
            setImmediate(doWrite, err)
          })
        }
        setImmediate(doWrite)

        function doWrite(err) {

          ac.option('$defaultAcl', options.defaultAcl)
          ac.option('$defaultAclOverride', options.defaultAclOverride)
          ac.option('$createAcl', options.createAcl)
          ac.option('$createAclOverride', options.createAclOverride)
          ac.resolve(true, defaultAcl)
          if (!(options.bypassCreateAcl || principal.bypassCreateAcl)) {
            if (!ac.canCreate(options.createAcl, options.createAclOverride)) {
              return callback(Fault.create('cortex.accessDenied.instanceCreate'))
            }
          }

          if (!err && !ac.hasAccess(acl.AccessLevels.Public)) {
            err = Fault.create('cortex.accessDenied.instanceUpdate')
          }

          if (err) {
            err = Fault.from(err, false, true)
            err.index = ac.index
            result.writeErrors.push(err.toJSON())
            callback(null)
          } else {
            Model.schema.node.aclWrite(ac, subject, subject === payload ? {} : payload, { mergeDocuments: options.mergeDocuments, overwriteUniqueKeys: options.overwriteUniqueKeys }, err => {
              if (err) {
                err = Fault.from(err, false, true)
                err.index = ac.index
                result.writeErrors.push(err.toJSON())
                callback(null)
              } else if (isUnmanaged) {

                ac.save({ insert: false, isUnmanaged, disableTriggers: options.disableTriggers, skipValidation: options.skipValidation }, (err, insert) => {
                  if (err) {
                    err = Fault.from(err, false, true)
                    err.index = ac.index
                    result.writeErrors.push(err.toJSON())
                    callback(null)
                  } else {
                    callback(null, { ac, insert })
                  }
                })
              } else {

                ac.save({ isUnmanaged, disableTriggers: options.disableTriggers, skipValidation: options.skipValidation }, (err, modified) => {
                  if (err) {
                    err = Fault.from(err, false, true)
                    err.index = ac.index
                    result.writeErrors.push(err.toJSON())
                  } else {
                    result.insertedCount++
                    result.insertedIds.push({
                      _id: ac.subjectId,
                      index: ac.index
                    })
                    if (result.accessContexts) {
                      result.accessContexts.push({ ac, modified })
                    }
                  }
                  callback(null)
                })
              }
            })
          }
        }

      },
      (err, ops) => {
        ops = ops.filter(Boolean)
        if (err || !ops.length) {
          return callback(err, result)
        } else if (options.dryRun) {
          result.insertedIds = [...result.insertedIds, ops.map(op => ({ _id: op.insert._id, index: op.ac.index }))]
          return callback(null, result)
        }

        const bulkWrite = Model.collection.initializeUnorderedBulkOp()

        ops.forEach(op => bulkWrite.insert(op.insert))

        bulkWrite.execute((err, writeResult) => {

          if (_.isFunction(err?.result?.getWriteErrors)) {
            writeResult = err.result
            err = null
          }
          err = Fault.from(err)
          if (!writeResult) {
            return callback(err)
          }

          const writeErrors = writeResult.getWriteErrors().map(writeError => {
                  const ac = ops[writeError.index].ac
                  err = Fault.from(ac._detectIndexError(writeError, ac.subject), false, true)
                  err.index = ac.index
                  return err.toJSON()
                }),
                typedStats = new Map(),
                initialBulkInsertIndex = modules.db.initialBulkInsertIndex

          result.insertedCount += writeResult.nInserted
          result.insertedIds = [...result.insertedIds, ...writeResult.getInsertedIds().map(v => Object.assign(v, { index: v.index - initialBulkInsertIndex })).filter(v => !writeErrors.find(e => e.index === v.index))]
          result.writeErrors = [...result.writeErrors, ...writeErrors]

          ops.forEach(op => {
            if (result.insertedIds.find(({ _id }) => equalIds(op.ac.subject._id, _id))) {
              const { type } = op.ac.subject
              let entry = typedStats.get(type)
              if (!entry) {
                entry = { count: 0, size: 0 }
                typedStats.set(type, entry)
              }
              entry.count += 1
              entry.size += op.insert.meta.sz
              if (result.accessContexts) {
                result.accessContexts.push({ ac: op.ac, modified: op.ac.subject.readableModifiedPaths() })
              }
            }
          })
          for (const [type, { count, size }] of typedStats.entries()) {
            modules.db.models.Stat.addRemoveDocuments(principal.orgId, this.objectName, this.objectName, type, count, size)
          }
          callback(null, result)

        })

      }
    )

  },

  /**
   * @param principal
   * @param payload
   * @param {(object)=} options
   *  createAcl
   *  createAclOverride
   *  defaultAcl
   *  defaultAclOverride
   *  scoped: true.
   *  contextId. force an object id.
   *  mergeDocuments
   * @param {function=} callback err, { ac, modified }
   */
  aclCreate: function(principal, payload, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const contextId = getIdOrNull(options.contextId)
    if (contextId) {
      const beforeWrite = _.isFunction(options.beforeWrite) ? options.beforeWrite : (ac, payload, callback) => callback()
      options = Object.assign({}, options, {
        returnAcs: true,
        ignoreScriptTiming: true,
        beforeWrite: (ac, payload, callback) => {
          ac.subject._id = contextId
          beforeWrite(ac, payload, callback)
        }
      })
    } else {
      options = Object.assign({}, options, {
        returnAcs: true,
        ignoreScriptTiming: true
      })
    }

    this.aclCreateMany(principal, [payload || {}], options, (err, result) => {
      err = err || result.writeErrors[0]
      const { ac, modified } = (!err && result && result.accessContexts && result.accessContexts[0]) || {}
      callback(err, { ac, modified })
    })

  },

  /**
   *
   * @param principal
   * @param options
   *      paths: null, list of paths to read.
   *      include: null, optional paths to include. added to paths.
   *      expand: null, list of paths to expand.
   *      silent: false, produce access errors for path lookups.
   *      skipAcl: skip acl checking altogether and load all results. can be used with override. loading contexts by id always skips acl checking.
   *      accessLevel: if set, only returns results with the minimum set access level. ignored when contextData is passed.
   *      req:
   *      search: null <-- context specific searching. @todo search engine.
   *      where: match
   *      internalWhere: null. a query to be merged into the find.
   *      forceSingle: force treat as single lookup (even if contextData is null)
   *      skip: 0,
   *      limit: 100,
   *      allowNoLimit: false,
   *      defaultLimit: null
   *      startingAfter: null
   *      endingBefore: null,
   *      total: false // adds a total property to the resulting list.
   *      relaxParserLimits: skip query parser logical limits.
   *      skipParserIndexChecks: allow anything to be searched.
   *      defaultAcl - a custom default acl to apply to initial load matching.
   *      defaultAclOverride - true to override with passed in default, false to merge.
   *      allowSystemAccessToParserProperties
   *      throwNotFound: true,
   *      parserExecOptions: null, // eg. {cursor: {batchSize: 100}}
   *      forceObjectType: Undefined - forces loading of the document as the passed in typed model
   *      lightweight: for read only, load a lightweight data model that's much faster to read.
   *      nativePipeline: only for read only custom object cursors
   *
   * @param callback err, result (single doc if contextData was passed and was a single id, else a list), parser, selections
   */
  aclLoad: function(principal, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const Model = this,
          Definitions = modules.db.definitions,
          parserEngine = pathTo(options, 'parserExecOptions.engine'),
          isCrossOrg = options.crossOrg && principal.isSysAdmin() && config('contexts.crossOrgQueryable').includes(Model.objectName),
          parser = new local.Parser(principal, Model, { parserEngine, strict: options.strict, unindexed: options.unindexed || options.allowUnindexed, req: options.req, locale: options.locale, defaultLimit: options.defaultLimit, allowNoLimit: options.allowNoLimit, grant: options.grant, roles: options.roles, script: options.script, total: options.total, skipIndexChecks: options.skipParserIndexChecks, relaxLimits: options.relaxParserLimits, defaultAcl: options.defaultAcl, defaultAclOverride: options.defaultAclOverride, allowSystemAccessToParserProperties: options.allowSystemAccessToParserProperties }),
          select = this.schema.node.selectPaths(principal, extend({}, options)),
          masterNode = this.schema.node.typeMasterNode || this.schema.node

    let find = { reap: false, object: this.objectName },
        findTypes = masterNode.typed ? [...masterNode.typeNames, null] : [null]

    if (isCrossOrg) {
      select['org'] = true
    }
    if (options.forceSingle) {
      options.limit = 1
      delete options.startingAfter
      delete options.endingBefore
    }
    if ((options.startingAfter !== Undefined || options.endingBefore !== Undefined) && (options.where || options.sort)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'startingAfter/endingBefore is incompatible with where/sort.' }))
    }

    options.accessLevel = acl.fixAllowLevel(options.accessLevel)

    if (_.isString(options.paths)) options.paths = [options.paths]
    if (_.isString(options.include)) options.include = [options.include]
    if (_.isString(options.expand)) options.expand = [options.expand]

    // ----------------------------------------------------------------------------------

    if (!isCrossOrg) {
      find.org = principal.orgId
    }

    // apply scoping rules to lists so results only include allowed types.
    if (rBool(options.scoped, true)) {

      // whittle the list down to acceptable types, unless the base is in scope, in which case allow them all.
      const baseInScope = modules.authentication.authInScope(principal.scope, `object.read.${this.objectName}`, true, true)
      if (!baseInScope) {
        findTypes = findTypes.filter(type => type !== null && modules.authentication.authInScope(principal.scope, `object.read.${this.objectName}#${+type}`))
      }
      if (findTypes.length === 0) {
        return callback(Fault.create('cortex.accessDenied.scope', { resource: options.resourcePath, path: `object.read.${this.objectName}` }))
      }

    }

    find.type = findTypes.length === 1 ? findTypes[0] : { $in: findTypes }

    // -------------------------------------

    // native documents are only supported with cursors and custom objects with pipelines.
    if (options.nativePipeline) {
      if (!options.parserExecOptions || (!options.parserExecOptions.cursor && !options.parserExecOptions.explain) || !isCustomName(this.objectName)) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Native access is only available for aggregation cursors/explain with custom objects' }))
      }
    }

    try {
      parser.parse(options, select, clone(find))
    } catch (err) {
      return callback(err)
    }

    // -------------------------------------
    // the parser may have increased the required access level based on property acl requirements.
    options.accessLevel = Math.max(options.accessLevel, parser.accessLevel)

    if (!(options.skipAcl || principal.skipAcl) && !options.forceSingle && !this.isUnmanaged) {
      find = principal.accessQuery(new acl.AccessContext(principal, null, { object: this, grant: options.grant, roles: options.roles, locale: options.locale }), options.accessLevel, { defaultAcl: options.defaultAcl, defaultAclOverride: options.defaultAclOverride }, find)
    }
    parser.addRawMatch(find)

    if (options.internalWhere) {
      parser.addRawMatch(options.internalWhere)
    }

    if (options.returnParser) {
      return callback(null, null, parser, select)
    }

    try {

      parser.exec(options.parserExecOptions || {}, (err, result) => {

        if (err) {
          return callback(err)
        }
        if (_.isFunction(result.next)) { // <-- is cursor
          return callback(null, result, parser, select)
        }

        const tasks = []

        let start = config('runtime.recordReaderMetrics') ? process.hrtime() : null

        if (parser.isBatch()) {

          Object.keys(result.data).forEach(key => {
            tasks.push(callback => {
              async.mapSeries(result.data[key], (raw, callback) => {
                let err = null, doc = null
                try {
                  const SubjectModel = parser.discernDocumentModel(raw, options.forceObjectType)
                  if (options.lightweight) {
                    doc = Definitions.makeLightweightSubject(raw, SubjectModel)
                  } else {
                    doc = new SubjectModel(Undefined, parser.projectedPaths, true)
                    doc.init(raw, null, null, true)
                    doc.$raw = raw
                  }
                } catch (e) {
                  err = e
                }
                setImmediate(callback, err, doc)
              }, (err, map) => {
                if (!err) result.data[key] = map
                callback(err)
              })
            })
          })

        } else {

          tasks.push(callback => {

            async.mapSeries(result.data, (raw, callback) => {
              let err = null, doc = null
              try {
                const SubjectModel = parser.discernDocumentModel(raw, options.forceObjectType)
                if (options.lightweight) {
                  doc = Definitions.makeLightweightSubject(raw, SubjectModel)
                } else {
                  doc = new SubjectModel(Undefined, parser.projectedPaths, true)
                  doc.init(raw, null, null, true)
                  doc.$raw = raw
                }
              } catch (e) {
                err = e
              }
              setImmediate(callback, err, doc)
            }, (err, map) => {
              if (!err) result.data = map
              callback(err)
            })
          })

        }

        async.series(tasks, err => {

          if (start && !err) {
            const diff = process.hrtime(start), duration = ((diff[0] * 1e9 + diff[1]) / 1e6)
            if (options.lightweight) {
              readerMetrics.lightweightLoadCount += result.data.length
              readerMetrics.lightweightLoadMs += duration
              readerMetrics.avgLightweightLoadMs = (readerMetrics.lightweightLoadMs / readerMetrics.lightweightLoadCount).toFixed(3)
            } else {
              readerMetrics.loadCount += result.data.length
              readerMetrics.loadMs += duration
              readerMetrics.avgLoadMs = (readerMetrics.loadMs / readerMetrics.loadCount).toFixed(3)
            }
          }

          if (!err && options.forceSingle) {
            result = result.data[0]
            if (!result) {
              if (options.throwNotFound === false) {
                result = null
              } else {
                err = Fault.create('cortex.notFound.instance', { resource: options.resourcePath, path: this.objectName, reason: masterNode.objectName + ' not found.' })
              }
            }
          }
          callback(err, result, parser, select)
        })

      })

    } catch (err) {
      callback(err)
    }

  },

  /**
   *
   * @param {AccessPrincipal} principal
   * @param subject if already an access subject, the current loaded acl/aclcache is used. otherwise, it can be an contextId or array of context ids.
   * @param {function|object=} options
   *  include: array of additional paths to select. by default only the object's requiredAclPaths are loaded.
   *  req: req
   *  grant:
   *  passive
   *  throwNotFound
   * @param {function=} callback
   *
   * @result err, access context or list of access contexts.
   */
  getAccessContext: function(principal, subject, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    let include = options.include

    const isPrincipal = ap.is(principal)

    include = (_.isString(include) ? [include] : toArray(include)).map(function(v) { return normalizeObjectPath(v, true, true) }).filter(function(v) { return !!v })

    if (!isPrincipal) {
      return setImmediate(callback, null, acl.AccessLevels.None)
    } else if (acl.isAccessSubject(subject, include)) {
      return setImmediate(callback, null, (new acl.AccessContext(principal, subject, { grant: options.grant, roles: options.roles, req: options.req, script: options.script, locale: options.locale, pacl: options.pacl })).resolved)
    } else if (_.isArray(subject)) {
      const ids = getIdArray(subject)
      if (ids.length === 0) {
        callback(null, [])
      } else {
        this.aclLoad(principal, { internalWhere: { _id: { $in: ids } }, grant: options.grant, roles: options.roles, req: options.req, script: options.script, locale: options.locale, paths: include, limit: false, skipAcl: true }, (err, subjects) => {
          let out
          if (!err) {
            out = []
            subjects.data.forEach(function(subject) {
              out.push(new acl.AccessContext(principal, subject, { grant: options.grant, roles: options.roles, req: options.req, script: options.script, locale: options.locale, pacl: options.pacl }))
            })
          }
          callback(err, out)
        })
      }
    } else {
      const id = getIdOrNull(subject)
      if (!id) {
        callback(Fault.create('cortex.invalidArgument.invalidObjectId'))
      } else {
        this.aclLoad(principal, { internalWhere: { _id: id }, grant: options.grant, roles: options.roles, req: options.req, script: options.script, locale: options.locale, throwNotFound: options.throwNotFound, paths: include, limit: false, forceSingle: true, skipAcl: true }, (err, subject) => {
          callback(err, err ? null : new acl.AccessContext(principal, subject, { grant: options.grant, roles: options.roles, req: options.req, script: options.script, locale: options.locale, pacl: options.pacl, passive: options.passive }))
        })
      }
    }
  },

  /**
   *
   * @param principal
   * @param subject
   * @param options same options as aclLoad + the following:
   *      json: true // convert to plain object using acl read.
   *      override null. an acl access override. if 'true', sets to Max.
   *      grant null. an acl access level to grant (at least this level). resolved access equals Max(natural,grant). overridden by override
   *      document: null. if true, a source document is read in place of loading.
   *      acOptions: null. a list of options to pass into the resulting access contexts.
   *      hooks: true. set to false to skip hooks
   *      singlePath: null. if a string, a single path is being read. this is passed in the ac options to any readers.
   *      singleCursor: boolean false. works with singlePath. if true and the result is a list, a context cursor is returned.
   *      allowNullSubject: false
   *      pacl: custom property acls
   *      throwNotFound: true. if false, will return null if not found.
   *
   * @param callback err, result, ac.
   */
  aclReadOne: function(principal, subject, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    subject = getIdOrNull(subject, true)
    if (!subject && !options.allowNullSubject) {
      callback(Fault.create('cortex.invalidArgument.invalidObjectId'))
      return
    }
    options = extend({}, options, { forceSingle: true })
    if (subject) {
      options.where = { _id: subject }
    }
    if (options.document) {
      options.documents = [options.document]
    }

    this.aclList(principal, options, callback)

  },

  aclReadPath: function(principal, subject, singlePath, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    // options.paths = [path].concat(toArray(options.paths));
    options.singlePath = singlePath; // reading single path.

    // add relative path to all expand, include, paths.
    ['paths', 'include', 'expand'].forEach(function(key) {
      if (options[key]) {
        options[key] = toArray(options[key], true).map(function(entry) {
          return singlePath + '.' + entry
        })
      }
    })

    if (options.paths) {
      options.paths.push(singlePath)
    } else {
      options.paths = [singlePath]
    }

    this.aclReadOne(principal, subject, options, function(err, document, ac) {
      callback(err, err ? Undefined : digIntoResolved(document, singlePath, false, false, true), ac)
    })
  },

  aclUpdatePath: function(principal, match, path, value, options, callback) {

    if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }
    options.singlePath = path

    // create a payload with ids inserted as arrays.
    let payload
    try {
      payload = pathToPayload(path, value)
    } catch (err) {
      return callback(err, {})
    }

    this.aclUpdate(principal, match, payload, options, callback)
  },

  /**
   *
   * @param {AccessPrincipal} principal
   * @param {object} match
   * @param {object} path
   * @param {object|function=} options
   *  override: false, accesslevel, true, false
   *  grant
   *  defaultAcl
   *  defaultAclOverride
   *  acOptions: null. a jsobject containing options to set on the AccessContext.
   *  disableTriggers: false
   *
   * @param {function=} callback err, {ac, modified}
   */
  aclRemovePath: function(principal, match, path, options, callback) {

    this.aclPatch(principal, match, [{ op: 'remove', path: path }], options, callback)

  },

  aclDeleteMany: function(principal, match, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    options = extend({
      req: null,
      locale: null,
      script: null,
      ignoreObjectMode: false,
      override: false,
      scoped: true,
      crossOrg: false,
      roles: null,
      skipAcl: false,
      dryRun: false,
      haltOnError: false,
      forceLoad: false,
      single: false,
      forceAllowDelete: false,
      limit: 0,
      ignoreScriptTiming: false,
      grant: options.skipAcl ? acl.AccessLevels.Delete : null,
      disableTriggers: false,
      resourcePath: null
    }, options)

    options.limit = Math.max(0, rInt(options.limit, 0))

    const Model = this,
          Definitions = modules.db.definitions,
          defaultAcl = acl.mergeAndSanitizeEntries(options.defaultAcl, options.defaultAclOverride || this.defaultAcl),
          update = { $inc: { sequence: 1 }, $set: { reap: true, idx: { v: -1 } } },
          parserExecOptions = { maxTimeMS: config('query.defaultMaxTimeMS') },
          env = {
            forceLoad: options.forceLoad || options.limit,
            single: options.single,
            haltOnError: options.haltOnError,
            hasObjectHooks: Boolean(this.apiHooks.findHook('delete')),
            checkInstanceScope: options.scoped && !principal.inScope('*') && !principal.inScope(`object.delete.${this.objectName}`, false, true),
            cascadeDeleteProperties: false,
            triggersExists: false,
            triggerPaths: ['_id'],
            checkInstanceAcl: !this.isUnmanaged,
            mightHaveNotifications: false,
            mightHavePostsOrComments: this.isUnmanaged ? false : this.feedDefinition.count > 0
          }

    if (!isPlainObject(match)) {
      return callback(Fault.create('cortex.invalidArgument.matchExpected'))
    } else if (!this.isDeletable && !options.forceAllowDelete) {
      return callback(Fault.create('cortex.accessDenied.notDeletable', { resource: options.resourcePath, path: this.objectName }))
    } else if (!options.ignoreObjectMode && this.obeyObjectMode && !principal.org.configuration.objectMode.includes('d')) {
      return callback(Fault.create('cortex.invalidArgument.deletionDisabled'))
    } else if (options.scoped && !principal.inScope(`object.delete.${this.objectName}`)) {
      return callback(Fault.create('cortex.accessDenied.scope', { resource: options.resourcePath, path: `object.delete.${this.objectName}` }))
    } else if (this.dataset && this.dataset.targetCollection) {
      return callback(Fault.create('cortex.unsupportedOperation.unspecified', { resource: options.resourcePath, reason: 'deleting during an object migration is not supported.' }))
    }

    loadEnv(err => {

      if (err) {
        return callback(err)
      }

      // if possible, check for access only once. this must be done for un-managed objects (anything without instance acl)
      if (!options.skipAcl && !env.checkInstanceAcl) {
        const ac = new acl.AccessContext(principal, null, { req: options.req, script: options.script, locale: options.locale, method: 'delete', override: options.override, grant: options.grant, roles: options.roles, object: Model })
        ac.resolve(true, defaultAcl)
        ac.inheritResource(options.resourcePath)
        if (!ac.hasAccess(acl.AccessLevels.Delete)) {
          return callback(Fault.create('cortex.accessDenied.instanceDelete'), { resource: options.resourcePath })
        }
      }

      // if no environment properties are true, just call deleteMany on the match.
      if (Object.entries(env).every(([k, v]) => !v)) {

        const loadOptions = {
          paths: ['_id'],
          include: env.triggerPaths,
          returnParser: true,
          allowNoLimit: true,
          limit: false,
          where: isSet(match) && Object.keys(match).length === 0 ? null : match, // this will complain about having to pass _something_. if blank, leave it out.
          skipAcl: options.skipAcl,
          accessLevel: this.isUnmanaged || options.skipAcl ? null : acl.AccessLevels.Delete,
          defaultAcl: options.defaultAcl,
          defaultAclOverride: options.defaultAclOverride,
          parserExecOptions: options.parserExecOptions
        }

        Model.aclLoad(principal, loadOptions, (err, results, parser) => {
          if (err) {
            callback(err)
          } else if (options.dryRun) {
            parser.execCount(parserExecOptions, 0, null, (err, count) => {
              callback(Fault.from(err), count)
            })
          } else {
            // skip the sequencing but increment anyway to force others to re-read.
            Model.collection.updateMany(parser.buildMatch(), update, { writeConcern: { w: 'majority' } }, (err, result) => {
              err = Fault.from(err)
              const deletedCount = pathTo(result, 'modifiedCount') || 0
              if (deletedCount > 0) {
                recordAuditEvent(deletedCount)
                modules.workers.runNow('instance-reaper')
              }
              callback(err, deletedCount)
            })
          }
        })
        return
      }

      // ----------------------------------------------------------------------

      // delete in batches

      let hasMore = true,
          deletedCount = 0,
          limit = options.limit || false

      const batchSize = 100,
            maxExceptions = 1000,
            exceptions = [],
            canBatchUpdate = !(env.single || env.haltOnError || env.hasObjectHooks || env.triggersExists || env.mightHaveNotifications || env.mightHavePostsOrComments || env.cascadeDeleteProperties)

      async.whilst(

        () => hasMore,

        callback => {

          const loadOptions = {
            paths: ['_id'],
            include: env.triggerPaths,
            returnParser: true,
            where: isSet(match) && Object.keys(match).length === 0 ? null : match, // this will complain about having to pass _something_. if blank, leave it out.
            limit: limit === false ? batchSize : Math.min(limit, batchSize),
            skipAcl: options.skipAcl || options.single, // skip loading acl for single object
            accessLevel: options.skipAcl ? null : acl.AccessLevels.Delete,
            defaultAcl: options.defaultAcl,
            defaultAclOverride: options.defaultAclOverride,
            grant: options.grant,
            override: options.override,
            internalWhere: exceptions.length ? { _id: { $nin: exceptions } } : null,
            parserExecOptions: options.parserExecOptions
          }

          Model.aclLoad(principal, loadOptions, (err, results, parser) => {

            if (err) {
              return callback(err)
            }

            parser.exec(parserExecOptions, (err, result) => {

              const docs = toArray(result && result.data)

              if (limit !== false) {
                limit -= docs.length
              }

              if (options.dryRun || docs.length < batchSize || limit === 0) {
                // don't allow more that 1 batch of deletes for dry run or we'd go on forever
                // @todo document!
                hasMore = false
              }

              if (err || docs.length === 0) {
                callback(err)
              } else if (canBatchUpdate) {

                // ----------------------------------------------------------------------

                const updateIds = []
                for (let doc of docs) {
                  try {
                    checkIndividualAccess(parser, doc)
                    updateIds.push(doc._id)
                  } catch (err) {
                    if (handleError(err, doc, callback)) {
                      return
                    }
                  }
                }
                if (updateIds.length === 0) {
                  callback()
                } else if (options.dryRun) {
                  deletedCount += updateIds.length
                  callback()
                } else {
                  Model.collection.updateMany({ _id: { $in: updateIds }, reap: false }, update, { writeConcern: { w: 'majority' } }, (err, result) => {
                    cascadeDeleteOutputObjects(principal, updateIds)
                      .catch(e => { void e })
                      .then(() => {
                        err = Fault.from(err)
                        deletedCount += pathTo(result, 'modifiedCount') || 0
                        callback(err)
                      })
                  })
                }
              } else {

                // ----------------------------------------------------------------------

                async.eachSeries(
                  docs,
                  (doc, callback) => {
                    checkIndividualAccess(parser, doc, (err, ac) => {
                      if (err || !ac) {
                        return callback(err)
                      }
                      beforeDelete(ac, err => {
                        if (err) {
                          return handleError(err, doc, callback)
                        } else if (options.dryRun) {
                          deletedCount++
                          return callback()
                        }
                        ac.object.collection.updateOne({ _id: ac.subjectId, reap: false }, update, { writeConcern: { w: 'majority' } }, (err, result) => {
                          err = Fault.from(err)
                          const wasDeleted = pathTo(result, 'modifiedCount') === 1
                          if (wasDeleted) {
                            deletedCount++
                          }
                          afterDelete(err, ac, err => {
                            if (err) {
                              return handleError(err, doc, callback)
                            } else {
                              contextCleanup(ac)
                              callback()
                            }
                          })
                        })
                      })
                    })
                  },
                  callback
                )
              }
            })
          })
        },
        err => {

          if (!options.dryRun) {
            if (deletedCount) {
              recordAuditEvent(deletedCount)
              if (config('debug.instantReaping')) {
                const reaper = modules.workers.getWorker('instance-reaper'),
                      WorkerMessage = require('../../workers/worker-message'),
                      message = new WorkerMessage(null, reaper, { req: options.req })
                return reaper.process(message, {}, {}, () => {
                  callback(err, deletedCount)
                })
              } else {
                modules.workers.runNow('instance-reaper')
              }
            }
          }
          callback(err, deletedCount)
        }
      )

      function recordAuditEvent(deletedCount) {
        if (Model.auditing.enabled) {
          const ac = new acl.AccessContext(principal, null, { req: options.req, script: options.script, method: 'delete', override: options.override, grant: options.grant, roles: options.roles })
          modules.audit.recordEvent(ac, Model.auditing.category, 'delete', { metadata: { filter: match, deletedCount: deletedCount }, context: { object: Model.objectName } })
        }
      }

      function checkIndividualAccess(parser, doc, callback = null) {

        let subject, ac

        if (env.checkInstanceAcl || callback) {
          const Subject = parser.discernDocumentModel(doc)
          if (env.triggersExists || env.hasObjectHooks) {
            subject = new Subject(Undefined, parser.projectedPaths, true)
            subject.init(doc, null, null, true)
            subject.$raw = doc
          } else {
            subject = Definitions.makeLightweightSubject(doc, Subject)
          }
          ac = new acl.AccessContext(principal, subject, {
            req: options.req,
            script: options.script,
            locale: options.locale,
            method: 'delete',
            override: options.override,
            grant: options.grant,
            roles: options.roles,
            dryRun: options.dryRun
          })
          ac.inheritResource(options.resourcePath)
          ac.beginResource(Subject.schema.node.getResourcePath(ac, subject))
        }

        if (env.checkInstanceAcl) {
          if (defaultAcl) {
            ac.resolve(true, doc.acl && doc.acl.length ? acl.mergeAndSanitizeEntries(defaultAcl, doc.acl) : defaultAcl)
          }
          if (!ac.hasAccess(acl.AccessLevels.Delete)) {
            return handleError(Fault.create('cortex.accessDenied.instanceDelete', { resource: ac.getResource(), path: doc._id }), doc, callback)
          }
        }
        if (env.checkInstanceScope) {
          const scope = `object.delete.${ac.objectName}${doc.type ? ('#' + doc.type) : ''}.${doc._id}`
          if (!principal.inScope(scope)) {
            return handleError(Fault.create('cortex.accessDenied.scope', { resource: ac.getResource(), path: scope }), doc, callback)
          }
        }
        if (callback) {
          return setImmediate(callback, null, ac)
        }
        return ac
      }

      function handleError(err, doc, callback) {

        exceptions.push(doc._id)

        const maxed = exceptions.length >= maxExceptions,
              halt = env.haltOnError || maxed

        if (!env.haltOnError && maxed) {
          err = Fault.create('cortex.error.unspecified', { reason: `Too many errors. Check access control arguments.` })
        }
        if (callback) {
          callback(halt && err)
          return halt
        } else if (halt) {
          throw err
        }
        return false
      }

      function beforeDelete(ac, callback) {
        if (env.triggersExists) {
          modules.sandbox.triggerScript('delete.before', ac.script, ac, { disableTriggers: options.disableTriggers, attachedSubject: ac.subject }, { dryRun: options.dryRun }, err => {
            if (err || !env.hasObjectHooks) {
              return callback(err)
            }
            ac.object.fireHook('delete.before', null, { ac }, callback)
          })
        } else if (!env.hasObjectHooks) {
          callback()
        } else {
          ac.object.fireHook('delete.before', null, { ac }, callback)
        }
      }

      function afterDelete(err, ac, callback) {
        if (env.hasObjectHooks) {
          ac.object.fireHook('delete.after', err, { ac, modified: [] }, () => {
            if (err || !env.triggersExists) {
              return callback(err)
            }
            modules.sandbox.triggerScript('delete.after', ac.script, ac, { disableTriggers: options.disableTriggers, attachedSubject: ac.subject }, { modified: [] }, () => {
              callback()
            })
          })
        } else if (!env.triggersExists) {
          callback()
        } else {
          modules.sandbox.triggerScript('delete.after', ac.script, ac, { disableTriggers: options.disableTriggers, attachedSubject: ac.subject }, { modified: [] }, () => {
            callback()
          })
        }
      }

      async function cascadeDeleteOutputObjects(principal, subjectIds) {

        const ac = new acl.AccessContext(principal, null, {
                object: Model,
                req: options.req,
                script: options.script,
                locale: options.locale,
                method: 'delete',
                override: options.override,
                grant: options.grant,
                roles: options.roles,
                dryRun: options.dryRun
              }),
              { principalId, orgId, reqId, objectName } = ac

        // look for any OOs that could cascade delete
        try {

          const OutputObject = modules.db.models.oo,
                cascadingSubjectIds = (await OutputObject.collection
                  .aggregate([{
                    $match: {
                      org: orgId,
                      object: OutputObject.objectName,
                      type: null,
                      'context._id': { $in: subjectIds },
                      'context.object': objectName,
                      cascadeDelete: true
                    }
                  }, {
                    $group: {
                      _id: '$context._id'
                    }
                  }])
                  .toArray()).map(v => v._id)

          await promised(
            async,
            'eachLimit',
            cascadingSubjectIds,
            10,
            (subjectId, callback) => {

              modules.workers.send(
                'work',
                'cascade-deleter',
                {
                  req: reqId,
                  org: orgId,
                  principal: principalId,
                  subject: subjectId,
                  object: objectName,
                  oo: true // <-- cascade deleter picks this up as an output object.
                },
                {
                  reqId,
                  orgId
                }, err => {

                  if (err) {
                    logger.error('aclDeleteMany oo cascade delete error: ', { ...ac.toObject(), subjectId, ...toJSON(err, { stack: true }) })
                  }

                  callback()
                })

            }
          )

        } catch (err) {
          logger.error('aclDeleteMany oo cascade delete error: ', { ...ac.toObject(), subjectIds, ...toJSON(err, { stack: true }) })
        }

      }

      function contextCleanup(ac) {

        const start = profile.start(),
              { orgId: org, objectName: object } = ac,
              type = null,
              tasks = []

        if (env.cascadeDeleteProperties) {
          tasks.push(callback => {
            modules.workers.send('work', 'cascade-deleter', {
              req: ac.reqId,
              org: ac.orgId,
              principal: ac.principalId,
              subject: ac.subjectId,
              properties: env.cascadeDeleteProperties
            }, {
              reqId: ac.reqId,
              orgId: ac.orgId
            })
            callback()
          })
        }
        tasks.push(async() => cascadeDeleteOutputObjects(ac.principal, [ac.subjectId]))
        if (env.mightHaveNotifications) {
          tasks.push(callback => {
            modules.db.models.notification.collection.deleteMany({ 'context._id': ac.subjectId }, { writeConcern: { w: 'majority' } }, function(err) {
              if (err) logger.error('aclDeleteMany notification removal error: ', toJSON(err, { stack: true }))
              callback()
            })
          })
        }
        tasks.push(callback => {
          modules.db.models.history.collection.updateMany({ org, object, type, 'context._id': ac.subjectId }, { $set: { reap: true } }, { writeConcern: { w: 'majority' } }, function(err) {
            if (err) logger.error('aclDeleteMany history reap error: ', toJSON(err, { stack: true }))
            callback()
          })
        })
        if (env.mightHavePostsOrComments) {
          tasks.push(callback => {
            modules.db.models.post.collection.updateMany({ 'context._id': ac.subjectId }, { $set: { reap: true } }, { writeConcern: { w: 'majority' } }, function(err) {
              if (err) logger.error('aclDeleteMany post archival removal error: ', toJSON(err, { stack: true }))
              callback()
            })
          })
        }
        if (env.mightHavePostsOrComments) {
          tasks.push(callback => {
            modules.db.models.comment.collection.updateMany({ 'pcontext._id': ac.subjectId }, { $set: { reap: true } }, { writeConcern: { w: 'majority' } }, function(err) {
              if (err) logger.error('aclDeleteMany comment archival removal error: ', toJSON(err, { stack: true }))
              callback()
            })
          })
        }
        tasks.push(callback => {
          modules.db.models.connection.collection.deleteMany({ org: ac.orgId, 'context.object': object, 'context._id': ac.subjectId }, function(err) {
            if (err) logger.error('aclDeleteMany connections removal error: ', toJSON(err, { stack: true }))
            callback()
          })
        })
        if (ac.objectName === 'account') {
          tasks.push(callback => {
            acl.AclOperation.removeAllTargetEntries(ap.synthesizeAccount({ org: ac.org, accountId: ac.subjectId }), function(err) {
              if (err) logger.error(ac.object.objectName + '.remove. error removing acl entries for ' + ac.subjectId, { error: err })
              callback()
            })
          })
        }

        async.parallel(tasks, () => {
          profile.end(start, 'ctx.contextCleanup')
        })

      }

    })

    function loadEnv(callback) {
      if (Model.isUnmanaged) {
        callback()
      } else {
        async.parallel({
          cascadeDeleteProperties: callback => {
            modules.db.models.Object.getRemoteCascadeDeleteProperties(principal.orgId, Model.objectName, (err, props) => callback(err, props && props.length ? props : false))
          },
          triggersExists: callback => {
            if (options.disableTriggers) {
              callback(null, false)
            } else {
              modules.sandbox.triggerExists(principal, Model, DELETE_HOOKS, callback)
            }
          },
          triggerPaths: callback => {
            modules.sandbox.triggerPaths(principal, Model, DELETE_HOOKS, callback)
          },
          mightHaveNotifications: callback => {
            modules.db.models.notification.collection.countDocuments({ org: principal.orgId, 'context.object': Model.objectName }, { limit: 1 }, (err, count) => {
              callback(err, count > 0)
            })
          }
        }, (err, results) => {
          if (!err) {
            Object.assign(env, results)
          }
          callback(err)
        })
      }
    }

  },

  /**
   *
   * @param {AccessPrincipal} principal
   * @param {object} match. if null, relies on where, and returns the deleted id (like a lean update operation)
   * @param {object|function=} options
   *  req: null
   *  override: false, accesslevel, true, false
   *  grant
   *  method string, 'delete''
   *  acOptions: null. a jsobject containing options to set on the AccessContext.
   *  where: limiting userland where,
   *  defaultAcl
   *  defaultAclOverride
   *  scoped: true
   *  dryRun: false
   *
   * @param {function=} callback err, numberDeleted
   */
  aclDelete: function(principal, match, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const _id = getIdOrNull(match, false)
    if (_id) {
      match = { _id }
    } else if (!isPlainObject(match)) {
      return callback(Fault.create('cortex.invalidArgument.matchExpected'))
    }

    options = Object.assign({}, options, {
      single: true,
      haltOnError: true,
      forceLoad: true,
      limit: 1,
      ignoreScriptTiming: true
    })

    this.aclDeleteMany(principal, match, options, (err, deleteCount) => {
      err = err || (deleteCount === 0 && Fault.create('cortex.notFound.instance'))
      callback(err, deleteCount)
    })

  },

  aclPatchMany: function(principal, match, ops, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    let normalized

    options = Object.assign({
      req: null,
      script: null,
      locale: null,
      ignoreObjectMode: false,
      defaultAcl: null,
      defaultAclOverride: false,
      override: false,
      grant: null,
      scoped: true,
      dryRun: false,
      returnAcs: false,
      haltOnError: false,
      single: false,
      skipAcl: false,
      mergeDocuments: false,
      ignoreScriptTiming: false,
      disableTriggers: false,
      resourcePath: null
    }, options)

    if (!options.ignoreObjectMode && this.obeyObjectMode && !principal.org.configuration.objectMode.includes('u')) {
      return callback(Fault.create('cortex.invalidArgument.updateDisabled'))
    }

    const _id = getIdOrNull(match, false),
          pathPrefix = _.isString(options.path) ? normalizeObjectPath(options.path.replace(/\//g, '.')) : '',
          isUnmanaged = options.isUnmanaged || this.isUnmanaged,
          maxUpdates = options.script ? null : (isUnmanaged ? 1000 : 1000),
          minScriptTimeLeft = options.ignoreScriptTiming ? 0 : 250,
          result = {
            matchedCount: 0,
            modifiedCount: 0,
            updatedIds: [],
            writeErrors: [],
            accessContexts: options.returnAcs ? [] : Undefined,
            hasMore: false
          },
          script = options.script // @todo limit based on how much time is left in the script? or how man operations we can perform?

    try {
      options.normalized = normalized = this.normalizePatchOperations(ops, pathPrefix)
    } catch (err) {
      return callback(err)
    }

    if (_id) {
      match = { _id }
    }
    if (!isPlainObject(match)) {
      callback(Fault.create('cortex.invalidArgument.matchExpected'))
    } else if (normalized.operations.length === 0) {
      callback(Fault.create('cortex.invalidArgument.emptyOperationsPayload'))
    } else {
      modules.sandbox.triggerExists(principal, this, ['update.before', 'update.after'], (err, triggerExists) => {

        triggerExists = triggerExists && !isUnmanaged && !options.disableTriggers

        if (err) {
          return callback(err)
        }
        const loadOps = {
          crossOrg: options.crossOrg,
          req: options.req,
          script: options.script,
          locale: options.locale,
          skipAcl: options.skipAcl,
          grant: options.grant,
          roles: options.roles,
          where: isEmptyObject(match) ? null : match,
          limit: isEmpty(options.limit) ? (maxUpdates === null ? false : maxUpdates + 1) : options.limit,
          allowNoLimit: true,
          forUpdate: true,
          forceObjectType: normalized.forceObjectType,
          paths: triggerExists || normalized.forceObjectType ? null : normalized.changedPaths,
          include: triggerExists || normalized.forceObjectType ? normalized.changedPaths : null,
          parserExecOptions: extend(true, {
            cursor: {
              batchSize: 100
            },
            maxTimeMS: config('query.defaultMaxTimeMS')
          }, options.parserExecOptions)
        }

        this.aclLoad(principal, loadOps, (err, cursor, parser) => {
          if (err) {
            return callback(err)
          }
          let hasMore = true
          async.whilst(
            () => hasMore,
            callback => {
              cursor.next((err, raw) => {

                if (!err && raw) {
                  if ((maxUpdates !== null && result.matchedCount >= maxUpdates) || (hasMore && script && script.timeLeft < minScriptTimeLeft)) {
                    result.hasMore = !(hasMore = false)
                    return callback()
                  }
                } else if (err || !raw) {
                  hasMore = false
                  return callback(err)
                }

                result.matchedCount++

                const { operations, changedPaths, forceObjectType } = normalized,
                      SubjectModel = parser.discernDocumentModel(raw, forceObjectType)

                // the first time, we use the doc supplied by the cursor. sequence errors will force a load.
                let document = new SubjectModel(Undefined, parser.projectedPaths, true)
                document.init(raw, null, null, true)
                document.$raw = raw

                modules.db.sequencedFunction(
                  callback => {

                    // the first time, we use the doc supplied by the cursor. subsequently, we have to reload.
                    options.document = document

                    this._loadForUpdate(principal, { _id: raw._id }, changedPaths, forceObjectType, options, (err, ac) => {

                      if (err) {
                        return callback(err)
                      }
                      this._applyNormalizedOperations(ac, operations, options, err => {
                        if (err) {
                          return callback(err)
                        }
                        ac.save({ changedPaths, isUnmanaged, disableTriggers: options.disableTriggers }, (err, modified) => {
                          document = null
                          callback(err, ac, modified)
                        })
                      })
                    })
                  },
                  10,
                  (err, ac, modified) => {
                    if (err) {
                      result.writeErrors.push(Object.assign(toJSON(err), { _id: raw._id }))
                    } else {
                      if (modified.length > 0) {
                        result.modifiedCount++
                        result.updatedIds.push(_.pick(ac.subject, '_id', 'ETag', 'version'))
                      }
                      if (options.returnAcs) {
                        result.accessContexts.push({ ac, modified })
                      }
                    }
                    setImmediate(callback)
                  })

              })
            },

            err => {
              try {
                cursor.close(() => {
                })
              } catch (e) {
              }
              callback(err, result)
            }
          )
        })

      })

    }
  },

  aclCursor: function(principal, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    options.parserExecOptions = extend(true, {
      cursor: {
        batchSize: 100
      },
      maxTimeMS: config('query.defaultMaxTimeMS')
    }, options.parserExecOptions)

    options.allowNoLimit = true
    if (options.limit === null || options.limit === Undefined) {
      options.limit = false
    }
    options.lightweight = rBool(options.json, true) && !config('runtime.useHeavyReader')

    this.aclLoad(principal, options, (err, cursor, parser) => {
      if (err) {
        return callback(err)
      }
      callback(null, options.nativePipeline ? new NativeDocumentCursor(cursor, options.cursor) : new ContextCursor(this, parser, cursor, options))
    })

  },

  /**
   * Walk down a path and build an access context based on real or imaginary subjects.
   *
   * @todo support ending on properties and add node acl access to the ac result.
   *
   * @param principal
   * @param parts (string|array) for simulated objects {type, owner, creator}
   * @param options
   *  preMatch: use to narrow subject loading (for lists)
   *  requiredReferences: paths to load (for list linked references) if missing from document, they are added.
   * @param callback -> err, { ...ac, creatable, ...property }
   * @returns
   */
  buildAccessContext: function(principal, parts, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    parts = normalizeAcPathParts(parts)

    // ensure there is a subject. if not, attempt to build one from either an object, identifier or create default if there is no part or it does not exist.

    let Model = this,
        subject = null,
        readOptions = {
          json: false
        }

    if (couldBeId(parts[0])) {

      // create access subject from existing instance
      readOptions.paths = [...toArray(options.requiredReferences, options.paths), parts[0]] // only read the first part of the path
      subject = assignId(options.preMatch, getIdOrNull(parts.shift())) // use up the first part

    } else {

      // access subject from virtual document
      let part = isPlainObject(parts[0]) ? parts.shift() : {}, // use up parts
          document

      Model = this.getModelForType(part.type) // simulating a typed document.

      document = new Model()
      document._id = consts.emptyId
      document.org = principal.orgId
      document.object = Model.objectName
      if (Model.hasCreator) {
        document.creator = { _id: getIdOrNull(part.creator) || principal._id }
      }
      if (Model.hasOwner) {
        document.owner = { _id: getIdOrNull(part.owner) || principal._id }
      }
      toArray(options.requiredReferences).forEach((name) => {
        document[name] = { _id: getIdOrNull(part[name]) || consts.emptyId }
      })
      readOptions.allowNullSubject = true
      readOptions.document = document

    }

    readOptions.include = isPlainObject(parts[0]) ? Object.keys(parts[0]) : [parts[0]]

    Model.aclReadOne(principal, subject, readOptions, (err, document) => {

      if (err) {
        return callback(err)
      }

      const defaultAcl = acl.mergeAndSanitizeEntries(options.defaultAcl, options.defaultAclOverride || Model.defaultAcl),
            ac = new acl.AccessContext(principal, document, {
              override: options.override,
              grant: options.grant,
              roles: options.roles,
              req: options.req,
              scoped: false,
              script: options.script,
              locale: options.locale,
              dryRun: options.dryRun,
              passive: options.passive,
              object: Model
            })

      ac.resolve(true, defaultAcl)
      ac.subject.constructor.schema.node.aclAccess(ac, ac.subject, parts, options, callback)

    })

  },

  /**
   * reads a list of contexts as json.
   *
   * @param principal
   * @param options
   *      same options as aclLoad + the following:
   *      override null. an acl access override. if 'true', sets to Max.
   *      grant null. an acl access level to grant (at least this level). resolved access equals Max(natural,grant). overridden by override
   *      roles
   *      json: true
   *      acOptions: null. a list of options to pass into the resulting access contexts.
   *      documents: an optional list of already loaded subjects.
   *      total: false. adds a total to the resulting list.
   *      hooks: true,
   *      where: json query.
   *      sort: json sort. for group, sorts the results.
   *      silent: false. silence path errors.
   *      selectionTree: selection tree.
   *      defaultAcl. an overriding/mergeable object defaultAcl,
   *      defaultAclOverride. override or merge,
   *      allowSystemAccessToParserProperties: false,
   *      pacl: pacl
   *      defaultLimit: null.
   *      scoped: true, false to turn off scoping.
   *      forceSingle: false. if true, treats as a single load (for aclReadOne)
   *      dryRun: false, @FOR INTERNAL USE ONLY if true, uses subject documents down the line.
   *      readFromLinkedReferences: false, @INTERNAL USE ONLY. read paths from $__linked list documents.
   *      jsonTransformer: a reader called after aclRead, group reads and expanders.
   *
   * @param callback list
   */
  aclList: function(principal, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    let model = this,
        singleAc = null

    const acOptions = {
      override: options.override,
      grant: options.grant,
      roles: options.roles,
      req: options.req,
      locale: options.locale,
      dryRun: options.dryRun, // for lists that were updated/built with a dry-run.
      script: options.script,
      pacl: options.pacl,
      scoped: options.scoped,
      unindexed: options.unindexed,
      passive: options.passive,
      eq: ExpansionQueue.create(principal, options.req, options.script, options.eq),
      options: getOption(options, 'acOptions')
    }

    options.lightweight = rBool(options.json, true) && !config('runtime.useHeavyReader')

    async.waterfall([

      // load documents.
      function(callback) {
        var documents = getOption(options, 'documents')
        if (documents) {
          documents = {
            object: 'list',
            data: toArray(documents, true).filter(function(v) {
              return v && acl.isAccessSubject(v) && v.object === model.objectName
            }),
            hasMore: false
          }
          if (getOption(options, 'total')) {
            documents.total = documents.data.length
          }
          callback(null, documents, options.parser, options.selection)

        } else {
          model.aclLoad(principal, options, (err, documents, parser, selections) => {
            if (!err && options.forceSingle) {
              documents = {
                data: documents ? [documents] : []
              }
            }
            callback(err, documents, parser, selections)
          })
        }

      },

      // read/resolve. parser may be null!!!
      function(documents, parser, selections, callback) {

        if (rBool(options.json, true)) {

          var selectionTree = options.selectionTree || new SelectionTree(options)
          selectionTree.setOption('deferGroupReads', true)
          selectionTree.setOption('forgiving', true)
          selectionTree.setOption('readFromLinkedReferences', !!options.readFromLinkedReferences)

          if (parser) {
            parser.getUnwoundPaths().forEach(path => selectionTree.setTreatAsIndividualProperty(path))
          }

          let start = config('runtime.recordReaderMetrics') ? process.hrtime() : null

          async.mapLimit(documents.data, 1, function(document, callback) {

            const ac = singleAc = new acl.AccessContext(principal, document, acOptions)

            ac.option('$defaultAcl', options.defaultAcl)
            ac.option('$defaultAclOverride', options.defaultAclOverride)
            if (options.defaultAcl) {
              ac.resolve(true, acl.mergeAndSanitizeEntries(options.defaultAcl, options.defaultAclOverride || ac.object.defaultAcl, document.acl))
            }
            ac.singlePath = options.singlePath
            ac.singleCursor = options.singleCursor
            ac.singleOptions = options.singleOptions
            ac.singleCallback = options.singleCallback
            ac.readThroughPath = options.readThroughPath
            ac.initReadPath = options.initReadPath
            ac.inheritResource(options.resourcePath)

            document.aclRead(ac, selectionTree, callback)

          }, function(err, list) {

            if (err) {
              return callback(err, documents)
            }

            if (start) {
              const diff = process.hrtime(start), duration = ((diff[0] * 1e9 + diff[1]) / 1e6)
              if (options.lightweight) {
                readerMetrics.lightweightReadCount += list.length
                readerMetrics.lightweightReadMs += duration
                readerMetrics.avgLightweightReadMs = (readerMetrics.lightweightReadMs / readerMetrics.lightweightReadCount).toFixed(3)
              } else {
                readerMetrics.readCount += list.length
                readerMetrics.readMs += duration
                readerMetrics.avgReadMs = (readerMetrics.readMs / readerMetrics.readCount).toFixed(3)
              }
            }

            // perform deferred group reads. this allows the collection of expensive single property reads into batches (eg. shared and connections)
            model.schema.node.readGrouped(principal, list, options.req, options.script, function(err) {
              if (err) {
                return callback(err, documents)
              }
              documents.data = list
              acOptions.eq.expand(documents, function(err) {

                if (!err && options.jsonTransformer) {
                  async.mapSeries(documents.data, (json, callback) => {
                    options.jsonTransformer(principal, json, callback)
                  }, (err, list) => {
                    documents.data = list
                    callback(err, documents)
                  })
                } else {
                  callback(err, documents)
                }
              })
            })

          })

        } else {
          callback(null, documents)
        }

      },

      function(documents, callback) {
        if (options.forceSingle) {
          singleAc = singleAc || new acl.AccessContext(principal, documents.data[0], acOptions)
          return callback(null, documents.data[0], singleAc)
        }
        callback(null, documents)
      }

    ], callback)

  },

  aclCount: function(principal, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    let findTypes,
        find = { reap: false, object: this.objectName }

    const Model = this,
          masterNode = this.schema.node.typeMasterNode || this.schema.node,
          parserEngine = pathTo(options, 'parserExecOptions.engine'),
          isCrossOrg = options.crossOrg && principal.isSysAdmin() && config('contexts.crossOrgQueryable').includes(Model.objectName),
          parser = new local.Parser(principal, Model, { parserEngine, req: options.req, allowNoLimit: options.allowNoLimit, locale: options.locale, grant: options.grant, roles: options.roles, script: options.script, total: options.total, skipIndexChecks: options.skipParserIndexChecks, relaxLimits: options.relaxParserLimits, defaultAclOverride: options.defaultAclOverride, allowSystemAccessToParserProperties: options.allowSystemAccessToParserProperties })

    options.accessLevel = acl.fixAllowLevel(options.accessLevel)

    if (!isCrossOrg) {
      find.org = principal.orgId
    }

    // apply scoping rules so results only include allowed types.
    // whittle the list down to acceptable types, unless the base is in scope, in which case allow them all.
    findTypes = masterNode.typed ? [...masterNode.typeNames, null] : [null]
    if (rBool(options.scoped, true)) {
      const baseInScope = modules.authentication.authInScope(principal.scope, `object.read.${this.objectName}`, true, true)
      if (!baseInScope) {
        findTypes = findTypes.filter(type => type !== null && modules.authentication.authInScope(principal.scope, `object.read.${this.objectName}#${+type}`))
      }
      if (findTypes.length === 0) {
        return callback(Fault.create('cortex.accessDenied.scope', { path: `object.read.${this.objectName}` }))
      }
    }
    find.type = findTypes.length === 1 ? findTypes[0] : { $in: findTypes }

    try {
      const parserOptions = {}
      if (options.where) {
        parserOptions.where = options.where
      }
      parser.parse(parserOptions, { _id: 1 }, clone(find))
    } catch (err) {
      return callback(err)
    }

    // the parser may have increased the required access level based on property acl requirements.
    options.accessLevel = Math.max(options.accessLevel, parser.accessLevel)

    if (!(options.skipAcl || principal.skipAcl)) {
      find = principal.accessQuery(new acl.AccessContext(principal, null, { object: this, roles: options.roles }), options.accessLevel, { defaultAcl: options.defaultAcl, defaultAclOverride: options.defaultAclOverride }, find)
    }
    parser.addRawMatch(find)

    if (options.internalWhere) {
      parser.addRawMatch(options.internalWhere)
    }

    try {
      parser.execCount(options.parserExecOptions || {}, options.skip, options.limit, (err, count) => callback(err, count))
    } catch (err) {
      callback(err)
    }

  },

  _loadForUpdate: function(principal, match, changedPaths, forceObjectType, options, callback) {

    if (!options.ignoreObjectMode && this.obeyObjectMode && !principal.org.configuration.objectMode.includes('u')) {
      return callback(Fault.create('cortex.invalidArgument.updateDisabled'))
    }

    const Model = this

    // if there is a trigger, load the entire document.
    // #179 now loading all fields instead of selecting for old when there is a trigger.
    if (options.document) {
      if (!acl.isAccessSubject(options.document)) {
        callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Supplied update document is not an access subject.' }))
      } else {
        gotDocument(options.document, null, null)
      }
    } else {
      modules.sandbox.triggerExists(principal, this, ['update.before', 'update.after'], (err, triggerExists) => {
        if (err) {
          return callback(err)
        }
        const loadOps = {
          crossOrg: options.crossOrg,
          req: options.req,
          script: options.script,
          locale: options.locale,
          skipAcl: options.skipAcl,
          grant: options.grant,
          roles: options.roles,
          passive: options.passive,
          forceObjectType: forceObjectType,
          forceSingle: true,
          forUpdate: true,
          where: match,
          paths: triggerExists || forceObjectType ? null : changedPaths, // load all paths for trigger "old",
          include: triggerExists || forceObjectType ? changedPaths : null // in case these are optional paths, ensure they are included
        }

        this.aclLoad(principal, loadOps, (err, document, parser, selections) => {
          if (err) {
            return callback(err)
          }
          gotDocument(document, parser, selections)
        })

      })
    }

    function gotDocument(document, parser, selections) {

      const ac = new acl.AccessContext(principal, document, {
        req: options.req,
        method: options.method,
        script: options.script,
        locale: options.locale,
        override: options.override,
        grant: options.grant,
        roles: options.roles,
        passive: options.passive,
        options: options.acOptions,
        dryRun: options.dryRun
      })
      ac.option('$defaultAcl', options.defaultAcl)
      ac.option('$defaultAclOverride', options.defaultAclOverride)
      ac.inheritResource(options.resourcePath)
      if (options.defaultAcl) {
        ac.resolve(true, acl.mergeAndSanitizeEntries(options.defaultAcl, options.defaultAclOverride || Model.defaultAcl, document.acl))
      }
      if (!ac.hasAccess(acl.AccessLevels.Public)) {
        return callback(Fault.create('cortex.accessDenied.instanceUpdate'))
      }
      callback(null, ac, parser, selections)

    }

  },

  /**
   * warning: models are converted to plain objects for the output list.
   * the passed in documents will be modified in place and are processed deeply.
   *
   * @principal
   * @inputFields fields can be an array of strings, or an array of objects (eg. {name: "patientFile", expanded: "patientFile"}
   * @items
   * @options
   * {
         *      reap: false,
         *      grant: acl.AccessLevels.Public,
         *      deep: false,
         *      expander: custom expander function.
         *      req: null,
         *      script: null
         * }
   * @callback
   *
   *
   *
   * the callback will produce: err, and the original/modified documents/lists passed in (err, doc, list, list, ...)
   */
  expandFields: function(principal, inputFields, items, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    if (!_.isArray(items)) items = [items]

    options = extend(true, {
      reap: false,
      deep: true,
      grant: acl.AccessLevels.Public,
      roles: [],
      expander: null,
      req: null
    }, options)

    let fields = {},
        fieldNames,
        refs = {},
        refIds = []

    ;[].concat(inputFields).forEach(function(field) {
      var expanded
      if (isPlainObject(field)) {
        expanded = String(field.expanded)
        field = String(field.name)
      } else {
        field = expanded = String(field)
      }
      fields[field] = expanded
    })

    fieldNames = Object.keys(fields)

    if (fieldNames.length === 0) {
      callback.apply(null, [null].concat(items))
    }

    fieldNames.forEach(function(field) {
      refs[field] = {}
    })

    // recursively find creators and owners in plain objects.
    function findFields(doc) {
      let isArray = _.isArray(doc), isObject = (!isArray && isPlainObject(doc))
      if (isArray || isObject) {
        if (options.deep && isArray) {
          doc.forEach(function(item) {
            findFields(item)
          })
        } else {
          fieldNames.forEach(function(field) {
            let fieldId
            if (doc.hasOwnProperty(field) && (fieldId = getIdOrNull(doc[field]))) {
              let strField = fieldId.toString()
              if (!refs[field][strField]) {
                refs[field][strField] = [doc]
              } else {
                refs[field][strField].push(doc)
              }
              refIds.push(fieldId)
            }
          })
          // look for children?
          if (options.deep) {
            Object.keys(doc).forEach(function(i) {
              if (isPlainObject(doc[i]) || _.isArray(doc[i])) {
                findFields(doc[i])
              }
            })
          }
        }
      }
    }

    items.forEach(function(docOrList, i, a) {
      if (docOrList) {
        // first, convert and store the item in the list we will output.
        if (_.isFunction(docOrList.toJSON)) a[i] = docOrList = docOrList.toJSON()

        // now search for documents to change.
        if (_.isArray(docOrList)) {
          docOrList.forEach(function(doc, i, a) {
            if (doc) {
              if (_.isFunction(doc.toJSON)) a[i] = doc = doc.toJSON()
              findFields(doc)
            }
          })
        } else {
          findFields(docOrList)
        }
      }
    })

    // get an array of ids and look up basic profile information.
    this.expandIds(principal, refIds, options, function(err, resolved) {
      if (!err) {
        for (let id in resolved) {
          if (resolved.hasOwnProperty(id)) {
            let strId = id.toString()
            fieldNames.forEach(function(field) {
              if (refs[field][strId]) {
                refs[field][strId].forEach(function(doc) {
                  doc[fields[field]] = clone(resolved[id])
                })
              }
            })
          }
        }
      }
      callback.apply(null, [err].concat(items))
    })

  },

  /**
   * does not check access. instead, resolves access and delivers a list based on a minimum of Public. does not include owner/creator.
   *
   * @param principal the calling principal
   * @param ids an array of ids
   * @param options
   * @param callback err, and an object keyed by _id
   */
  expandIds: function(principal, ids, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    if (!ap.is(principal)) {
      callback(Fault.create('cortex.accessDenied.noCredentialsSupplied'))
      return
    }

    var model = this

    options = extend(true, {
      req: null,
      reap: false,
      override: false,
      expander: null, // function
      expand: null,
      paths: null,
      include: null,
      internalWhere: null,
      json: true,
      grant: acl.AccessLevels.Public,
      roles: []
    }, options)

    ids = uniqueIdArray(ids)
    if (ids.length === 0) {
      callback(null, {})
      return
    }

    async.waterfall([

      // get all objects in the list and resolve access on lookup.
      function(callback) {

        if (_.isFunction(options.expander)) {

          options.expander(ids, function(err, list) {
            callback(err, list)
          })

        } else {

          var listOptions = extend({}, options, {
            limit: false,
            skipAcl: true,
            internalWhere: extend({ _id: { $in: ids } }, options.internalWhere)
          })

          model.aclList(principal, listOptions, callback)

        }

      },

      // prepare the output.
      function(list, callback) {
        var output = {}
        list.forEach(function(doc) {
          output[doc._id] = doc
        })
        callback(null, output)
      }

    ], callback)

  },

  getPostModel: function(postType, throwErr) {
    if (!this.postModels[postType]) {
      let postDef = _.find(this.feedDefinition, function(postDef) { return postDef.postType === postType || equalIds(postDef.postTypeId, postType) })
      if (postDef) {
        try {

          let model = postDef.generateMongooseModel('posts')
          model.parentObject = this

          this.postModels[postType] = model

        } catch (err) {
          logger.error('post model construction failure', err.toJSON())
          if (throwErr) {
            throw err
          }
        }
      }
    }
    return this.postModels[postType]
  },

  getModelForType: function(type) {

    let model = this, root = this.schema.node.typeMasterNode || this.schema.node

    if (root.typed && type != null) {

      let node, typeId = getIdOrNull(type)

      if (typeId) {
        node = root.findTypedById(typeId)
        if (!node) {
          return model
        }
      } else {
        node = root.findTypedByName(type)
        if (!node) {
          return model
        }
      }
      model = node.model
    }
    return model

  },

  _applyNormalizedOperations: function(ac, operations, options, callback) {

    async.eachSeries(
      operations,
      (operation, callback) => {
        ac.method = operation.op === 'push' ? 'post' : 'put'
        ac.singlePath = operation.singlePath
        if (options.opCheck) {
          try {
            options.opCheck(ac, operation)
          } catch (err) {
            return callback(err)
          }
        }
        if (operation.op === 'remove') {
          if (operation.value) {
            async.eachSeries(operation.value, (value, callback) => {
              ac.subject.aclRemove(ac, operation.path + '.' + value, callback)
            }, callback)
          } else {
            ac.subject.aclRemove(ac, operation.path, callback)
          }
        } else {
          ac.subject.aclWrite(
            ac,
            operation.value,
            {
              op: operation.op,
              overwrite: operation.overwrite,
              mergeDocuments: options.mergeDocuments,
              overwriteUniqueKeys: options.overwriteUniqueKeys
            },
            callback
          )
        }
      },
      callback
    )
  }

}

// ----------------------------------------------------------------

ContextModelDefinition.prototype.export = async function(ac, doc, resourceStream, parentResource, options) {

  const root = this.getDefinitionForType(doc.type),
        key = doc && doc[this.uniqueKey],
        resourcePath = `${doc.object}.${key}`

  if (!resourceStream.addPath(resourcePath, parentResource, options)) {
    return Undefined
  } else if (!this.uniqueKey) {
    throw Fault.create('cortex.invalidArgument.uniqueKeyRequiredForExport', { resource: ac.getResource(), path: doc.object })
  } else if (!key) {
    if (resourceStream.silent) {
      return Undefined
    }
    throw Fault.create('cortex.unsupportedOperation.uniqueKeyNotSet', { resource: ac.getResource(), path: `${this.objectName}.${this.uniqueKey}` })
  }

  let object = await ModelDefinition.prototype.export.call(root, ac, doc, resourceStream, resourcePath, { ...options, required: true })

  if (object !== Undefined) {
    object.object = this.objectName
    delete object.acl
    resourceStream.exportResource(object, resourcePath)
  }

  return object

}

ContextModelDefinition.prototype.import = async function(ac, value, resourceStream, parentResource, options) {

  const root = this.getDefinitionForType(value && value.type),
        resourcePath = value.resource,
        { manifest } = resourceStream,
        [objectName, uniqueKey] = pathParts(resourcePath),

        // deferral only works up to 2 levels on custom properties within document arrays with keys.
        prepDoc = (node, doc, parentPath, uniqueKeyName, uniqueKeyValue, recurse = false) => {

          const deferred = {}

          if (isPlainObject(doc)) {

            for (const key of Object.keys(doc)) {

              const docNode = key !== uniqueKeyName && isCustomName(key) && node.properties.hasOwnProperty(key) && node.properties[key]
              if (!docNode) {
                continue
              }

              if (manifest.shouldDefer(`${parentPath}.${docNode.path}`)) {

                if (!uniqueKeyName) {
                  throw Fault.create('cortex.invalidArgument.uniqueKeyRequiredForExport', {
                    resource: parentPath,
                    path: node.fqpp
                  })
                } else if (!uniqueKeyValue) {
                  throw Fault.create('cortex.unsupportedOperation.uniqueKeyNotSet', {
                    resource: parentPath,
                    path: `${node.fqpp}.${uniqueKeyName}`
                  })
                }

                deferred[key] = doc[key]
                delete doc[key]
                continue
              }

              if (recurse && docNode.getTypeName() === 'Document') {

                if (docNode.array) {

                  const docArr = toArray(doc[key], doc[key]),
                        deferredArr = [],
                        childUniqueKeyName = docNode.uniqueKey

                  for (let i = 0; i < docArr.length; i += 1) {

                    const childUniqueKeyValue = docArr[i] && docArr[i][childUniqueKeyName],
                          { deferred: childDeferred } = prepDoc(docNode, docArr[i], `${parentPath}.${docNode.path}`, childUniqueKeyName, childUniqueKeyValue)

                    if (Object.keys(childDeferred).length) {
                      childDeferred[childUniqueKeyName] = childUniqueKeyValue
                      deferredArr.push(childDeferred)
                    }
                  }

                  if (deferredArr.length) {
                    deferred[key] = deferredArr
                    if (Object.keys(docArr).length === 0) {
                      delete doc[key]
                    }
                  }

                } else {

                  const { doc: childDoc, deferred: childDeferred } = prepDoc(docNode, doc[key], `${parentPath}.${docNode.path}`, uniqueKeyName, uniqueKeyValue)

                  if (Object.keys(childDeferred).length) {
                    deferred[key] = childDeferred
                    if (Object.keys(childDoc).length === 0) {
                      delete doc[key]
                    }
                  }

                }

              }

            }

          }

          return { doc, deferred }

        },
        { doc, deferred } = prepDoc(
          root,
          value,
          this.objectName,
          this.uniqueKey,
          uniqueKey,
          true
        ),
        owner = this.hasOwner && manifest.getImportOwner(resourcePath)

  // if there is no owner prop in the source document and we want one, add it.
  if (owner && !isSet(doc.owner)) {
    doc.owner = owner
  }

  let def = await ModelDefinition.prototype.import.call(root, ac, doc, resourceStream, parentResource, { ...options, nodePath: resourcePath })

  if (def === Undefined || !resourceStream.addPath(resourcePath, parentResource, options)) {

    return Undefined

  } else {

    const model = await promised(ac.org, 'createObject', objectName),
          uniqueKeyNode = model.schema.node.findNode(this.uniqueKey),
          castValue = uniqueKeyNode.castForQuery(ac, uniqueKey)

    let identifier,
        subject = await promised(
          model,
          'aclReadOne',
          ac.principal,
          null,
          { req: ac.req, script: ac.script, allowNullSubject: true, throwNotFound: false, internalWhere: { [this.uniqueKey]: castValue }, paths: ['_id', this.uniqueKey] }
        ),
        // @hack capture hooks to set into new ac on beforeWrite
        hooks = ac.$__hooks,
        writeOptions = {
          passive: true,
          method: subject ? 'put' : 'post',
          mergeDocuments: true,
          req: ac.req,
          script: ac.script,
          overwriteUniqueKeys: true,
          disableTriggers: resourceStream.disableTriggers,
          acOptions: {
            isImport: true
          },
          beforeWrite: (ac, payload, callback) => {
            ac.subject[this.uniqueKey] = castValue
            // @hack to keep hooks on ac
            if (ac.$__hooks === null && hooks !== null) {
              ac.$__hooks = hooks
            }
            callback()
          }
        }

    if (subject) {
      def._id = subject._id
      subject = (await promised(model, 'aclUpdate', ac.principal, subject._id, def, writeOptions)).ac.subject
    } else {
      subject = (await promised(model, 'aclCreate', ac.principal, def, writeOptions)).ac.subject
    }

    if (Object.keys(deferred).length) {
      resourceStream.deferResource(resourcePath, async(ac) => {
        const def = await ModelDefinition.prototype.import.call(root, ac, deferred, resourceStream, parentResource, { ...options, nodePath: resourcePath })
        if (def !== Undefined) {
          await promised(
            subject.constructor,
            'aclUpdate',
            ac.principal,
            subject._id,
            deferred,
            {
              req: ac.req,
              script: ac.script,
              mergeDocuments: true,
              passive: true,
              method: 'put',
              disableTriggers: resourceStream.disableTriggers
            }
          )
        }
        return true
      })
    }

    try {
      identifier = uniqueKeyNode.reader
        ? uniqueKeyNode.reader.call(subject, ac, uniqueKeyNode)
        : pathTo(subject, uniqueKeyNode.docpath)
    } catch (e) {
      identifier = subject[this.uniqueKey]
    }

    return {
      _id: subject.objectName === 'object' ? subject.lookup : subject._id, // for cache lookups
      [this.uniqueKey]: identifier
    }

  }

}

ContextModelDefinition.ContextCursor = ContextCursor

module.exports = ContextModelDefinition
