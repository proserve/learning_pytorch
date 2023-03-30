'use strict'

const Fault = require('cortex-service/lib/fault'),
      acl = require('../../../../acl'),
      ap = require('../../../../access-principal'),
      consts = require('../../../../consts'),
      util = require('util'),
      async = require('async'),
      utils = require('../../../../utils'),
      { naturalCmp, path: pathTo, rString, sortKeys, array: toArray, promised, isSet, rBool, resolveOptionsCallback } = utils,
      modules = require('../../../../modules'),
      { Driver } = modules.driver,
      config = require('cortex-service/lib/config'),
      Parser = require('../../../parser'),
      ParserConsts = require('../../../parser/parser-consts'),
      transpiler = modules.services.transpiler,
      _ = require('underscore'),
      AclDefinition = require('../acl-definition'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      lazy = require('cortex-service/lib/lazy-loader').from({
        ScriptTransform: `${__dirname}/../../../sandbox/script-transform`
      })

let Undefined

function ViewDefinition(options) {

  // defer initNode and resolveDependencies until we can supplant acl.
  let initNode = this.initNode,
      resolveDependencies = this.resolveDependencies

  this.initNode = this.resolveDependencies = function() {}

  BuiltinContextModelDefinition.call(this, options)

  // this acl is readable and writable, but is limited to Public Access. Anyone with Public access can run the view.
  this.properties.acl = new AclDefinition({
    label: 'Acl',
    name: 'acl',
    type: 'Document',
    public: true,
    array: true,
    readable: true,
    writable: true,
    maxItems: 50,
    canPush: true,
    canPull: true,
    includeId: true,
    forCreate: true,
    withExpressions: true
  })

  this.initNode = initNode
  this.resolveDependencies = resolveDependencies

  this.initNode(this)
  this.resolveDependencies()

}
util.inherits(ViewDefinition, BuiltinContextModelDefinition)

ViewDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = ViewDefinition.statics
  options.methods = ViewDefinition.methods
  options.indexes = ViewDefinition.indexes
  options.options = { collection: ViewDefinition.collection }
  options.apiHooks = ViewDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

ViewDefinition.collection = 'contexts'

ViewDefinition.excludedObjects = [consts.NativeIds.object, consts.NativeIds.org, consts.NativeIds.script, consts.NativeIds.view, consts.NativeIds.deployment]

ViewDefinition.prototype.getNativeOptions = function() {

  return {
    _id: consts.NativeIds.view,
    objectLabel: 'View',
    objectName: 'view',
    pluralName: 'views',
    collection: 'contexts',
    isExtensible: false,
    isFavoritable: false,
    auditing: {
      enabled: true,
      all: true,
      category: 'configuration'
    },
    isDeployable: true,
    uniqueKey: 'name',
    defaultAclOverride: false,
    defaultAclExtend: false,
    shareChainOverride: false,
    shareAclOverride: false,
    allowConnections: false,
    allowConnectionsOverride: false,
    allowConnectionOptionsOverride: false,
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
    properties: [
      {
        label: 'Label',
        name: 'label',
        type: 'String',
        readable: true,
        writable: true,
        readAccess: acl.AccessLevels.Public,
        nativeIndex: true,
        validators: [{
          name: 'required'
        }, {
          name: 'string',
          definition: {
            min: 1,
            max: 100
          }
        }]
      },
      {
        label: 'View Name',
        name: 'name',
        type: 'String',
        readable: true,
        writable: true,
        nativeIndex: true,
        writer: function(ac, node, v) {
          return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(v))
        },
        validators: [{
          name: 'required'
        }, {
          name: 'customName'
        }, {
          name: 'adhoc',
          definition: {
            code: 'cortex.conflict.exists',
            message: 'A unique view name',
            validator: function(ac, node, v, callback) {
              this.constructor.findOne({ org: this.org, object: 'view', name: v }).lean().select('_id').exec(function(err, doc) {
                callback(err, !(err || doc))
              })
            }
          }
        }]
      },
      {
        label: 'Description',
        name: 'description',
        type: 'String',
        readable: true,
        writable: true,
        readAccess: acl.AccessLevels.Public,
        default: '',
        validators: [{
          name: 'string',
          definition: {
            allowNull: true,
            min: 0,
            max: 255
          }
        }]
      },
      {
        label: 'Active',
        name: 'active',
        type: 'Boolean',
        readable: true,
        writable: true,
        default: true
      },
      {
        label: 'Source Object',
        name: 'sourceObject',
        type: 'ObjectId',
        apiType: 'String',
        writable: true,
        trim: true,
        readAccess: acl.AccessLevels.Public,
        reader: function(ac, node, selection) {
          let name = utils.path(ac.org.findObjectInfo(this.sourceObject), 'name')
          if (!name) {
            name = utils.path(modules.db.definitions.getBuiltInObjectDefinition(this.sourceObject, false), 'objectName')
          }
          return name || ''
        },
        writer: function(ac, node, value, options, callback) {
          value = rString(value, '').toLowerCase().trim()
          ac.org.createObject(value, function(err, object) {
            if (!err) {
              value = object.objectId
            }
            callback(err, value)
          })
        },
        validators: [{
          name: 'required'
        }, {
          name: 'adhoc',
          definition: {
            message: 'This object cannot be used in views.',
            validator: function(ac, node, value) {
              return !utils.inIdArray(ViewDefinition.excludedObjects, value)
            }
          }
        }]
      },
      {
        label: 'Post Type',
        name: 'postType',
        type: 'ObjectId',
        apiType: 'String',
        default: null,
        writable: true,
        dependencies: ['sourceObject'],
        deferWrites: true,
        groupReader: function(node, principal, entries, req, script, selection, callback) {

          let objectIds = Array.from(entries.reduce(function(objectIds, entry) { if (entry.input.postType != null && entry.input.sourceObject) { objectIds.add(entry.input.sourceObject.toString()) }; return objectIds }, new Set()))

          async.reduce(objectIds, new Map(), function(objects, objectIdStr, callback) {
            if (objects.has(objectIdStr)) {
              return callback(null, objects)
            }
            principal.org.createObject(objectIdStr, function(err, object) {
              if (!err) {
                objects.set(objectIdStr, object)
              }
              callback(null, objects)
            })

          }, function(err, objects) {
            if (!err) {
              entries.forEach(function(entry) {
                let result = null
                const object = entry.input.sourceObject && objects.get(entry.input.sourceObject.toString())
                if (object) {
                  const postModel = object.getPostModel(entry.input.postType)
                  if (postModel) {
                    result = postModel.postType
                  }
                }
                entry.output.postType = result
              })
            }
            callback(err)

          })
        },
        writer: function(ac, node, value, options, callback) {
          if (value === null) {
            return callback(null, value)
          }
          ac.org.createObject(this.sourceObject, function(err, object) {
            if (!err) {
              const postModel = object.getPostModel(value)
              if (postModel) {
                value = postModel.postTypeId
              } else {
                err = Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'Post type not found.' })
              }
            }
            callback(err, value)
          })
        }
      },
      {
        label: 'Principal',
        name: 'principal',
        type: 'ObjectId',
        default: null,
        writable: true,
        writer: function(ac, node, value, options, callback) {

          if (value === null || value === undefined) {
            return callback(null, null)
          }
          value = utils.getIdOrNull(value)
          if (!value) {
            return callback(Fault.validationError('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'Invalid view principal. Expected an ObjectId.' }))
          }
          ap.create(ac.org, value, (err, principal) => {

            if (err && err.code === 'kNotFound') {
              err = Fault.validationError('cortex.notFound.principal', { resource: ac.getResource() })
            }

            callback(err, principal && principal._id)

          })

        }
      },
      {
        label: 'Limit',
        name: 'limit',
        type: 'Document',
        array: false,
        writable: true,
        readAccess: acl.AccessLevels.Public,
        properties: [
          {
            label: 'Settable',
            name: 'settable',
            type: 'Boolean',
            default: true,
            writable: true,
            readAccess: acl.AccessLevels.Public
          },
          {
            label: 'Default',
            name: 'defaultValue',
            type: 'Number',
            default: config('contexts.defaultLimit'),
            writable: true,
            dependencies: ['limit.min', 'limit.max'],
            readAccess: acl.AccessLevels.Public,
            validators: [{
              name: 'number',
              definition: {
                allowNull: false,
                allowDecimal: false,
                min: 1,
                max: config('contexts.maxLimit')
              }
            }, {
              name: 'adhoc',
              definition: {
                message: 'default must be >= limit.min and <= limit.max',
                validator: function(ac, node, value) {
                  return value >= this.limit.min && value <= this.limit.max
                }
              }
            }]
          },
          {
            label: 'Min',
            name: 'min',
            type: 'Number',
            default: 1,
            writable: true,
            dependencies: ['limit.max'],
            readAccess: acl.AccessLevels.Public,
            validators: [{
              name: 'number',
              definition: {
                allowNull: false,
                allowDecimal: false,
                min: 1,
                max: config('contexts.maxLimit')
              }
            }, {
              name: 'adhoc',
              definition: {
                message: 'limit.min must be lesser than or equal to limit.max',
                validator: function(ac, node, value) {
                  return value <= this.limit.max
                }
              }
            }]
          },
          {
            label: 'Max',
            name: 'max',
            type: 'Number',
            default: config('contexts.maxLimit'),
            writable: true,
            dependencies: ['limit.min'],
            readAccess: acl.AccessLevels.Public,
            validators: [{
              name: 'number',
              definition: {
                allowNull: false,
                allowDecimal: false,
                min: 1,
                max: config('contexts.maxLimit')
              }
            }, {
              name: 'adhoc',
              definition: {
                message: 'limit.max must be greater than or equal to limit.min',
                validator: function(ac, node, value) {
                  return value >= this.limit.min
                }
              }
            }]
          }
        ]
      },
      {
        label: 'Skip',
        name: 'skip',
        type: 'Document',
        array: false,
        writable: true,
        readAccess: acl.AccessLevels.Public,
        properties: [
          {
            label: 'Settable',
            name: 'settable',
            type: 'Boolean',
            default: true,
            writable: true
          },
          {
            label: 'Default',
            name: 'defaultValue',
            type: 'Number',
            default: 0,
            writable: true,
            dependencies: ['skip.min', 'skip.max'],
            readAccess: acl.AccessLevels.Public,
            validators: [{
              name: 'number',
              definition: {
                allowNull: false,
                allowDecimal: false,
                min: 0,
                max: ParserConsts.MAX_SKIP
              }
            }, {
              name: 'adhoc',
              definition: {
                message: 'default must be >= skip.min and <= skip.max',
                validator: function(ac, node, value) {
                  return value >= this.skip.min && value <= this.skip.max
                }
              }
            }]
          },
          {
            label: 'Min',
            name: 'min',
            type: 'Number',
            default: 0,
            writable: true,
            dependencies: ['skip.max'],
            readAccess: acl.AccessLevels.Public,
            validators: [{
              name: 'number',
              definition: {
                allowNull: false,
                allowDecimal: false,
                min: 0,
                max: ParserConsts.MAX_SKIP
              }
            }, {
              name: 'adhoc',
              definition: {
                message: 'skip.min must be lesser than or equal to skip.max',
                validator: function(ac, node, value) {
                  return value <= this.skip.max
                }
              }
            }]
          },
          {
            label: 'Max',
            name: 'max',
            type: 'Number',
            default: ParserConsts.MAX_SKIP,
            writable: true,
            dependencies: ['skip.min'],
            readAccess: acl.AccessLevels.Public,
            validators: [{
              name: 'number',
              definition: {
                allowNull: false,
                allowDecimal: false,
                min: 0,
                max: ParserConsts.MAX_SKIP
              }
            }, {
              name: 'adhoc',
              definition: {
                message: 'skip.max must be greater than or equal to skip.min',
                validator: function(ac, node, value) {
                  return value >= this.skip.min
                }
              }
            }]
          }
        ]
      },
      {
        // only applies to view without a grouping.
        label: 'Paths',
        name: 'paths',
        type: 'Document',
        array: false,
        writable: true,
        readAccess: acl.AccessLevels.Public,
        properties: [
          {
            label: 'Settable',
            name: 'settable',
            type: 'Boolean',
            default: true,
            writable: true,
            readAccess: acl.AccessLevels.Public
          },
          {
            label: 'Default',
            name: 'defaultValue',
            type: 'String',
            array: true,
            maxItems: 50,
            uniqueValues: true,
            readable: true,
            writable: true,
            canPush: true,
            canPull: true,
            dependencies: ['sourceObject', 'postType'],
            default: [],
            groupReader: function(node, principal, entries, req, script, selection, callback) {
              let objectIds = Array.from(
                entries.reduce(
                  function(objectIds, entry) {
                    if (entry.input.sourceObject) {
                      objectIds.add(entry.input.sourceObject.toString())
                    }
                    return objectIds
                  },
                  new Set()
                )
              )
              async.reduce(objectIds, new Map(), function(objects, objectIdStr, callback) {
                if (objects.has(objectIdStr)) {
                  return callback(null, objects)
                }
                principal.org.createObject(objectIdStr, function(err, object) {
                  if (!err) {
                    objects.set(objectIdStr, object)
                  }
                  callback(null, objects)
                })

              }, function(err, objects) {
                if (!err) {
                  entries.forEach(function(entry) {
                    let result = [], object = entry.input.sourceObject && objects.get(entry.input.sourceObject.toString())
                    if (object) {
                      if (entry.input.postType) {
                        object = object.getPostModel(entry.input.postType)
                      }
                      if (object) {
                        result = utils.path(entry.input, node.docpath).map(function(path) {
                          let node = object.schema.node.findNode(path)
                          if (node) {
                            return node.fullpath
                          }
                          return null
                        }).filter(function(v) { return !!v })
                      }
                    }
                    utils.path(entry.output, node.docpath, result)

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
                  if (values.length === 0) return callback()
                  const postType = this.postType
                  ac.org.createObject(this.sourceObject, function(err, object) {
                    if (err) {
                      return callback(err)
                    }
                    if (postType) {
                      const postModel = object.getPostModel(postType)
                      if (!postModel) {
                        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Post type not found.' }))
                      }
                      object = postModel
                    }
                    let i, path, node
                    for (i = 0; i < values.length; i++) {
                      path = values[i]
                      node = object.schema.node.findNode(path)
                      if (!node || !node.readable) {
                        return callback(Fault.create('cortex.notFound.property', { path }))
                      }
                      // don't allow nodes that would otherwise not be readable.
                      if (node.readAccess > acl.AccessLevels.Delete) {
                        return callback(Fault.create('cortex.notFound.property', { path: node.fullpath, reason: 'Property cannot be accessed: ' + path }))
                      }
                    }
                    callback()
                  })
                },
                asArray: true
              }
            }]
          },
          {
            label: 'Limit To',
            name: 'limitTo',
            type: 'String',
            array: true,
            maxItems: 50,
            uniqueValues: true,
            readable: true,
            writable: true,
            canPush: true,
            canPull: true,
            dependencies: ['sourceObject', 'postType'],
            default: [],
            groupReader: function(node, principal, entries, req, script, selection, callback) {
              let objectIds = Array.from(entries.reduce(function(objectIds, entry) { if (entry.input.sourceObject) { objectIds.add(entry.input.sourceObject.toString()) } ; return objectIds }, new Set()))
              async.reduce(objectIds, new Map(), function(objects, objectIdStr, callback) {
                if (objects.has(objectIdStr)) {
                  return callback(null, objects)
                }
                principal.org.createObject(objectIdStr, function(err, object) {
                  if (!err) {
                    objects.set(objectIdStr, object)
                  }
                  callback(null, objects)
                })

              }, function(err, objects) {
                if (!err) {
                  entries.forEach(function(entry) {
                    let result = [], object = entry.input.sourceObject && objects.get(entry.input.sourceObject.toString())
                    if (object) {
                      if (entry.input.postType) {
                        object = object.getPostModel(entry.input.postType)
                      }
                      if (object) {
                        result = utils.path(entry.input, node.docpath).map(function(path) {
                          let node = object.schema.node.findNode(path)
                          if (node) {
                            return node.fullpath
                          }
                          return null
                        }).filter(function(v) { return !!v })
                      }
                    }
                    utils.path(entry.output, node.docpath, result)

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

                  if (values.length === 0) return callback()

                  const postType = this.postType
                  ac.org.createObject(this.sourceObject, function(err, object) {
                    if (err) {
                      return callback(err)
                    }
                    if (postType) {
                      const postModel = object.getPostModel(postType)
                      if (!postModel) {
                        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Post type not found.' }))
                      }
                      object = postModel
                    }
                    let i, path, node
                    for (i = 0; i < values.length; i++) {
                      path = values[i]
                      node = object.schema.node.findNode(path)
                      if (!node || !node.readable) {
                        return callback(Fault.create('cortex.notFound.property', { path }))
                      }
                      // don't allow nodes that would otherwise not be readable.
                      if (node.readAccess > acl.AccessLevels.Delete) {
                        return callback(Fault.create('cortex.notFound.property', { path: node.fullpath, reason: 'Property cannot be accessed: ' + path }))
                      }
                    }
                    callback()
                  })
                },
                asArray: true
              }
            }]
          }
        ]
      },
      new AclDefinition({
        // a default acl to merge with the source object.
        label: 'Object Acl',
        name: 'objectAcl',
        type: 'Document',
        array: true,
        writable: true,
        maxItems: 50,
        canPush: true,
        canPull: true,
        includeId: true,
        withExpressions: true
      }),
      {
        label: 'Expression Pipeline',
        name: 'pipeline',
        type: 'Expression',
        pipeline: true,
        writable: true,
        removable: true
      },
      {
        label: 'Query',
        name: 'query',
        type: 'Document',
        readAccess: acl.AccessLevels.Public,
        array: true,
        writable: true,
        dependencies: ['principal', 'objectAcl', 'sourceObject', 'postType', 'query'],
        validators: [{
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value, callback) {
              if (value.length === 0) return callback()
              let self = this

              async.waterfall([

                // get object
                function(callback) {
                  ac.org.createObject(self.sourceObject, function(err, object) {
                    if (!err) {
                      if (self.postType) {
                        object = object.getPostModel(self.postType)
                        if (!object) {
                          err = Fault.create('cortex.invalidArgument.unspecified', { reason: 'Post type not found.' })
                        }
                      }
                    }
                    callback(err, object)
                  })
                },

                // get a principal to use for parsing.
                function(object, callback) {
                  if (!self.principal) {
                    return callback(null, object, ac.principal)
                  } else {
                    ap.create(ac.org, self.principal, function(err, principal) {
                      callback(err, object, principal)
                    })
                  }
                },

                // parse query and store variables.
                function(object, principal, callback) {

                  if (value.length === 0) {
                    return callback(null, true)
                  }

                  let err,
                      parser = new Parser(principal, object, { defaultAcl: self.objectAcl, withVariables: true, allowSystemAccessToParserProperties: ac.option('allowSystemAccessToParserProperties') }),
                      options = value.reduce(function(options, value) {
                        if (value && value.name) {
                          options[value.name] = value.value
                        }
                        return options
                      }, {})

                  try {
                    parser.parse(options)
                  } catch (e) {
                    err = e
                  }

                  // store variables
                  value.forEach(function(value) {
                    value.variables = parser.getVariables(value.name)
                  })
                  callback(err)
                }

              ], callback)
            },
            asArray: true
          }
        }],
        maxItems: 4,
        uniqueKey: 'name',
        properties: [{
          label: 'Name',
          name: 'name',
          type: 'String',
          writable: true,
          readAccess: acl.Inherit,
          validators: [{
            name: 'required'
          }, {
            name: 'uniqueInArray'
          }, {
            name: 'stringEnum',
            definition: {
              values: ['where', 'map', 'group', 'sort', 'pipeline']
            }
          }]
        }, {
          label: 'Value',
          name: 'value',
          type: 'String',
          writable: true
        }, {
          label: 'Variables',
          name: 'variables',
          type: 'Document',
          readAccess: acl.Inherit,
          writable: false,
          array: true,
          properties: [{
            label: 'Name',
            name: 'name',
            type: 'String',
            readAccess: acl.Inherit
          }, {
            label: 'Type',
            name: 'type',
            type: 'String',
            readAccess: acl.Inherit
          }]
        }]
      },
      {
        label: 'Script',
        name: 'script',
        type: 'Any',
        serializeData: false,
        acl: acl.Inherit,
        writable: true,
        dependencies: ['.action'],
        reader: function(ac) {
          return ac.option('isExport') ? (this && this.script) : (this && this.script && this.script.script)
        },
        writer: function(ac, node, value) {
          if (value || rBool(pathTo(ac.org, 'configuration.scripting.enableViewTransforms'), config('sandbox.limits.enableViewTransforms'))) {
            return {
              script: value
            }
          }
          return Undefined
        },
        validators: [{
          name: 'adhoc',
          definition: {
            message: 'View transforms are not available.',
            validator: function(ac) {
              return rBool(pathTo(ac.org, 'configuration.scripting.enableViewTransforms'), config('sandbox.limits.enableViewTransforms'))
            }
          }
        }, {
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value, callback) {
              const script = rString(value.script, '').trim()
              if (!script) {
                this.script = Undefined
                return callback()
              }
              transpiler.transpile(
                value.script,
                {
                  filename: 'Transform',
                  language: 'javascript',
                  specification: 'es6'
                },
                (err, result) => {
                  if (!err) {
                    this.script = {
                      script: value.script,
                      serviceAccounts: result.serviceAccounts,
                      requires: toArray(result.imports),
                      compiled: result.source,
                      compiledHash: result.scriptHash,
                      classes: result.classes
                    }
                  }
                  callback(err, true)
                }
              )
            }
          }
        }]
      }
    ]
  }
}

