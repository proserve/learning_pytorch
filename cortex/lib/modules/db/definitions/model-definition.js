'use strict'

const util = require('util'),
      utils = require('../../../utils'),
      async = require('async'),
      logger = require('cortex-service/lib/logger'),
      acl = require('../../../acl'),
      modules = require('../../../modules'),
      crypto = require('crypto'),
      Fault = require('cortex-service/lib/fault'),
      SelectionTree = require('./classes/selection-tree'),
      _ = require('underscore'),
      { DeferredRead, GroupedRead } = require('./classes/deferred-read'),
      DocumentDefinition = require('./types/document-definition'),
      ExpansionQueue = require('./classes/expansion-queue'),
      Parser = require('../../parser'),
      Hooks = require('../../../classes/hooks'),
      parallelListReads = 10,
      parallelGroupedReads = 10,
      parallelDeferredReads = 10

function ModelDefinition(options) {

  this.modelName = options.name.toLowerCase().trim()

  DocumentDefinition.call(this, utils.extend({}, options, {
    forceId: true,
    array: false
  }))

  this.initNode(this)
  this.initNode(this) // @temp @hack init twice for any properties that were added. will refactor for expressions.
  this.resolveDependencies()

}
util.inherits(ModelDefinition, DocumentDefinition)

ModelDefinition.prototype.resolveDependencies = function() {

  // flatten dependencies.
  let flat = this.dependencyMap = {},
      modelName,
      keys

  this.walk(function(node) {

    // grab deps and cleanup.
    let deps = node._dependencies
    delete node._dependencies

    if (deps) {

      // don't let nodes depend on themselves. get out if there's nothing to process
      delete deps['.' + node.path]
      let keys = Object.keys(deps),
          fullpath = node.fullpath,
          dependencies = (flat[fullpath] || (flat[fullpath] = {}))
      if (keys.length === 0) {
        return
      }

      // fully expand each key and merge dependency.
      keys.forEach(function(dep) {

        let value = deps[dep],
            count = 0,
            expanded

        while (dep[count] === '.') {
          count++
        }
        if (!count) {
          expanded = dep // leave top-level paths alone.
        } else {
          expanded = fullpath.split('.').slice(0, -count).concat(dep.substr(count)).join('.')
        }
        mergeDependency(dependencies, node, expanded, value)

      })
    }
  })

  keys = Object.keys(flat)

  // paths must include their dependencies' dependencies.
  keys.forEach(function(nodeKey) {
    Object.keys(flat[nodeKey]).forEach(function(depKey) {
      collectDependencies(nodeKey, depKey, [nodeKey])
    })
  })

  // parents must include child dependencies that are out of branch.
  this.walk(function(node) {
    if (node.fullpath) {
      var parentPrefix = node.fullpath + '.'
      keys.forEach(function(childKey) {
        if (childKey.indexOf(parentPrefix) === 0) {
          // this is a child. if there are any dependencies that are outside of the parent, include them.
          Object.keys(flat[childKey]).forEach(function(childDepKey) {
            if (childDepKey.indexOf(parentPrefix) !== 0) {
              mergeDependency((flat[node.fullpath] || (flat[node.fullpath] = {})), node, childDepKey, flat[childKey][childDepKey])
            }
          })
        }
      })
    }
  })

  // all children must include their parent dependencies.
  this.walk(function(node) {
    let nodeKey = node.fullpath
    if (nodeKey && ~nodeKey.indexOf('.')) {
      let parts = nodeKey.split('.'), len = parts.length, parentKey, parentDeps
      while (len--) {
        parentKey = parts.slice(0, len).join('.')
        parentDeps = flat[parentKey]
        if (parentDeps) {
          Object.keys(parentDeps).forEach(function(parentDepKey) {
            if (parentDepKey !== nodeKey) {
              mergeDependency((flat[nodeKey] || (flat[nodeKey] = {})), nodeKey, parentDepKey, parentDeps[parentDepKey])
            }
          })
        }
      }
    }
  })

  // -------------------------------------------------------

  modelName = this.modelName
  function mergeDependency(dependencies, fullpath, expanded, value) {

    var current = dependencies[expanded]
    if ((_.isFunction(current) && _.isFunction(value))) {
      logger.error('dependency value conflict for path "' + expanded + '" in property "' + fullpath + '" for model ' + modelName)
    } else {
      if (value) {
        dependencies[expanded] = value
      }
    }

  }

  function collectDependencies(nodeKey, depKey, checked) {
    if (!~checked.indexOf(depKey)) {
      checked.push(depKey)
      var depDeps = flat[depKey]
      if (depDeps) {
        Object.keys(depDeps).forEach(function(depDepKey) {
          if (nodeKey !== depDepKey) {
            mergeDependency(flat[nodeKey], nodeKey, depDepKey, depDeps[depDepKey])
            collectDependencies(nodeKey, depDepKey, checked)
          }
        })
      }
    }
  }

}

