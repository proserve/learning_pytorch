'use strict'

const modules = require('../../../modules'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      acl = require('../../../acl'),
      utils = require('../../../utils'),
      { CacheNode } = require('cortex-service/lib/memory-cache'),
      config = require('cortex-service/lib/config'),
      fs = require('fs'),
      _ = require('underscore'),
      path = require('path'),
      async = require('async'),
      local = {
        _ContextModelDefinition: null,
        _DocumentDefinition: null,
        _SetDefinition: null,
        _PropertyDefinition: null,
        _PropertySetDefinition: null,
        _BaseFileProcessorDefinition: null,
        _BaseMappingDefinition: null,
        _PostTypeDefinition: null,
        _SelectionTree: null
      },
      // _stopAt = ['properties', 'feedDefinition.body.properties', 'feedDefinition.comments.properties', 'objectTypes.properties'],
      _propProps = ['readable', 'name', 'label', 'type', 'readAccess'],
      _setDocProps = ['_id', 'name', 'label', 'properties'],
      INDEX_SLOTS = module.exports.INDEX_SLOTS = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9', 'i10', 'i11', 'i12', 'i13', 'i14', 'i15', 'i16', 'i17', 'i18', 'i19', 'i20'],
      UNIQUE_SLOTS = module.exports.UNIQUE_SLOTS = ['u1', 'u2', 'u3', 'u4', 'u5'],
      // COMPOUND_SLOTS = module.exports.COMPOUND_SLOTS = ['ci1', 'ci2', 'ci3', 'ci4', 'ci5'],
      GEOMETRY_SLOTS = module.exports.GEOMETRY_SLOTS = ['g1', 'g2', 'g3'],

      // always up-to-date cache of db indexes. has to be manually reloaded
      // using a system call. using this only defers the need for async model creation.
      _collectionsIndexes = {}

Object.defineProperty(local, 'SelectionTree', { get: function() { return (this._SelectionTree || (this._SelectionTree = require('./classes/selection-tree'))) } })
Object.defineProperty(local, 'ContextModelDefinition', { get: function() { return (this._ContextModelDefinition || (this._ContextModelDefinition = require('./context-model-definition'))) } })
Object.defineProperty(local, 'DocumentDefinition', { get: function() { return (this._DocumentDefinition || (this._DocumentDefinition = require('./types/document-definition'))) } })
Object.defineProperty(local, 'PropertyDefinition', { get: function() { return (this._PropertyDefinition || (this._PropertyDefinition = require('./property-definition'))) } })
Object.defineProperty(local, 'PropertySetDefinition', { get: function() { return (this._PropertySetDefinition || (this._PropertySetDefinition = require('./property-set-definition'))) } })
Object.defineProperty(local, 'BaseFileProcessorDefinition', { get: function() { return (this._BaseFileProcessorDefinition || (this._BaseFileProcessorDefinition = require('./base-file-processor-definition'))) } })
Object.defineProperty(local, 'BaseMappingDefinition', { get: function() { return (this._BaseMappingDefinition || (this._BaseMappingDefinition = require('./base-mapping-definition'))) } })
Object.defineProperty(local, 'SetDefinition', { get: function() { return (this._SetDefinition || (this._SetDefinition = require('./types/set-definition'))) } })
Object.defineProperty(local, 'PostTypeDefinition', { get: function() { return (this._PostTypeDefinition || (this._PostTypeDefinition = require('./feeds/post-type-definition'))) } })

let _builtInModelDefs,
    _builtInObjectDefs,
    _builtInObjectDefsMap,
    _builtInModelDefsMap,
    _typeDefinitions,
    _processorDefinitions,
    _mappingDefinitions

Object.defineProperty(module.exports, 'builtInModelDefs', { get: function() {
  return _builtInModelDefs ||
        (_builtInModelDefs = fs.readdirSync(path.join(__dirname, 'models')).map(function(file) {
          let def = null
          if (file[0] !== '.') {
            try {
              const Def = require(path.join(__dirname, 'models', file))
              def = new Def()
              def.generateMongooseSchema({ registerModel: true })
            } catch (e) {
              logger.error('error loading built-in model definition: ' + file, e.toJSON({ stack: true }))
              def = null
            }
          }
          return def
        }).filter(v => v))
} })

Object.defineProperty(module.exports, 'builtInObjectDefs', { get: function() {
  return _builtInObjectDefs ||
        (_builtInObjectDefs = fs.readdirSync(path.join(__dirname, 'objects')).map(function(file) {
          let def = null
          if (file[0] !== '.') {
            const Def = require(path.join(__dirname, 'objects', file))
            def = new Def()
            def.generateMongooseSchema({ registerModel: true })
          }
          return def
        }).filter(v => v))
} })

Object.defineProperty(module.exports, 'builtInObjectDefsMap', { get: function() {
  if (!_builtInObjectDefsMap) {
    _builtInObjectDefsMap = module.exports.builtInObjectDefs.reduce(function(map, def) {
      map[def.objectName] = def
      return map
    }, {})
  }
  return _builtInObjectDefsMap
} })

Object.defineProperty(module.exports, 'builtInModelDefsMap', { get: function() {
  if (!_builtInModelDefsMap) {
    _builtInModelDefsMap = module.exports.builtInModelDefs.reduce(function(map, def) {
      map[def.objectName] = def
      return map
    }, {})
  }
  return _builtInModelDefsMap
} })

Object.defineProperty(module.exports, 'typeDefinitions', { get: function() {
  if (!_typeDefinitions) {
    _typeDefinitions = fs.readdirSync(path.join(__dirname, './types')).map(function(file) {
      return require(path.join(__dirname, './types', file))
    }).reduce(function(map, cls) {
      map[cls.typeName] = cls
      return map
    }, {})
  }
  return _typeDefinitions
} })

Object.defineProperty(module.exports, 'processorDefinitions', { get: function() {
  if (!_processorDefinitions) {
    _processorDefinitions = fs.readdirSync(path.join(__dirname, './file-processors')).map(function(file) {
      return require(path.join(__dirname, './file-processors', file))
    }).reduce(function(map, cls) {
      map[cls.typeName] = cls
      return map
    }, {})
  }
  return _processorDefinitions
} })

Object.defineProperty(module.exports, 'mappingDefinitions', { get: function() {
  if (!_mappingDefinitions) {
    _mappingDefinitions = fs.readdirSync(path.join(__dirname, './deployment-mappings')).map(file => require(path.join(__dirname, './deployment-mappings', file))).reduce((map, Cls) => {
      let instance = new Cls()
      map[instance.mappingTypeName] = instance
      return map
    }, {})
  }
  return _mappingDefinitions
} })

Object.defineProperty(local, 'defCache', { get: function() {
  if (!this._defCache) {
    this._defCache = new Map()
    for (let name in module.exports.builtInObjectDefsMap) {
      if (module.exports.builtInObjectDefsMap.hasOwnProperty(name)) {
        this._defCache.set(module.exports.builtInObjectDefsMap[name]._id.toString(), module.exports.builtInObjectDefsMap[name])
      }
    }
    for (let name in module.exports.builtInModelDefsMap) {
      if (module.exports.builtInModelDefsMap.hasOwnProperty(name)) {
        this._defCache.set(module.exports.builtInModelDefsMap[name]._id.toString(), module.exports.builtInObjectDefsMap[name])
      }
    }

  }
  return this._defCache
} })

/**
 * creates file processor properties for file definitions.
 *
 */
module.exports.createProcessorProperties = function() {

  const properties = [],
        types = Object.keys(module.exports.processorDefinitions)

  types.forEach(function(key) {

    const Type = module.exports.processorDefinitions[key]
    let props = local.BaseFileProcessorDefinition.getProperties()

    if (Type.getProperties) {
      const extensions = Type.getProperties()
      extensions.forEach(function(extension) {
        const base = _.find(props, function(v) { return extension.name === v.name })
        if (base) {
          utils.extend(base, extension) // merge in changes to the local property.
        } else {
          props.push(extension) // add a new one.
        }
      })
    }

    props = props.filter(function(v) {
      return v.public !== false
    })

    properties.push({
      name: key,
      type: 'Document',
      forceId: true,
      array: false,
      properties: props
    })
  })

  return properties

}

module.exports.createDeploymentMappings = function() {

  const properties = [],
        types = Object.keys(module.exports.mappingDefinitions)

  types.forEach(function(key) {

    const Type = module.exports.mappingDefinitions[key].constructor
    let props = local.BaseMappingDefinition.getProperties();

    ['source', 'targets'].forEach(key => {
      const entry = _.find(props, prop => prop.name === key),
            extensions = Type.getProperties()
      extensions.forEach(function(extension) {
        entry.properties.push(extension)
      })
    })

    properties.push({
      name: key,
      type: 'Document',
      forceId: true,
      array: false,
      properties: props
    })
  })

  return properties

}

module.exports.registerPropertyForReaping = function(propertyDoc, ac, node) {

  const root = modules.db.getRootDocument(propertyDoc)
  if (!root.isSelected('deletedProperties')) {
    // @temp to get us through testing and validation.
    throw new Error('The property cannot be reaped at this time. Please contact support.')
  }

  if (!_.find(root.deletedProperties, prop => utils.equalIds(prop._id, propertyDoc._id))) {

    root.deletedProperties.push({
      _id: propertyDoc._id,
      op: module.exports.getFullyMaterializedPropertyPathParts(propertyDoc, node).join('.'),
      ip: module.exports.getInstancePath(propertyDoc, node, false),
      fq: module.exports.getInstancePath(propertyDoc, node, true),
      file: propertyDoc.type === 'File',
      localized: utils.rBool(utils.option(propertyDoc.localization, 'enabled'), false)
    })

    if (propertyDoc.type === 'Number') {
      const deletedNumbers = ac.option('$deletedNumbers') || []
      deletedNumbers.push(module.exports.getInstancePath(propertyDoc, node, true, true))
      ac.option('$deletedNumbers', deletedNumbers)
    }

    ac.hook('save').after(function(vars, callback) {

      const { ac } = vars,
            { orgId } = ac,
            deletedNumbers = ac.option('$deletedNumbers')

      modules.workers.runNow('property-reaper')

      async.each(
        deletedNumbers,
        (fqpp, callback) => {
          modules.counters.del(null, `number.increment.${orgId}.${fqpp}`, () => callback())
        },
        () => callback()
      )

    }, 'property-reaper', true)

  }

}

function _onRemovingValue(ac, parentDocument, value, index) {

  module.exports.registerPropertyForReaping(value, ac, this)
  local.DocumentDefinition.prototype.onRemovingValue.call(this, ac, parentDocument, value, index)

  /*
    const fullPath = this.fullpath,
        objectPath = module.exports.getFullyMaterializedPropertyPathParts(value, this).join('.'),
        instancePath = module.exports.getInstancePath(value, this, true);

*/
}

/**
 * creates set properties at a depth.
 *
 * @param depth
 * @param allowSets
 * @param exclude
 */
module.exports.createSetProperties = function(depth, allowSets, { exclude = [] } = {}) {

  const documents = [],
        types = Object.keys(module.exports.typeDefinitions)

  types.forEach(function(key) {

    if (exclude.includes(key)) {
      return
    }

    const Type = module.exports.typeDefinitions[key]

    if (!allowSets && Type.typeName === 'Set') {
      return
    }
    if (depth === 0 && (Type.typeName === 'Set' || Type.typeName === 'Document' || Type.typeName === 'List')) {
      return
    }

    let def,
        props = local.PropertyDefinition.getProperties(depth, [], Type, { exclude })

    if (Type.getProperties) {
      const extensions = Type.getProperties(depth, props, Type, { exclude })
      extensions.forEach(function(extension) {
        const base = _.find(props, function(v) { return extension.name === v.name })
        if (base) {
          utils.extend(base, extension) // merge in changes to the local property.
        } else {
          props.push(extension) // add a new one.
        }
      })
    }

    props = props.filter(function(v) {
      return v.public !== false
    })

    def = new local.DocumentDefinition({
      label: key,
      name: key,
      type: 'Document',
      array: false,
      forceId: true,
      properties: props
    })

    if (key === 'Set') {
      def.properties.documents.onRemovingValue = _onRemovingValue
    }

    def.onRemovingValue = _onRemovingValue

    // object management need a few things.
    Object.keys(def.properties).forEach(function(key) {
      def.properties[key].addDependency('.array')
    })

    documents.push(def)
  })

  return documents

}

/**
 * creates mapping properties at depth.
 *
 * @param depth
 */
module.exports.createSetMappingProperties = function(depth) {

  const documents = [],
        types = Object.keys(module.exports.typeDefinitions)

  types.forEach(function(key) {

    const Type = module.exports.typeDefinitions[key]

    // for now, we'll just disallow Sets anywhere.
    if (Type.typeName === 'Set') {
      return
    }
    if (depth === 0 && (Type.typeName === 'Set' || Type.typeName === 'Document')) {
      return
    }

    let def, props = local.PropertyDefinition.getMappingProperties()

    if (Type.getMappingProperties) {
      const extensions = Type.getMappingProperties(depth)
      extensions.forEach(function(extension) {
        const base = _.find(props, function(v) { return extension.name === v.name })
        if (base) {
          utils.extend(base, extension) // merge in changes to the local property.
        } else {
          props.push(extension) // add a new one.
        }
      })
    }

    props = props.filter(function(v) {
      return v.public !== false
    })

    def = new local.DocumentDefinition({
      label: key,
      name: key,
      type: 'Document',
      array: false,
      forceId: true,
      properties: props
    })

    if (key === 'Set') {
      def.properties.documents.onRemovingValue = _onRemovingValue
    }

    def.onRemovingValue = _onRemovingValue

    documents.push(def)
  })

  return documents

}

module.exports.createProperty = function(prop) {
  if (prop) {
    if (prop.__PropDef__) return prop
    const Type = module.exports.typeDefinitions[prop.type]
    if (Type) {
      return new Type(prop)
    }
  }
  throw Fault.create('cortex.notFound.unspecified', { reason: 'Property definition type not found.' })
}

module.exports.getCollectionIndexes = function(name) {

  name = (name && typeof name !== 'string' && name.name) || name
  return _collectionsIndexes[name] || {}

}

module.exports.reloadIndexes = function(callback) {

  modules.db.connection.db.listCollections().toArray((err, collections) => {

    if (err) {
      return callback(err)
    }

    collections = collections.filter(v => v.name.indexOf('system.') === -1)

    if (collections.length > 100) {
      logger.warn('[modules.db.definitions.reloadIndexes] the number of collections is getting pretty big. time to start thinking about async index information.')
    }

    const currentNames = Object.keys(_collectionsIndexes)

    async.mapLimit(
      collections, 10,
      ({ name, type }, callback) => {
        if (type !== 'collection') {
          return callback(null, null)
        }
        modules.db.connection.db.collection(name, (err, collection) => {
          if (err) {
            return callback(err)
          }
          collection.indexInformation({ full: true }, (err, indexes) => {
            callback(err, { name, indexes })
          })
        })
      },
      (err, entries) => {

        if (!err) {
          entries = entries.filter(v => v).reduce((entries, { name, indexes }) => {
            entries[name] = {
              indexes,
              tree: indexes.map(v => ({ name: v.name, path: Object.keys(v.key).join('$') })).sort((a, b) => b.path.length - a.path.length).reduce((tree, { name, path }) => {
                path = path.split('$')
                if (!utils.path(tree, path)) {
                  utils.path(tree, path, name)
                }
                return tree
              }, {})
            }
            return entries
          }, {})
          const newNames = Object.keys(entries)
          for (let name of newNames) {
            _collectionsIndexes[name] = entries[name]
          }
          _.difference(currentNames, newNames).forEach(name => {
            delete _collectionsIndexes[name]
          })
        }

        logger.info(`[modules.db.definitions.reloadIndexes] reloaded index information. size: ${utils.roughSizeOfObject(_collectionsIndexes)}`)

        callback(err, _collectionsIndexes)

      })

  })

}

module.exports.initialize = function(callback) {

  modules.services.api.addCommand('indexes.reload', (payload, callback) => {
    this.reloadIndexes(callback)
  })

  this.reloadIndexes(err => {

    if (err) {
      return callback(err)
    }

    try {
      // trigger built-in context/model creation
      void module.exports.builtInObjectDefs
      void module.exports.builtInModelDefs

      // give each model a chance to initialize.
      modules.db.mongoose.modelNames().forEach(name => {

        const model = modules.db.models[name]
        if (_.isFunction(model.aclInit)) {
          model.aclInit()
        }
      })
    } catch (err) {
      return callback(err)
    }

    callback()
  })

}

module.exports.nodeTypeToMongooseType = function(type) {

  const Cls = module.exports.typeDefinitions[type]
  if (Cls) {
    return Cls.mongooseType
  }
  return null

}

/**
 *
 * @param collection
 * @param options
 *  modelName      - name of a built-in model. defaults to null.
 *  selectIndexes  - only create selected indexes
 *  dropIndexes    - drops all current indexes. default false
 *  dryRun         - only gets selected indexes. does not run. default true
 * @param callback
 * @returns {*}
 */
module.exports.resetContextIndexes = function(collection, options, callback) {

  [options, callback] = utils.resolveOptionsCallback(options, callback)

  if (collection.name === 'contexts') {
    return callback()
  }

  options = Object.assign({
    modelName: null,
    selectIndexes: [],
    dropIndexes: false,
    dryRun: true
  }, options)

  try {

    const schema = options.modelName ? modules.db.models[options.modelName].schema : new local.ContextModelDefinition({ isFavoritable: true }).generateMongooseSchema({ addIndexesToSchema: true }),
          indexes = schema.indexes(),
          selected = utils.array(options.selectIndexes, options.selectIndexes),
          actionable = selected.length === 0 ? indexes : indexes.filter(v => selected.includes(v[1].name))

    if (options.dryRun) {
      return callback(null, {
        collectionName: collection.name,
        dropIndexes: options.dropIndexes,
        indexes: actionable
      })
    }

    async.series([

      callback => options.dropIndexes ? collection.dropAllIndexes(callback) : callback(),

      callback => {

        async.mapSeries(
          actionable,
          (indexDef, callback) => collection.createIndex(indexDef[0], Object.assign({}, indexDef[1], { background: true }), callback),
          callback
        )

      }

    ], (err, results) => {

      callback(err, results && results[1])

    })

  } catch (err) {

    callback(err)

  }

}

/**
 *
 * @param readOnly
 * @param callback -> err, report
 */
module.exports.ensureIndexes = function(readOnly = true, callback) {

  callback = _.once(callback)

  const collections = new Map()

  try {

    // collect indexes from each schema. some schemas share indexes, so collect them all.
    modules.db.mongoose.modelNames().forEach(name => {

      let indexes
      const model = modules.db.mongoose.models[name]

      // collect and add indexes (bypass mongoose)
      if (!collections.has(model.collection)) {
        collections.set(model.collection, { indexes: [], report: [] })
      }
      indexes = collections.get(model.collection).indexes

      model.schema.indexes().forEach(candidate => {

        // look for existing field set.
        const existing = _.find(indexes, existing => {
          // this has changed, since utils.deepEquals doesn't care about property order
          return JSON.stringify(candidate[0]) === JSON.stringify(existing[0])
        })

        // if an existing field set exists, ensure the options are identical. if not, then error.
        if (existing && !utils.deepEquals(candidate[1], existing[1])) {
          throw Fault.create('cortex.conflict.unspecified', { reason: 'Duplicate index field set with different options!', path: `${name}#${candidate[1].name}, ${name}#${existing[1].name}` })
        }

        if (!existing) {
          indexes.push(candidate)
        }

      })

    })

  } catch (err) {
    return callback(err)
  }

  // indexes have been collected. ensure indexes.
  async.eachSeries(Array.from(collections), (pair, callback) => {

    const collection = pair[0],
          indexes = pair[1].indexes,
          report = pair[1].report

    async.waterfall([

      // ensure collection exists
      callback => {
        modules.db.connection.db.listCollections({ name: collection.name }).toArray((err, items) => {
          if (err) {
            return callback(err)
          } else if (items.length === 0) {
            if (readOnly) {
              report.push(`${new Date()} Missing ${collection.name} collection.`)
              return callback()
            } else {
              const start = process.hrtime()
              modules.db.connection.db.createCollection(collection.name, err => {
                if (err) {
                  report.push(`${new Date()} Failed to create missing '${collection.name}' collection (${err.toString()})`)
                } else {
                  const diff = process.hrtime(start), duration = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(3)
                  report.push(`${new Date()} Created missing '${collection.name}' collection in ${duration}ms`)
                }
                callback(err)
              })
            }
          } else {
            callback()
          }
        })
      },

      // drop all indexes
      callback => {
        if (!readOnly && config('debug.rebuildIndexes')) {
          const start = process.hrtime()
          collection.dropAllIndexes(err => {
            if (err) {
              report.push(`${new Date()} Error dropping all ${collection.name} indexes (${err.toString()})`)
            } else {
              const diff = process.hrtime(start), duration = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(3)
              report.push(`${new Date()} Dropped all ${collection.name} indexes in ${duration}ms`)
            }
            callback(err)
          })
        } else {
          callback()
        }
      },

      // collect current index information and looks for differences. any differences must be resolved.
      callback => {

        collection.indexInformation({ full: true }, (err, info) => {

          if (err) {
            report.push(`${new Date()} Error gathering index information for ${collection.name}`)
            return callback(err)
          }

          // key by name and pair
          callback(null, info.reduce((indexInformation, info) => {

            const fields = info.key, options = {}

            options.name = info.name
            if (info.unique) options.unique = true
            // if (info.background) options.background = true;
            // always force background index building.
            options.background = true
            if (info.sparse) options.sparse = true
            if (info.expireAfterSeconds !== undefined) options.expireAfterSeconds = info.expireAfterSeconds
            if (info.partialFilterExpression !== undefined) options.partialFilterExpression = info.partialFilterExpression

            indexInformation[info.name] = [fields, options]

            return indexInformation

          }, {}))

        })
      },

      // drop indexes that no longer exist (like renamed indexes).
      (indexInformation, callback) => {

        async.eachSeries(
          _.difference(Object.keys(indexInformation).filter(name => name !== '_id_'), indexes.map(pair => pair[1].name)),
          (name, callback) => {

            if (readOnly) {
              report.push(`${new Date()} Unused ${collection.name}.${name} index.`)
              return callback()
            }

            logger.info('index no longer exists. dropping index ' + collection.name + '.' + name)
            delete indexInformation[name]

            const start = process.hrtime()
            collection.dropIndex(name, err => {
              if (err) {
                report.push(`${new Date()} Error dropping unused ${collection.name}.${name} index (${err.toString()})`)
              } else {
                const diff = process.hrtime(start), duration = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(3)
                report.push(`${new Date()} Dropped unused ${collection.name}.${name} index in ${duration}ms`)
              }
              callback(err)
            })
          },
          err => callback(err, indexInformation)
        )
      },

      (indexInformation, callback) => {

        async.eachSeries(indexes, (pair, callback) => {

          const fields = pair[0], options = pair[1], existing = indexInformation[options.name]

          async.series([

            // if an existing index has different options than the options require, drop it and start over.
            callback => {
              if (existing && (!utils.deepEquals(existing[0], fields) || !utils.deepEquals(existing[1], options))) {

                if (readOnly) {
                  report.push(`${new Date()} Modified index ${collection.name}.${options.name}. [${JSON.stringify(fields)}, ${JSON.stringify(options)}]`)
                  return callback()
                }

                logger.info('index changes detected. dropping index ' + collection.name + '.' + options.name)

                const start = process.hrtime()
                collection.dropIndex(options.name, err => {
                  if (err) {
                    report.push(`${new Date()} Error dropping modified ${collection.name}.${options.name} index (${err.toString()})`)
                  } else {
                    const diff = process.hrtime(start), duration = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(3)
                    report.push(`${new Date()} Dropped modified ${collection.name}.${options.name} index in ${duration}ms`)
                  }
                  callback(err)
                })

              } else {
                if (!existing && readOnly) {
                  report.push(`${new Date()} Missing index ${collection.name}.${options.name}. [${JSON.stringify(fields)}, ${JSON.stringify(options)}]`)
                }
                callback()
              }
            },

            // ensure index exists.
            callback => {

              if (readOnly) {
                return callback()
              }

              logger.info('ensuring index  ' + collection.name + '.' + options.name)
              const start = process.hrtime()
              collection.createIndex(fields, options, err => {
                if (err) {
                  logger.error('index creation error: ' + collection.name + '.' + options.name, err.toJSON())
                }
                if (err) {
                  report.push(`${new Date()} Error ensuring ${collection.name}.${options.name} index (${err.toString()})`)
                } else {
                  const diff = process.hrtime(start), duration = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(3)
                  report.push(`${new Date()} Ensured ${collection.name}.${options.name} index in ${duration}ms`)
                }
                callback(err)
              })
            }

          ], callback)

        }, callback)

      }

    ], callback)

  }, err => {
    void err
    return callback(null, Array.from(collections.values()).map(v => v.report).reduce((reports, report) => reports.concat(report), []))

  })

}

/**
 *
 *
 * note: all auto-create reference nodes must have a source object.
 *
 * @param org
 * @param object
 * @param options
 *  chain an array containing a chain of object names. any duplicate references in the chain will cause an error.
 * @param callback -> err, array of reference nodes
 */
module.exports.validateAutoCreate = function(org, object, options, callback) {

  if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

  // find all auto-create reference properties in the current object.
  function walk(collected, node) {
    if (node.getTypeName() === 'Reference' && node.autoCreate) {
      collected.push(node)
    } else if (node.getTypeName() === 'Document' && !node.array) {
      node.eachChild(function(node) {
        walk(collected, node)
      })
    }
  }

  const collected = [],
        chain = utils.array(options['chain'])

  let dupes

  object.schema.node.eachChild(function(node) {
    walk(collected, node)
  })

  if (collected.length === 0) {
    return callback(null, collected)
  }

  // if any collected object names exist in the chain, throw circular reference error.
  dupes = _.intersection(collected.map(function(node) { return node.sourceObject }), chain)
  if (dupes.length > 0) {
    return callback(Fault.create('cortex.invalidArgument.autoCreateCircularReference', { path: dupes.toString() }))
  }

  // branch and detect circular references in sub-objects.
  async.eachSeries(
    collected,
    function(node, callback) {
      org.createObject(node.sourceObject, function(err, object) {
        if (err) {
          return callback(err)
        }
        module.exports.validateAutoCreate(org, object, { chain: chain.concat(node.sourceObject) }, callback)
      })
    },
    function(err) {
      callback(err, collected)
    }
  )

}

/**
 * finds built-in Object types by name, pluralname, or by id.
 * @param {string} str
 * @param {boolean=null} byPluralName true: only plural, false: only singular, null: any
 * @param {boolean=false} dissallowObjectId true to skip looking up by Object id. mostly used for routes.
 * @returns {*}
 */
module.exports.getBuiltInObjectDefinition = function(str, byPluralName = null, dissallowObjectId = false) {
  str = String(str).toLowerCase()
  let def
  if (!byPluralName) {
    def = module.exports.builtInObjectDefsMap[str]
  }
  if (!def) {
    const _id = utils.getIdOrNull(str)
    if (_id || byPluralName !== false) {
      for (let name in module.exports.builtInObjectDefsMap) {
        if (module.exports.builtInObjectDefsMap.hasOwnProperty(name)) {
          if (!dissallowObjectId && _id) {
            if (utils.equalIds(_id, module.exports.builtInObjectDefsMap[name]._id)) {
              def = module.exports.builtInObjectDefsMap[name]
              break
            }
          } else if (byPluralName !== false && module.exports.builtInObjectDefsMap[name].pluralName === str) {
            def = module.exports.builtInObjectDefsMap[name]
            break
          }
        }
      }
    }
  }
  return def
}

/**
 * finds built-in models types by name, pluralname, or by id.
 * @param {string} str
 * @param {boolean=false} byPluralName
 * @param {boolean=false} dissallowObjectId true to skip looking up by Object id. mostly used for routes.
 * @returns {*}
 */
module.exports.getBuiltInModelDefinition = function(str, byPluralName, dissallowObjectId) {
  str = String(str).toLowerCase()
  let def
  if (!byPluralName) {
    def = module.exports.builtInModelDefsMap[str]
  }
  if (!def) {
    const _id = utils.getIdOrNull(str)
    if (_id || byPluralName) {
      for (let name in module.exports.builtInModelDefsMap) {
        if (module.exports.builtInModelDefsMap.hasOwnProperty(name)) {
          if (!dissallowObjectId && _id) {
            if (utils.equalIds(_id, module.exports.builtInModelDefsMap[name]._id)) {
              def = module.exports.builtInModelDefsMap[name]
              break
            }
          } else if (byPluralName && module.exports.builtInModelDefsMap[name].pluralName === str) {
            def = module.exports.builtInModelDefsMap[name]
            break
          }
        }
      }
    }
  }
  return def
}

/**
 * merge custom object options and properties with built-in options.
 * @param objectDocument
 * @param callback
 */
module.exports.generateCustomModel = function(objectDocument, callback) {

  const nativeDef = module.exports.builtInObjectDefsMap[objectDocument.name]
  let def, model
  try {
    if (nativeDef) {
      const NativeClass = nativeDef.constructor
      def = new NativeClass(objectDocument)
    } else {
      def = new local.ContextModelDefinition(objectDocument)
    }
    model = def.generateMongooseModel()
  } catch (err) {
    return callback(err)
  }

  callback(null, model)

}

module.exports.getFullyMaterializedPropertyPathParts = function(document, propertyNode, useObjectId) {

  let parts = [], doc = document, node = propertyNode, root = propertyNode.root

  while (doc && node) {

    if (utils.isId(doc._id)) {
      parts.push(doc._id)
    }

    if (node.docpath) {
      if (node.parent instanceof local.SetDefinition) {
        parts.push(node.parent.docpath)
      } else {
        parts.push(node.docpath)
      }
    }
    doc = modules.db.getParentDocument(doc, false)

    node = utils.path(doc, 'schema.node')
    if (node && node.parent && node.parent.getTypeName() === 'Set') {
      node = node.parent
    }

  }

  if (!useObjectId && root.pluralName) {
    parts.push(root.pluralName)
  } else if (useObjectId && root.objectId) {
    parts.push(root.objectId)
  }

  return parts.reverse()
}

module.exports.getDefinitionPropertyObjectDocument = function(document) {

  let type = null,
      doc = document,
      parent,
      parentArray

  while (doc) {
    parent = modules.db.getParentDocument(doc)
    parentArray = _.isFunction(doc.parentArray) && doc.parentArray()
    if (parent && parentArray && parent.objectTypes === parentArray) {
      type = doc.name
      break
    }
    doc = parent
  }

  return type
}

module.exports.getInstancePath = function(doc, node, fullyQualified = false, useObjectName = false) {

  let instancePath = [], c = null, p = doc, pp, curr

  const isPost = node.fullpath.indexOf('feedDefinition.body') === 0,
        isComment = !isPost && node.fullpath.indexOf('feedDefinition.comments') === 0,
        isTyped = !isPost && !isComment && node.fullpath.indexOf('objectTypes.properties') === 0

  while (p && !modules.db.isModelInstance(p)) {
    pp = modules.db.getParentDocument(p)
    if (utils.hasOwnProperties(p, _propProps, true)) {
      curr = p.name + ((fullyQualified && p.array) ? '[]' : '')
      if (fullyQualified && p.type === 'Set' && c && utils.hasOwnProperties(c, _setDocProps, true)) {
        curr += '#' + c.name
      }
      instancePath.push(curr)

    } else if (fullyQualified && pp && pp.postType && pp.body && pp.comments && utils.hasOwnProperties(p, _setDocProps, true)) {
      instancePath.push('body[]#' + p.name)
    }
    c = p
    p = pp
  }
  if (!fullyQualified) {
    if (isPost || isComment) {
      instancePath.push('body')
    }
  } else if (c) {
    if (isPost) {
      instancePath.push('post#' + c.postType)
    } else if (isComment) {
      instancePath.push('comment#' + c.postType)
    } else {
      let name = (useObjectName && p && p.name) ? p.name : 'context'
      if (isTyped) {
        name += '#' + c.name
      }
      instancePath.push(name)
    }
  }

  instancePath = instancePath.reverse().join('.')

  return instancePath

}

module.exports.prepIndex = function(document) {

  const slots = document.constructor.schema.node.slots,
        slotNames = slots.map(function(slot) { return slot.name })

  if (!utils.isInt(document.idx.v)) {
    document.idx.v = 0
  }
  if (!utils.isPlainObject(document.idx.d)) {
    document.idx.d = {}
    document.markModified('idx.d')
  }

  // remove indexes with no slots.
  Object.keys(document.idx.d).forEach(function(slotName) {
    if (!slotNames.includes(slotName)) {
      delete document.idx.d[slotName]
      document.markModified('idx.d')
    }
  })

}

module.exports.cachedObjectToName = function(org, object) {

  const def = module.exports.cachedFindObjectDef(org, object)
  if (def) {
    return def.objectName || def.name // native or def
  }
  return object

}

module.exports.cachedObjectNameToId = function(org, object) {

  const def = module.exports.cachedFindObjectDef(org, object)
  if (def) {
    return def.objectId || def.lookup // native or def
  }
  return object

}

module.exports.cachedFindObjectDef = function(org, object) {

  if (utils.isId(object)) {
    return local.defCache.get(object.toString()) || org.findObjectInfo(object)
  }
  return module.exports.builtInObjectDefsMap[object] || org.findObjectInfo(object)

}

module.exports.getInstanceIndexDefinition = function() {

  return {
    label: 'Index',
    name: 'idx',
    type: 'Document',
    array: false,
    readable: !!config('debug.readableIndexes'),
    readAccess: config('debug.readableIndexes') ? acl.AccessLevels.Public : acl.AccessLevels.System,
    properties: [
      {
        label: 'Version',
        name: 'v',
        type: 'Number',
        default: 0,
        readable: !!config('debug.readableIndexes'),
        readAccess: config('debug.readableIndexes') ? acl.AccessLevels.Public : acl.AccessLevels.System
      },
      {
        label: 'Contents',
        name: 'd',
        type: 'Any',
        serializeData: false,
        readable: !!config('debug.readableIndexes'),
        readAccess: config('debug.readableIndexes') ? acl.AccessLevels.Public : acl.AccessLevels.System
      }
    ]
  }

}

/**
 * Note
 *  Expansion indexes cannot be unique, so we don't need to use unique index slots for these.
 */
module.exports.getIndexDefinitions = function() {

  let defs = [], i, slot, def, name

  // [{'idx.d.i1': 1}, {name: 'idxProperty_i1', partialFilterExpression: {'idx.d.i1': {$exists: true}}}]
  for (i = 0; i < INDEX_SLOTS.length; i++) {

    slot = INDEX_SLOTS[i]
    name = `idx.d.${slot}`

    def = {
      org: 1,
      object: 1,
      type: 1,
      [name]: 1,
      _id: 1
    }

    defs.push([def, { name: 'idxProperty_' + slot, partialFilterExpression: { [name]: { $exists: true } } }])
  }

  // // [{'idx.d.ci1.v0': 1, 'idx.d.ci1.v1': 1, 'idx.d.ci1.v2': 1, 'idx.d.ci1.v3': 1, 'idx.d.ci1.v4': 1}, {name: 'idxCompound_ci1', partialFilterExpression: {'idx.d.ci1.v0': {$exists: true}}}]
  // for (i = 0; i < COMPOUND_SLOTS.length; i++) {
  //
  //   slot = COMPOUND_SLOTS[i]
  //   name = `idx.d.${slot}`
  //
  //   def = {
  //     org: 1,
  //     object: 1,
  //     type: 1,
  //     [`${name}.v0`]: 1,
  //     [`${name}.v1`]: 1,
  //     [`${name}.v2`]: 1,
  //     [`${name}.v3`]: 1,
  //     [`${name}.v4`]: 1
  //   }
  //
  //   // compound indexes require the first key to exist.
  //   defs.push([def, {name: 'idxCompound_' + slot, partialFilterExpression: {[`${name}.v0`]: {$exists: true}}}])
  //
  //   // uniqueness index (using index _id and value hash)
  //   def = {
  //     [`idx.d.${slot}.i`]: 1, // index identifier.
  //     [`idx.d.${slot}.u`]: 1 // unique value hash.
  //   }
  //   defs.push([def, {name: 'idxCompoundUnique_' + slot, unique: true, partialFilterExpression: {[`${name}.u`]: {$exists: true}}}])
  //
  // }

  // [{'idx.d.u1.v': 1, 'idx.d.u1.k': 1}, {name: 'idxUnique_u1', partialFilterExpression: {'idx.d.u1': {$exists: true}}}]
  for (i = 0; i < UNIQUE_SLOTS.length; i++) {

    slot = UNIQUE_SLOTS[i]
    name = `idx.d.${slot}`

    // lookup index
    def = {
      org: 1,
      object: 1,
      type: 1,
      [`${name}.v`]: 1,
      _id: 1
    }
    defs.push([def, { name: 'ixProperty_' + slot, partialFilterExpression: { [`${name}.v`]: { $exists: true } } }])

    // uniqueness index (using slot _id)
    def = {
      [`idx.d.${slot}.k`]: 1,
      [`idx.d.${slot}.v`]: 1
    }
    defs.push([def, { name: 'ixUnique_' + slot, unique: true, partialFilterExpression: { [`${name}.v`]: { $exists: true } } }])

  }

  // [{'idx.d.g1': 1}, {name: 'idxGeometryProperty_g1', partialFilterExpression: {'idx.d.g1': {$exists: true}}}]
  for (i = 0; i < GEOMETRY_SLOTS.length; i++) {

    slot = GEOMETRY_SLOTS[i]
    name = `idx.d.${slot}`

    // lookup index
    def = {
      org: 1,
      object: 1,
      type: 1,
      [`${name}.v`]: '2dsphere', // [{}] // extra loc. because of "Can't extract geo keys from object" (cannot be in array).
      _id: 1
      // def[`${name}.k`]: 1 // k is for future use. potentially with $elemMatch. there is a cryptic message in geometry-definition ~line 193 "k: null, // we'll use this for elemMatch later on"

    }
    defs.push([def, { name: 'idxGeometryProperty_' + slot, partialFilterExpression: { [name]: { $exists: true } } }])
  }

  return defs

}

function toType(obj) {
  return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
}

module.exports.typeSimpleValue = function(value, seen) {
  seen = seen || new Set()
  switch (toType(value)) {
    case 'string': return 'String'
    case 'number': return 'Number'
    case 'boolean': return 'Boolean'
    case 'date': return 'Date'
    case 'undefined': return 'Unknown'
    case 'null': return 'Unknown'
    case 'regexp': return 'Unknown'
    case 'array':
      if (seen.has(value)) {
        throw Fault.create('cortex.invalidArgument.circularReference')
      }
      seen.add(value)
      const values = _.uniq(value.map(value => module.exports.typeSimpleValue(value, seen)))
      return values.length === 1 ? values[0] + '[]' : 'Unknown'
    case 'object':
    default:
      if (utils.isId(value)) {
        return 'ObjectId'
      } else if (utils.isPlainObject(value)) {
        const keys = Object.keys(value)
        if (keys.length === 1 && keys[0] === '_dat_') {
          return 'Any'
        }
        if ((keys.length === 1 && utils.isId(value._id)) || (keys.length === 2 && utils.isId(value._id) && _.isString(value.object))) {
          return 'Reference'
        }
        // @todo detect set and geometry?
        return 'Document'
      }
      return 'Unknown'
  }
}

module.exports.nodesAreIdentical = function(a, b) {

  const type = a.getTypeName()
  return (type === b.getTypeName() &&
        a.array === b.array &&
        ~['Boolean', 'Date', 'Number', 'ObjectId', 'String'].indexOf(type) &&
        a.fullpath === b.fullpath &&
        utils.deepEquals(a.acl.slice(), b.acl.slice()) &&
        a.readable === b.readable &&
        a.root === b.root &&
        utils.deepEquals(a.reader, b.reader) &&
        a.virtual === b.virtual &&
        utils.deepEquals(a.groupReader, b.groupReader)
  )

}

module.exports.makeLightweightSubject = function(data, model, projectedPaths) {

  void projectedPaths
  Object.defineProperties(data, {
    $model: {
      value: model
    },
    isAccessSubject: {
      value: function(including) {
        // @todo. implement projectedPaths for selections.
        void including
        return true
      }
    },
    aclRead: {
      value: function(ac, selection, callback) {
        if (_.isFunction(selection)) {
          callback = selection
          selection = null
        }
        if (!(selection instanceof local.SelectionTree)) {
          selection = new local.SelectionTree(selection)
        }
        this.$model.schema.node.aclRead(ac, this, selection, callback)
      }
    }
  })

  if (model.decorateSubject) {
    model.decorateSubject(data)
  }

  return data

}

module.exports.ModelCacheNode = class ModelCacheNode extends CacheNode {

  getComputedSizeObject() {

    let object = this.value
    if (typeof object === 'function' && Object.keys(object).length > 0) {
      // is a compiled mongoose model, lets remove objects already in memory by mongoose
      object = _.omit(this.value, 'hooks', 'base', 'model', 'db', 'schema', 'connection', 'collection', 'orgCache', 'objectCache')
    }
    return object

  }

}