// shared methods --------------------------------------------------------

ViewDefinition.methods = {

}

// indexes ---------------------------------------------------------------

ViewDefinition.indexes = [

]

// shared statics --------------------------------------------------------

ViewDefinition.statics = {

  aclInit: function() {

    modules.db.models.Object.hook('delete').before((vars, callback) => {

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      this.find({ org: vars.ac.orgId, object: 'view', reap: false, sourceObject: vars.ac.subject.lookup }).select('id label').lean().exec((err, docs) => {
        if (!err && docs.length > 0) {
          err = Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This object is in use by the following view(s): ' + docs.map(doc => doc.label) })
        }
        callback(err)
      })
    })

    modules.db.models.Object.hook('feed.removed').before((vars, callback) => {

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      this.find({ org: vars.ac.orgId, object: 'view', reap: false, sourceObject: vars.ac.subject.lookup, postType: vars.feed._id }).select('id label').lean().exec((err, docs) => {
        if (!err && docs.length > 0) {
          err = Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This feed post type is in use by the following view(s): ' + docs.map(doc => doc.label) })
        }
        callback(err)
      })

    })

    modules.db.models.Org.hook('role.removed').before((vars, callback) => {

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      this.find({ org: vars.ac.orgId, object: 'view', reap: false, $or: [{ principal: vars.roleId }, { 'acl.target': vars.roleId }, { 'objectAcl.target': vars.roleId }] }).select('id label').lean().exec((err, docs) => {
        if (!err && docs.length > 0) {
          err = Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This role is in use by the following view(s): ' + docs.map(doc => doc.label) })
        }
        callback(err)
      })

    })

    modules.db.models.Org.hook('serviceAccount.removed').before((vars, callback) => {

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      this.find({ org: vars.ac.orgId, object: 'view', reap: false, $or: [{ principal: vars.serviceAccountId }, { 'script.serviceAccounts': vars.serviceAccount.name }] }).select('id label').lean().exec((err, docs) => {
        if (!err && docs.length > 0) {
          err = Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This service account is in use by the following view(s): ' + docs.map(doc => doc.label) })
        }
        callback(err)
      })

    })

    modules.db.models.Script.hook('delete').before((vars, callback) => {

      const customExport = pathTo(vars.ac.subject, 'configuration.export')

      if (!customExport) {
        return callback()
      }

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      this.find({ org: vars.ac.orgId, object: 'view', reap: false, 'script.requires': customExport }).select('id label').lean().exec((err, docs) => {
        if (!err && docs.length > 0) {
          err = Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This script is in use by the following view(s): ' + docs.map(doc => doc.label) })
        }
        callback(err)
      })

    })

  },

  generate: function(principal, data, callback) {

    const View = this,
          view = new View()

    view.org = principal.orgId
    view.object = 'view'
    view.owner = { object: 'account', _id: principal._id }
    view.set(_.pick(data, 'description', 'sourceObject', 'postType', 'principal', 'limit', 'skip', 'query', 'acl', 'objectAcl'))

    let ac = new acl.AccessContext(principal, view)
    ac.override = true
    ac.method = 'post'

    view.aclWrite(ac, _.pick(data, 'name', 'label', 'paths'), function(err) {
      if (err) {
        return callback(err)
      }
      ac.override = false
      ac.method = 'get'
      ac.option('allowSystemAccessToParserProperties', true)

      view.validateWithAc(ac, function(err) {
        view.$allowSystemAccessToParserProperties = true
        callback(err, view)
      })
    })

  },

  /**
     *
     * @param principal
     * @param idOrCode
     * @param options
     *  req
     *  script, locale
     *  parent parent operation.
     *  returnCursor
     * @param callback
     */
  viewRun: function(principal, idOrCode, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    return Promise.resolve(null)
      .then(async() => {
        const View = this,
              { org } = principal,
              { req, script, locale, parent, returnCursor } = options,
              viewReadOps = { req, script, locale, skipAcl: true, json: false, scoped: false }

        let view = null,
            sourceObject = null,
            postModel,
            viewPrincipal = principal,
            err,
            result,
            scopeName = idOrCode,
            pathObject,
            paths = null,
            limit,
            skip,
            operationReadOptions,
            component,
            variable,
            input,
            inputValue,
            outputVariables = {},
            outputQuery,
            i,
            j

        if (idOrCode instanceof View) { // use an existing document
          viewReadOps.document = idOrCode
          scopeName = idOrCode = idOrCode._id
        } else if (!utils.couldBeId(idOrCode)) { // look up by code
          viewReadOps.allowNullSubject = true
          viewReadOps.where = { name: idOrCode }
          scopeName = idOrCode
          idOrCode = null
        }

        try {

          await new Promise((resolve, reject) => {
            this.aclReadOne(principal, idOrCode, viewReadOps, (err, v, ac) => {
              view = v
              if (!err) {
                const requiredScopes = [`view.execute.${v.name}`, `view.execute.${v._id}`]
                if (!requiredScopes.some(requiredScope => modules.authentication.authInScope(principal.scope, requiredScope))) {
                  err = Fault.create('cortex.accessDenied.scope', { path: `view.execute.${scopeName}` })
                }
              }
              if (!err && !ac.hasAccess(acl.AccessLevels.Public)) {
                err = Fault.create('cortex.accessDenied.view')
              }
              if (!err && !v.active && !principal.hasRole(acl.OrgDeveloperRole)) {
                err = Fault.create('cortex.accessDenied.view')
              }
              err ? reject(err) : resolve()
            })
          })

          await new Promise((resolve, reject) => {
            org.createObject(view.sourceObject, (err, object) => {
              sourceObject = object
              if (!err) {
                if (view.postType) {
                  postModel = object.getPostModel(view.postType)
                  if (!postModel) {
                    err = Fault.create('cortex.notFound.unspecified', { reason: 'Configured view feed definition no longer exists.' })
                  }
                }
              }
              err ? reject(err) : resolve()
            })
          })

          if (view.principal) {
            viewPrincipal = await ap.create(org, view.principal)
          } else {
            viewPrincipal = principal
            if (viewPrincipal.scope) {
              viewPrincipal = viewPrincipal.clone()
              viewPrincipal.scope = null
            }
          }

          pathObject = postModel || sourceObject
          limit = view.limit.defaultValue
          skip = view.skip.defaultValue
          i = view.query.length

          if (view.paths.defaultValue.length) {
            paths = view.paths.defaultValue.map(function(path) {
              const node = pathObject.schema.node.findNode(path)
              if (node) {
                return node.fullpath
              }
              return null
            }).filter(function(v) { return !!v })
          }

          if (view.paths.settable && options.paths != null) {
            paths = toArray(options.paths, true)
          }

          if (view.paths.limitTo.length) {
            const limitTo = view.paths.limitTo.map(function(path) {
              const node = pathObject.schema.node.findNode(path)
              if (node) {
                return node.fullpath
              }
              return null
            }).filter(function(v) { return !!v })
            paths = !paths ? limitTo : _.intersection(paths, limitTo)
          }

          // ------------------------------------------------------------------

          // where, map, group, sort, pipeline, skip, limit.

          if (view.limit.settable && options.returnCursor && utils.stringToBoolean(options.limit, true) === false) {
            limit = false
          } else if (view.limit.settable && utils.isInteger(options.limit)) {
            limit = Math.min(Math.max(parseInt(options.limit), view.limit.min), view.limit.max)
          }

          if (view.skip.settable && utils.isInteger(options.skip)) {
            skip = Math.min(Math.max(parseInt(options.skip), view.skip.min), view.skip.max)
          }

          operationReadOptions = {
            skip: skip,
            limit: limit,
            paths: paths,
            req: options.req,
            script: options.script
          }

          // if variables are expected, ensure they exist and replace.
          while (i--) {

            component = view.query[i]

            try {
              outputQuery = (component.value || '').trim()
              if (outputQuery) {
                outputQuery = JSON.parse(outputQuery)
              }
            } catch (err) {
              return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid query component JSON for ' + component.name, path: component.name }))
            }

            j = component.variables.length

            if (j) {
              try {
                input = JSON.parse(options[component.name])
                if (!utils.isPlainObject(input)) {
                  return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Object expected as query input for ' + component.name, path: component.name }))
                }
              } catch (e) {
                return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid or missing JSON query input for ' + component.name, path: component.name }))
              }

              while (j--) {

                variable = component.variables[j]
                if ((inputValue = input[variable.name]) === undefined) {
                  return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing required ' + component.name + ' input variable ' + variable.name, path: [component.name, variable.name].join('.') }))
                }

                // only allow primitive values
                try {
                  toArray(inputValue, true).forEach(function(component, variable, value) {
                    if (!utils.isPrimitive(value)) {
                      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Query variable only accepts primitive values.', path: [component.name, variable.name].join('.') })
                    }
                  }.bind(null, component, variable))
                } catch (err) {
                  return callback(err)
                }

                outputVariables[variable.name] = inputValue
              }

              outputQuery = utils.walk(outputQuery, false, false, function(value) {
                let match
                if (_.isString(value) && (match = value.match(ParserConsts.VARIABLE_REGEX))) {
                  return outputVariables[match[1]]
                }
                return value
              })

            }

            operationReadOptions[component.name] = outputQuery
          }

          // ------------------------------------------------------------------

          operationReadOptions.defaultAcl = acl.mergeAndSanitizeEntries(sourceObject.defaultAcl, view.objectAcl)
          operationReadOptions.allowSystemAccessToParserProperties = !!view.$allowSystemAccessToParserProperties

          if (postModel) {

            operationReadOptions.postTypes = [postModel.postType]
            operationReadOptions.clearNotifications = false
            operationReadOptions.trackViews = false

            result = await promised(modules.db.models.Post, 'postList', viewPrincipal, operationReadOptions)

          } else if (returnCursor) {

            // allow limit to be false but default to contexts.default for backwards compatibility.
            if (operationReadOptions.limit === undefined) {
              options.limit = config('contexts.defaultLimit')
            }
            result = await promised(sourceObject, 'aclCursor', viewPrincipal, operationReadOptions)

          } else {

            result = await promised(sourceObject, 'aclList', viewPrincipal, operationReadOptions)

          }

        } catch (e) {
          err = e
        }

        // script transform
        if (!postModel && view && view.script && view.script.compiled && rBool(pathTo(principal.org, 'configuration.scripting.enableViewTransforms'), config('sandbox.limits.enableViewTransforms'))) {

          const transform = new lazy.ScriptTransform(new acl.AccessContext(principal, null, { req })),
                driver = new Driver(viewPrincipal, sourceObject, { req }),
                operation = driver.createOperation('cursor', { parent: parent || (script || req || {}).operation })

          await transform.init(view.script)
          result = await transform.run(err, result, {
            runtimeArguments: {
              view: {
                _id: view._id,
                name: view.name
              },
              viewOptions: operation.getExternalOptions(operation.getOptions(operationReadOptions, operationReadOptions))
            }
          })
          result.on('error', err => {
            void err
          })

        }

        if (err) {
          throw err
        }

        // expression pipelines
        if (view && view.pipeline) {

          const ac = new acl.AccessContext(principal, null, { req }),
                ec = modules.expressions.createPipeline(ac, view.pipeline)

          result = await ec.evaluate({ input: result })
          result.on('error', err => {
            void err
          })

        }

        return result

      })
      .then(result => callback(null, result))
      .catch(err => callback(err))

  }

}