/**
 * @param options
 *     @see DocumentDefinition.prototype.generateMongooseSchema
 *     registerModel: false. registers with mongoose.

 */
ModelDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}

  options.methods = utils.extend({}, options.methods, ModelDefinition.methods) // can't overwrite base methods.
  options.statics = utils.extend({}, options.statics, ModelDefinition.statics) // can't overwrite base methods.

  const registering = utils.option(options, 'registerModel', false),
        registered = modules.db.mongoose.models[this.modelName]

  options.statics.apiHooks = (!registering && registered) ? registered.apiHooks : new Hooks(options.apiHooks)

  let schema = DocumentDefinition.prototype.generateMongooseSchema.call(this, options)

  if (registering) {
    modules.db.mongoose.model(this.modelName, schema)
  }

  this.requiredAclPaths = schema.statics.requiredAclPaths || acl.requiredPaths.slice()

  return schema

}

ModelDefinition.prototype.apiSchema = function(options) {

  let prop,
      schema = {
        _id: this.objectId,
        object: 'schema',
        extensible: false,
        label: this.objectLabel,
        name: this.objectName,
        pluralName: this.pluralName,
        properties: [],
        ETag: crypto.createHash('md5').update(this.objectId + '@' + utils.rInt(this.sequence, -1)).digest('hex'),
        nativeSchemaVersion: this.nativeSchemaVersion,
        locales: this.locales
      }

  if (utils.option(options, 'verbose')) {
    schema.description = this.description || ''
  }
  for (let name in this.properties) {
    if (this.properties.hasOwnProperty(name)) {
      prop = this.properties[name].apiSchema(options)
      if (prop) {
        schema.properties.push(prop)
      }
    }
  }
  return schema

}