// shared hooks  ---------------------------------------------------------

ViewDefinition.apiHooks = []

// exports --------------------------------------------------------

ViewDefinition.prototype.export = async function(ac, doc, resourceStream, parentResource, options) {

  const resourcePath = `view.${doc.name}`,
        def = _.pick(doc, [
          'object',
          'label',
          'name',
          'description',
          'language',
          'active',
          'script',
          'sourceObject', // string
          'principal' // object id - any principal
        ])

  if (!resourceStream.addPath(resourcePath, parentResource, options)) {
    return Undefined
  } else if (!doc.name) {
    if (resourceStream.silent) {
      return Undefined
    }
    throw Fault.create('cortex.unsupportedOperation.unspecified', {
      reason: `The view "${doc.label}" does not have a name set, therefore it can't be exported.`,
      path: resourcePath
    })
  }

  def.limit = sortKeys(doc.limit)
  def.skip = sortKeys(doc.skip)
  def.paths = sortKeys(doc.paths)
  def.paths.defaultValue = toArray(pathTo(def.paths, 'defaultValue')).sort(naturalCmp)
  def.paths.limitTo = toArray(pathTo(def.paths, 'limitTo')).sort(naturalCmp)

  def.acl = await this.findNode('acl').export(ac, doc.acl, resourceStream, resourcePath, { ...options, required: true })
  def.objectAcl = await this.findNode('objectAcl').export(ac, doc.objectAcl, resourceStream, resourcePath, { ...options, required: true })

  def.query = toArray(doc.query).slice()
    .sort((a, b) => naturalCmp(rString(a.name, ''), rString(b.name, '')))

  def.query.forEach(v => {

    if (v.value) {
      v.value = JSON.parse(v.value)
    }
    delete v.variables
    delete v._id

  })

  def.principal = def.principal && await resourceStream.addMappedPrincipal(ac, def.principal, `${resourcePath}.principal`, { includeResourcePrefix: true })
  def.sourceObject = def.sourceObject && await resourceStream.addMappedObject(ac, def.sourceObject, `${resourcePath}.sourceObject`)

  if (resourceStream.includeDependencies(resourcePath)) {

    // add script and service account dependencies to the manifest (but we don't need to store them)
    if (def.script) {

      await Promise.all(toArray(def.script.requires).map(async(scriptExport) => {
        return resourceStream.addMappedInstance(
          ac,
          'script',
          { type: 'library', 'configuration.export': scriptExport },
          `${resourcePath}.script`
        )
      }))

      await Promise.all(toArray(def.script.serviceAccounts).map(async(serviceAccount) => {
        return resourceStream.addMappedServiceAccount(ac, serviceAccount, `${resourcePath}.script`)
      }))

    }
  }

  if (def.script) {
    def.script = def.script.script
  }

  return resourceStream.exportResource(sortKeys(def), resourcePath)

}