ModelDefinition.statics = {

  hook: function(name) {
    return this.apiHooks.register(name)
  },

  fireHook: function(name, err, vars, callback) {
    this.apiHooks.fire(this, name, err, vars, callback)
  },

  /**
     *
     * @param principal
     * @param find
     * @param options
     *  singlePath
     *  single
     *  document (forces single. uses an existing object. careful! the selected paths must be loaded or there will be funk!)
     *  relaxParserLimits: false
     *  parserCreateHook
     *  parserExecOptions
     *  subject
     *  scoped: true
     * @param callback
     */
  nodeList: function(principal, find, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    const Model = this

    if (_.isString(options.paths)) options.paths = [options.paths]
    if (_.isString(options.include)) options.include = [options.include]
    if (_.isString(options.expand)) options.expand = [options.expand]

    // ----------------------------------------------------------------------------------

    if (utils.rBool(options.scoped, true) && !modules.authentication.authInScope(principal.scope, `object.read.${this.modelName}`)) {
      return setImmediate(callback, Fault.create('cortex.accessDenied.scope', { path: `object.read.${this.modelName}` }))
    }

    let select = this.schema.node.selectPaths(principal, options),
        single = utils.option(options, 'single', false),
        tasks = []

    if (options.document) {

      single = true
      tasks.push(function(callback) {
        callback(null, options.document, null)
      })

    } else if (single) {

      tasks.push(function(callback) {
        Model.findOne(find).select(select).lean(!!options.lean).exec(function(err, result) {
          if (!err && !result) {
            err = Fault.create('cortex.notFound.document')
          }
          callback(err, result, null)
        })
      })

    } else {

      const parserEngine = utils.path(options, 'parserExecOptions.engine'),
            parser = new Parser(principal, Model, { parserEngine, strict: options.strict, unindexed: options.unindexed, allowNoLimit: !!options.allowNoLimit, total: !!options.total, relaxLimits: !!options.relaxParserLimits, defaultAcl: options.defaultAcl, allowSystemAccessToParserProperties: options.allowSystemAccessToParserProperties })

      if (_.isFunction(options.parserCreateHook)) {
        options.parserCreateHook(parser)
      }

      if (options.batchField && _.isArray(options.batchValues) && options.batchValues.length > 0) {
        parser.setBatch(options.batchField, options.batchValues)
      }

      if (find) {
        parser.addRawMatch(find)
      }

      if ((options.startingAfter !== undefined || options.endingBefore !== undefined) && (options.where || options.sort)) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'startingAfter/endingBefore is incompatible with where/sort.' }))
      }

      try {
        parser.parse(options, select, find)
      } catch (err) {
        return callback(err)
      }

      tasks.push(function(callback) {

        parser.exec(options.parserExecOptions || {}, function(err, result) {

          try {
            if (!err && !options.lean) {
              if (parser.isBatch()) {
                Object.keys(result.data).forEach(key => {
                  result.data[key].data.forEach((raw, i, a) => {
                    const Model = parser.discernDocumentModel(raw)
                    a[i] = new Model(undefined, parser.projectedPaths, true)
                    a[i].init(raw)
                  })
                })
              } else {
                result.data.forEach((raw, i, a) => {
                  const Model = parser.discernDocumentModel(raw)
                  a[i] = new Model(undefined, parser.projectedPaths, true)
                  a[i].init(raw)
                })
              }
            }

          } catch (e) {
            err = e
          }
          callback(err, result, parser)
        })

      })

    }

    tasks.push(function(result, parser, callback) {

      const json = utils.option(options, 'json', true),
            defaultGrant = options.subject ? null : acl.AccessLevels.Read,
            tasks = []

      if (options.lean || !json) {
        callback(null, result)
        return
      }

      let acOptions = utils.extend({
            grant: utils.rVal(options.grant, defaultGrant),
            req: options.req,
            script: options.script,
            pacl: options.pacl,
            passive: options.passive
          }, options.acOptions, {
            eq: ExpansionQueue.create(principal, options.req, options.script, options.eq)
          }),

          selectionTree = options.selectionTree || new SelectionTree(options)

      if (parser) {
        parser.getUnwoundPaths().forEach(function(path) {
          selectionTree.setTreatAsIndividualProperty(path)
        })
      }

      if (single) {

        tasks.push(function(callback) {
          var ac = new acl.AccessContext(principal, result, acOptions)
          ac.singlePath = options.singlePath
          result.aclRead(ac, selectionTree, callback)
        })

      } else {

        selectionTree.setOption('deferGroupReads', true)
        selectionTree.setOption('forgiving', true)

        var readTask = function(result, callback) {
          async.mapLimit(result.data, parallelListReads, function(document, callback) {
            var ac = new acl.AccessContext(principal, document, acOptions)
            ac.singlePath = options.singlePath
            document.aclRead(ac, selectionTree, callback)
          }, function(err, docs) {
            if (err) {
              callback(err)
            } else {
              Model.schema.node.readGrouped(principal, docs, options.req, options.script, function(err) {
                if (!err) {
                  result.data = docs
                }
                callback(err, result)
              })
            }
          })
        }

        if (result.object === 'map') {

          tasks.push(function(callback) {
            async.eachSeries(Object.keys(result.data), function(key, callback) {
              readTask(result.data[key], callback)
            }, function(err) {
              callback(err, result)
            })
          })

        } else {
          tasks.push(readTask.bind(null, result))
        }

      }

      async.waterfall(tasks, function(err, result) {
        if (!err) {
          acOptions.eq.expand(result, function(err) {
            callback(err, result)
          })
        } else {
          callback(err, result)
        }
      })

    })

    async.waterfall(tasks, callback)

  },

  /**
     *
     * @param {AccessPrincipal} principal
     * @param {object} query
     * @param {object} payload
     * @param {object|function=} options
     *  req: null
     *  grant: acl.AccessLevels.Update
     *  method string, 'put', 'post'
     *  acOptions: null. an object containing options to set on the AccessContext.
     *  singlePath:
     *
     * @param {function=} callback err, document, modified
     */
  nodeUpdate: function(principal, query, payload, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = null
    }

    const self = this,
          tasks = [

            function(callback) {

              var paths = ['_id'].concat(Object.keys(utils.flattenObjectPaths(payload, true, true)).concat(Object.keys(utils.flattenObjectPaths(query, true, true))))

              self.nodeList(
                principal,
                query,
                {
                  single: true,
                  json: false,
                  req: utils.option(options, 'req'),
                  paths: paths
                },
                callback)

            },

            function(document, callback) {

              var ac = new acl.AccessContext(principal, null, {
                req: utils.option(options, 'req'),
                method: utils.option(options, 'method'),
                grant: utils.option(options, 'grant', acl.AccessLevels.Update),
                options: utils.option(options, 'acOptions')
              })

              if (!ac.hasAccess(acl.AccessLevels.Update)) {
                callback(Fault.create('cortex.accessDenied.instanceUpdate'))
              } else {
                ac.singlePath = options.singlePath
                document.aclWrite(ac, payload, function(err) {
                  if (err) {
                    callback(err)
                  } else {
                    document.nodeSave(ac, function(err, modified) {
                      callback(err, document, modified)
                    })
                  }
                })
              }
            }
          ]

    modules.db.sequencedWaterfall(tasks, 10, callback)
  },

  /**
     *
     * @param {AccessPrincipal} principal
     * @param {object} query
     * @param {object} path
     * @param {object|function=} options
     *  req: null
     *  grant: acl.AccessLevels.Update
     *  method string, 'put', 'post'
     *  acOptions: null. an object containing options to set on the AccessContext.
     *
     * @param {function=} callback err, document, modified
     */
  nodeRemove: function(principal, query, path, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = null
    }

    const self = this,
          tasks = [

            function(callback) {

              var paths = ['_id', path].concat(Object.keys(utils.flattenObjectPaths(query, true, true)))

              self.nodeList(
                principal,
                query,
                {
                  single: true,
                  json: false,
                  req: utils.option(options, 'req'),
                  paths: paths
                },
                callback)

            },

            function(document, callback) {

              var ac = new acl.AccessContext(principal, null, {
                req: utils.option(options, 'req'),
                method: 'delete',
                grant: utils.option(options, 'grant', acl.AccessLevels.Update),
                options: utils.option(options, 'acOptions')
              })

              if (!ac.hasAccess(acl.AccessLevels.Update)) {
                callback(Fault.create('cortex.accessDenied.instanceUpdate'))
              } else {
                document.aclRemove(ac, path, function(err) {
                  if (err) {
                    callback(err)
                  } else {
                    document.nodeSave(ac, function(err, modified) {
                      callback(err, document, modified)
                    })
                  }
                })
              }
            }
          ]

    modules.db.sequencedWaterfall(tasks, 10, callback)

  }

}
ModelDefinition.methods = {

  nodeSave: function(ac, callback) {
    var self = this
    if (!self.isModified()) {
      callback(null, false)
    } else {
      self.validateWithAc(ac, function(err) {
        if (err) {
          return callback(err)
        }
        self.save(function(err) {
          callback(Fault.from(err), true)
        })
      })
    }
  },

  aclRead: function(ac, selection, callback) {
    if (_.isFunction(selection)) {
      callback = selection
      selection = null
    }
    if (!(selection instanceof SelectionTree)) {
      selection = new SelectionTree(selection)
    }

    this.schema.node.aclRead(ac, this, selection, callback)
  },

  aclWrite: function(ac, payload, options, callback) {
    [options, callback] = utils.resolveOptionsCallback(options, callback, true, false)
    this.schema.node.aclWrite(ac, this, payload, options, callback)
  },

  aclRemove: function(ac, payload, callback) {
    this.schema.node.aclRemove(ac, this, payload, callback)
  },

  discernNode: function(path) {
    return this.schema.node._discernNode(this, path)
  },

  readableModifiedPaths: function(modifiedPaths) {

    modifiedPaths = modifiedPaths || this.modifiedPaths()
    if (_.isArray(modifiedPaths)) {
      const root = this && this.constructor && this.constructor.schema && this.constructor.schema.node && this.constructor.schema.node.root
      if (root) {
        const nodes = modifiedPaths.reduce(function(nodes, path) {
          root.findNodes(path, nodes)
          return nodes
        }, [])
        return _.uniq(nodes.reduce(function(modified, node) {
          if (node.readable && node.readAccess <= acl.AccessLevels.Script) {
            modified.push(node.fullpath)
          }
          return modified
        }, []).sort())
      }
    }
    return []

  }

}