ViewDefinition.prototype.import = async function(ac, doc, resourceStream, parentResource, options) {

  const resourcePath = `view.${doc && doc.name}`

  if (!doc || !this.isImportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
    return Undefined
  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
    return Undefined
  } else {

    const def = _.pick(doc, [
            'label',
            'description',
            'active',
            'limit',
            'skip',
            'script'
          ]),
          deferred = _.pick(doc, 'paths', 'query'),
          viewModel = modules.db.models.view

    if (isSet(doc.principal)) {
      def.principal = (await resourceStream.importMappedPrincipal(ac, doc.principal, `${resourcePath}.principal`))._id
    }
    if (isSet(doc.sourceObject) && doc.sourceObject) {
      def.sourceObject = (await resourceStream.importMappedObject(ac, doc.sourceObject, `${resourcePath}.sourceObject`)).name
    }

    def.acl = await this.findNode('acl').import(ac, doc.acl, resourceStream, `${resourcePath}.acl`, { ...options, required: true })
    def.objectAcl = await this.findNode('objectAcl').import(ac, doc.objectAcl, resourceStream, `${resourcePath}.objectAcl`, { ...options, required: true })

    let subject = await promised(
          viewModel,
          'aclReadOne',
          ac.principal,
          null,
          {
            req: ac.req,
            script: ac.script,
            allowNullSubject: true,
            throwNotFound: false,
            internalWhere: { name: doc.name },
            paths: ['_id', 'name']
          }
        ),
        writeOptions = {
          passive: true,
          method: subject ? 'put' : 'post',
          req: ac.req,
          script: ac.script,
          mergeDocuments: true,
          disableTriggers: resourceStream.disableTriggers
        }

    if (subject) {
      def._id = subject._id
      subject = (await promised(viewModel, 'aclUpdate', ac.principal, subject._id, def, writeOptions)).ac.subject
    } else {
      def.name = doc.name
      subject = (await promised(viewModel, 'aclCreate', ac.principal, def, writeOptions)).ac.subject
    }

    // defer some properties in case the source objects was imported on the fly.
    resourceStream.deferResource(resourcePath, async(ac, resourcePath) => {

      toArray(deferred.query).forEach((v, i, a) => {
        if (isSet(v.value)) {
          v.value = JSON.stringify(v.value)
        }
      })

      await promised(
        viewModel,
        'aclUpdate',
        ac.principal,
        subject._id,
        deferred,
        {
          passive: true,
          method: 'put',
          req: ac.req,
          script: ac.script,
          mergeDocuments: true,
          disableTriggers: resourceStream.disableTriggers
        }
      )

    })

    return subject

  }

}

module.exports = ViewDefinition