ModelDefinition.prototype.generateMongooseModel = function(collection, options = {}) {

  const schema = this.generateMongooseSchema(options)

  collection = collection || utils.path(schema, 'options.collection')
  if (!collection) {
    throw Error('model collection name expected')
  }

  let model = modules.db.mongoose.Model.compile(this.modelName, schema, collection, modules.db.connection, modules.db.mongoose)
  model.init()

  return model

}

ModelDefinition.prototype.initNode = function(root) {
  this.parent = null
  this.path = this.fullpath = this.docpath = ''
  for (let name in this.properties) {
    if (this.properties.hasOwnProperty(name)) {
      const property = this.properties[name]
      property.initNode(root, this)
    }
  }
  this.fqpp = this.modelName
  this.fqpparts = [this.fqpp, '']
  this.initReader()
}

ModelDefinition.prototype.hasReadAccess = function(ac) {

  if (!ac.inAuthScope(`object.read.${this.fqpparts[0]}.${ac.subjectId}`)) {
    return false
  }
  return ac.hasAccess(acl.AccessLevels.Public)
}

ModelDefinition.prototype.hasWriteAccess = function(ac) {

  if (!ac.inAuthScope(`object.update.${this.fqpparts[0]}.${ac.subjectId}`)) {
    return false
  }

  return ac.hasAccess(acl.AccessLevels.Public)
}

ModelDefinition.prototype.aclAccess = function(ac, parentDocument, parts, options, callback) {

  [options, callback] = utils.resolveOptionsCallback(options, callback)

  parts = utils.normalizeAcPathParts(parts)

  // without parts, return the subject representation without a property.
  if (parts.length === 0) {
    return callback(null, {
      ...ac.toObject(),
      creatable: Boolean(options.bypassCreateAcl || ac.principal.bypassCreateAcl || ac.canCreate(options.createAcl, options.createAclOverride))
    })
  }

  DocumentDefinition.prototype.aclAccess.call(this, ac, parentDocument, parts, options, callback)

}

/**
 *
 * @param ac
 * @param document
 * @param selection
 * @param callback if null, does not run group readers, and may throw.
 */
ModelDefinition.prototype.aclRead = function(ac, document, selection, callback) {

  if (this.properties._id) selection.addInclude('_id')
  if (this.properties.object) selection.addInclude('object')

  let err, doc
  try {
    ac.initPath(this.pluralName, document._id)
    ac.beginResource(this.getResourcePath(ac, document, selection))

    if (!this.hasReadAccess(ac)) {
      err = Fault.create('cortex.accessDenied.instanceRead', { resource: ac.getResource() })
    } else {
      doc = DocumentDefinition.prototype.aclRead.call(this, ac, document, selection)
    }

  } catch (e) {
    err = e
  }

  setImmediate(() => {
    if (err || selection.getOption('deferGroupReads')) {
      callback(err, doc)
    } else {
      this.readGrouped(ac.principal, [doc], ac.req, ac.script, function(err) {
        callback(err, doc)
      })
    }
  })

}

ModelDefinition.prototype.getResourcePath = function(ac, document, selection) {

  const uniqueKeyName = this.uniqueKey,
        uniqueKeyNode = uniqueKeyName && this.findNode(uniqueKeyName)

  let identifier,
      path = this.objectName

  if (this.objectTypeName) {
    path += `#type(${this.objectTypeName})`
  }

  try {
    identifier = uniqueKeyNode
      ? (uniqueKeyNode.reader
        ? uniqueKeyNode.reader.call(document, ac, uniqueKeyNode, selection)
        : utils.path(document, uniqueKeyNode.docpath)
      )
      : null
    if (identifier) {
      identifier = `${uniqueKeyName}(${identifier})`
    }
  } catch (e) {}

  if (!identifier) {
    identifier = `_id(${document._id})`
  }

  if (identifier) {
    path += `.${identifier}`
  }

  return path
}

ModelDefinition.prototype.aclWrite = function(ac, document, payload, options, callback) {

  [options, callback] = utils.resolveOptionsCallback(options, callback, true, false)

  callback = utils.profile.fn(callback, `model#${this.modelName}.aclWrite`)

  ac.beginResource(this.getResourcePath(ac, document))

  this._orderedWrite(ac, this, document, payload, null, options, callback)

}

ModelDefinition.prototype.aclRemove = function(ac, parentDocument, value, callback) {

  ac.beginResource(this.getResourcePath(ac, parentDocument))

  var parts = utils.pathParts(value), prefix = parts[0], suffix = parts[1],
      node = this.properties.hasOwnProperty(prefix) && this.properties[prefix]

  if (!node && !ac.passive) {
    return callback(Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: prefix }))
  }

  node.aclRemove(ac, parentDocument, suffix, callback)

}

ModelDefinition.prototype.readGrouped = function(principal, outputDocuments, req, script, callback) {

  // collect nodes via fullpath, all the while removing them from the output docs.
  const nodes = {},
        deferred = []

  outputDocuments.forEach(function(top) {
    utils.walk(top, true, true, function(dr, keyOrIndex, objOrArray, isArray) {
      if (dr instanceof DeferredRead) {
        dr.init(keyOrIndex, objOrArray, isArray, top)
        if (dr instanceof GroupedRead) {
          (nodes[dr.node.fullpath] || (nodes[dr.node.fullpath] = [])).push(dr) // @todo. is this reliable? what about group reads inside multi nodes???
          return undefined
        } else {
          deferred.push(dr)
        }
      }
      return dr
    })
  })

  async.eachLimit(
    deferred,
    parallelDeferredReads,
    (dr, callback) => {

      dr.read()
        .then(() => callback())
        .catch(callback)

    },
    err => {

      if (err) {
        return callback(err)
      }

      async.eachLimit(_.values(nodes), parallelGroupedReads, (groupedReadObjects, callback) => {

        const node = groupedReadObjects[0].node, // common node
              selection = groupedReadObjects[0].selection // common selection

        node.groupReader.call(
          this,
          node,
          principal,
          groupedReadObjects,
          req,
          script,
          selection,
          callback
        )

      }, callback)

    }
  )

}

/**
 * retrieves the paths required for load, with dependencies.
 *
 * @param principal
 * @param options
 *  nodeFilter: null. a function that returns false to skip a node;
 *  selections: an already pre-processed selections object.
 *
 * @returns {*}
 */
ModelDefinition.prototype.selectPaths = function(principal, options) {

  // @todo take out virtual paths once dependencies are gleaned.
  // @todo split virtuals from dependencies in order to leave the actual virtuals out of the selection.
  // @todo @feature @important. when matching properties, query only for desired properties for arrays and _id lookups using $elemMatch and $slice.
  //      for example, selecting roles.0 should only select that array element

  let paths = utils.option(options, 'paths', null),
      path,
      node,
      processed,
      process = [utils.option(options, 'include'), utils.option(options, 'expand'), this.requiredAclPaths]

  if (_.isString(paths) || _.isArray(paths)) {
    process.push(paths)
  } else {
    paths = null
  }

  if (options.selections) {

    processed = options.selections

  } else {

    // initial collection of paths in a flattened object
    processed = process.reduce((processed, array) => {
      if (_.isString(array)) {
        array = [array]
      }
      if (_.isArray(array)) {
        processed = array.reduce((processed, path) => {
          if (_.isString(path)) {
            path = utils.normalizeObjectPath(path, true, true, true)
            if (path) {
              if (options.nodeFilter) {
                const n = this.findNode(path)
                if (n && !options.nodeFilter(n)) {
                  return processed
                }
              }
              processed[path] = true
            }
          }
          return processed
        }, processed)
      }
      return processed
    }, {})

    // auto-select paths
    if (paths == null) {
      for (path in this.properties) {
        if (this.properties.hasOwnProperty(path)) {
          node = this.properties[path]
          if (node.readable && !node.optional && !(options.nodeFilter && !options.nodeFilter(node))) {
            processed[path] = true
          }
        }
      }
    }
  }

  const selections = this.resolveSelectionDependencies(principal, processed, options)
  return utils.optimizePathSelections(selections)

}

ModelDefinition.prototype.resolveSelectionDependencies = function(principal, input, options) {

  // go through each path and collect selections and dependencies.
  // virtual nodes will not end up in the selections, though their dependencies will be included if they themselves are not virtual.
  return Object.keys(input).reduce((selections, path) => {
    this.collectRuntimePathSelections(principal, selections, path, options)
    return selections
  }, {})

}

module.exports = ModelDefinition
