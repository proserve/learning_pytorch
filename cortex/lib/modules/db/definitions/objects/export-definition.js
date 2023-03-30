'use strict'

const Fault = require('cortex-service/lib/fault'),
      acl = require('../../../../acl'),
      ap = require('../../../../access-principal'),
      consts = require('../../../../consts'),
      config = require('cortex-service/lib/config'),
      modules = require('../../../../modules'),
      transpiler = modules.services.transpiler,
      util = require('util'),
      async = require('async'),
      {
        rInt, equalIds, path: pathTo, dotPath, rString, array: toArray, normalizeObjectPath,
        getIdOrNull, createId, isValidDate, clamp
      } = require('../../../../utils'),
      _ = require('underscore'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      local = {
        _definitions: null
      }

Object.defineProperty(local, 'definitions', { get: function() { return (this._definitions || (this._definitions = require('../index'))) } })

function ExportDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(ExportDefinition, BuiltinContextModelDefinition)

ExportDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = ExportDefinition.statics
  options.methods = ExportDefinition.methods
  options.indexes = ExportDefinition.indexes
  options.options = { collection: ExportDefinition.collection }
  options.apiHooks = ExportDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

ExportDefinition.collection = 'contexts'

ExportDefinition.EXPORT_MIMES = ['application/x-ndjson', 'application/json', 'text/csv']

ExportDefinition.prototype.getNativeOptions = function() {
  return {
    _id: consts.NativeIds.export,
    objectLabel: 'Export',
    objectName: 'export',
    pluralName: 'exports',
    collection: 'contexts',
    isExtensible: false,
    isFavoritable: false,
    defaultAclOverride: false,
    auditing: {
      enabled: true,
      all: true,
      category: 'export'
    },
    defaultAclExtend: false,
    shareChainOverride: false,
    shareAclOverride: false,
    allowConnections: false,
    allowConnectionsOverride: true,
    allowConnectionOptionsOverride: true,
    defaultAcl: [
      { type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }
    ],
    createAcl: [
      { type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }
    ],
    createAclOverwrite: false,
    createAclExtend: false,
    shareChain: [acl.AccessLevels.Connected],
    properties: [
      {
        label: 'Label',
        name: 'label',
        type: 'String',
        writable: true,
        nativeIndex: true,
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
        label: 'Description',
        name: 'description',
        type: 'String',
        writable: true,
        nativeIndex: true,
        validators: [
          {
            name: 'string',
            definition: {
              allowNull: true,
              min: 0,
              max: 255
            }
          }
        ]
      },
      {
        label: 'State',
        name: 'state',
        type: 'String',
        default: 'pending',
        validators: [
          {
            name: 'stringEnum',
            definition: {
              values: ['pending', 'running', 'ready', 'error']
            }
          }
        ]
      },
      {
        label: 'Location',
        name: 'location',
        type: 'Number',
        default: consts.LocationTypes.AwsS3
      },
      {
        label: 'Storage Location',
        name: 'storageId',
        type: 'String',
        creatable: true,
        default: consts.storage.availableLocationTypes.medable,
        validators: [
          {
            name: 'required'
          },
          {
            name: 'adhoc',
            definition: {
              validator: function(ac, node, value) {

                const orgDefaultLocation = ac.org.configuration.storage.defaultLocation,
                      orgExportLocation = ac.org.configuration.storage.exportLocation

                if (!ac.org.configuration.storage.enableLocations) {

                  this.storageId = consts.storage.availableLocationTypes.medable
                  return true

                } else if (orgExportLocation === consts.storage.availableLocationTypes.medable) {

                  this.storageId = consts.storage.availableLocationTypes.medable
                  return true

                } else if (orgExportLocation === consts.storage.availableLocationTypes.default) {

                  if (orgDefaultLocation === consts.storage.availableLocationTypes.medable) {
                    this.storageId = consts.storage.availableLocationTypes.medable
                    return true
                  } else {
                    value = orgDefaultLocation
                  }

                } else if (orgExportLocation === consts.storage.availableLocationTypes.any) {

                  if (value === consts.storage.availableLocationTypes.medable) {
                    return true
                  }

                } else if (orgExportLocation === consts.storage.availableLocationTypes.env) {

                  // noop

                } else {

                  value = orgExportLocation

                }

                {
                  const location = ac.org.configuration.storage.locations.find(v => v.name === value)

                  if (!location) {
                    throw Fault.create('cortex.notFound.unspecified', { reason: 'The storage location does not exist.' })
                  } else if (!location.active) {
                    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'The storage location is not available.' })
                  } else if (!['aws-s3', 's3-endpoint'].includes(location.type)) {
                    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Exports only support AWS S3 storage.' })
                  }

                  this.storageId = value

                  return true
                }

              }
            }
          }
        ]
      },
      {
        label: 'Export Files',
        name: 'exportFiles',
        type: 'Boolean',
        creatable: true,
        default: false
      },
      {
        label: 'Zip Export Files',
        name: 'zipFiles',
        type: 'Boolean',
        creatable: true,
        default: false
      },
      {
        label: 'Format',
        name: 'format',
        type: 'String',
        creatable: true,
        default: 'application/x-ndjson',
        dependencies: ['paths'],
        validators: [
          {
            name: 'stringEnum',
            definition: {
              values: ExportDefinition.EXPORT_MIMES
            }
          }
        ]
      },
      {
        label: 'Objects',
        name: 'objects',
        type: 'String',
        creatable: true,
        validators: [
          {
            name: 'required'
          },
          {
            name: 'adhoc',
            definition: {
              validator: async function(ac, node, value) {

                const { org } = ac,
                      model = await org.createObject(value),
                      objectName = model.objectName

                if (~['account', 'org', 'object', 'script', 'view', 'export', 'deployment'].indexOf(objectName)) {
                  throw Fault.create('cortex.invalidArgument.unspecified', { reason: '' + objectName + ' is not available for export.' })
                }

                return true
              }
            }
          }
        ]
      },
      {
        label: 'Paths',
        name: 'paths',
        type: 'String',
        array: true,
        creatable: true,
        minItems: 0,
        maxItems: 100,
        dependencies: ['format', 'objects'],
        validators: [
          {
            name: 'adhoc',
            definition: {
              validator: function(ac, node, value, callback) {
                return callback(null, true)

              },
              asArray: true
            }
          }
        ]
      },
      {
        label: 'Include',
        name: 'include',
        type: 'String',
        array: true,
        creatable: true,
        minItems: 0,
        maxItems: 100
      },
      {
        label: 'Expand',
        name: 'expand',
        type: 'String',
        array: true,
        creatable: true,
        minItems: 0,
        maxItems: 100
      },
      {
        label: 'Principal',
        name: 'principal',
        type: 'ObjectId',
        default: null,
        creatable: true,
        writer: function(ac, node, value, options, callback) {
          if (value === null || value === undefined) {
            return callback(null, null)
          }
          if (equalIds(value, acl.AnonymousIdentifier) || equalIds(value, acl.PublicIdentifier)) {
            return callback(null, value)
          }
          ap.create(ac.org, value, (err, principal) => {
            callback(err, principal && principal._id)
          })
        }
      },
      {
        label: 'Path Prefix',
        name: 'prefix',
        type: 'String',
        creatable: true
      },
      {
        label: 'Where',
        name: 'where',
        type: 'String',
        creatable: true,
        dependencies: ['format', 'objects', 'paths', 'include'],
        validators: [
          {
            name: 'string',
            definition: {
              allowNull: true,
              min: 0,
              max: 1024
            }
          },
          {
            name: 'adhoc',
            definition: {
              validator: function(ac, node, value, callback) {
                this.prepParser(ac, { where: value }, this.paths, this.include, this.expand, err => {
                  callback(err, true)
                })
              },
              asArray: true
            }
          }
        ]
      },
      {
        label: 'After Script',
        name: 'afterScript',
        type: 'String',
        creatable: true,
        trim: true,
        default: '',
        validators: [
          {
            name: 'adhoc',
            definition: {
              validator: function(ac, node, source) {
                let maxLen = rInt(ac.org.configuration.scripting.maxScriptSize, 1024 * 50)
                if (!_.isString(source) || source.length > maxLen) {
                  throw Fault.create('cortex.invalidArgument.maxScriptLength', { reason: `Your script exceeds the maximum length of ${maxLen} by ${source.length - maxLen}` })
                }
                return true
              }
            }
          },
          {
            name: 'adhoc',
            definition: {
              message: 'A valid script.',
              validator: function(ac, node, source, callback) {
                const transpileOptions = {
                  filename: `Export ${this._id}`,
                  language: 'javascript',
                  specification: 'es6'
                }
                transpiler.transpile(source, transpileOptions, err => {
                  callback(err, true)
                })
              }
            }
          }
        ]
      },
      {
        _id: consts.Properties.Files.Ids.Export.Files,
        label: 'Files',
        name: 'files',
        type: 'Any',
        apiType: 'Facet[]',
        dependencies: ['storageId'],
        virtual: true,
        optional: true,

        groupReader: function(node, principal, entries, req, script, selection, callback) {

          const Export = modules.db.models.Export

          let skip = 0,
              limit = Export.DEF_KEYS,
              options = dotPath(pathTo(req, 'query'), selection.fullPath),
              // direct access?
              fileNumString = rString((pathTo(entries[0], 'ac.propPath') || '').split('.')[1], ''),
              fileNum = parseInt(fileNumString),
              isDirectAccess = fileNumString.length > 0 && entries.length === 1

          if (isDirectAccess) {

            if (!fileNumString || Export.padExportFileName(fileNum) !== fileNumString) {
              return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid file specification: ' + fileNumString }))
            }

            skip = fileNum
            limit = 1

          } else {

            if (options.skip !== null && options.skip !== undefined) {
              skip = rInt(options.skip, null)
              if (skip === null || skip < 0 || skip >= Export.PAD_MAX) {
                throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'skip query option must be an integer between 0 and ' + (Export.PAD_MAX - 1) + ', inclusive' })
              }
            }
            if (options.limit !== null && options.skip !== undefined) {
              limit = rInt(options.limit, null)
              if (limit === null || limit < 1 || limit > Export.MAX_KEYS) {
                throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'limit query option must be an integer between ' + Export.MIN_KEYS + ' and ' + Export.MAX_KEYS + ', inclusive' })
              }
            }
          }

          async.eachLimit(entries, 10, (entry, callback) => {

            modules.aws.getLocation(entry.ac.org, consts.LocationTypes.AwsS3, entry.input.storageId || consts.storage.availableLocationTypes.medable, (err, location) => {

              if (err) {
                return callback(err)
              }

              const localPrefix = '/exports/' + entry.input._id + '/files/',
                    keyPrefix = location.buildKey('exports/' + entry.input._id + '/files/'),
                    params = {
                      Marker: keyPrefix + ((skip === 0) ? '' : Export.padExportFileName(skip)),
                      MaxKeys: limit + 1,
                      Prefix: keyPrefix
                    }

              location.listObjects(params, { includePrefix: false }, function(err, results) {

                if (err) {
                  return callback(err)
                }

                let pos = 0,
                    batch = 10,
                    objects = toArray(pathTo(results, 'Contents')),
                    index = skip

                if (isDirectAccess) {
                  entry.output.files = null
                } else {
                  entry.output.files = {
                    object: 'list',
                    data: [],
                    hasMore: objects.length === (limit + 1)
                  }
                }

                if (objects.length > limit) {
                  objects.pop() // pop off the extra one we added for paging.
                }

                async.eachSeries(objects, (object, callback) => {

                  const paddedFilename = Export.padExportFileName(index++),
                        pointer = new modules.storage.AwsS3Pointer(node, {
                          ETag: object.ETag.replace(/"/g, ''), // unwrap quotes.
                          size: object.Size,
                          storageId: entry.input.storageId,
                          meta: [
                            {
                              name: 'awsId',
                              value: object.Key,
                              pub: false
                            },
                            {
                              name: 'originalPath',
                              value: object.Key.replace(keyPrefix + paddedFilename, '').replace(/\./g, '/'),
                              pub: true
                            }
                          ]
                        }, entry.ac)

                  if (isDirectAccess) {
                    pointer.setLocation(location) // just so we don't have to load it again.
                    entry.output.files = pathTo({}, fileNumString, pointer, true)
                    return callback()
                  }

                  let pointerJSON = pointer.aclRead(principal)
                  pointerJSON.object = 'facet'
                  pointerJSON.path = localPrefix + paddedFilename
                  entry.output.files.data.push(pointerJSON)

                  if ((pos++ % batch) === 0) {
                    setImmediate(callback, err)
                  } else {
                    callback(err)
                  }

                }, callback)

              })

            })

          }, err => {

            if (!err && isDirectAccess) {
              if (!entries[0].output.files) {
                err = Fault.create('cortex.notFound.unspecified', { reason: 'File not found.' })
              }
            }
            callback(err)

          })

        }

      },
      {
        _id: consts.Properties.Files.Ids.Export.Data,
        label: 'Export Data',
        name: 'dataFile',
        type: 'File',
        urlExpirySeconds: config('uploads.s3.readUrlExpiry')
      },
      {
        label: 'Stats',
        name: 'stats',
        type: 'Document',
        properties: [
          {
            label: 'Docs',
            name: 'docs',
            type: 'Document',
            properties: [
              {
                label: 'Count',
                name: 'count',
                type: 'Number',
                default: 0
              }
            ]
          },
          {
            label: 'Files',
            name: 'files',
            type: 'Document',
            properties: [
              {
                label: 'Count',
                name: 'count',
                type: 'Number',
                default: 0
              },
              {
                label: 'Size',
                name: 'size',
                type: 'Number',
                default: 0
              }
            ]
          }
        ]
      },
      {
        label: 'Expires At',
        name: 'expiresAt',
        type: 'Date'
      },
      {
        label: 'Started',
        name: 'started',
        type: 'Date'
      },
      {
        label: 'Completed',
        name: 'completed',
        type: 'Date'
      },
      {
        label: 'Fault',
        name: 'fault',
        type: 'Any',
        serializeData: false
      },
      {
        label: 'Events',
        name: 'events',
        type: 'Document',
        array: true,
        optional: true,
        properties: [
          {
            label: 'Name',
            name: 'name',
            type: 'String'
          },
          {
            label: 'Event',
            name: 'event',
            type: 'Any'
          }
        ]
      }
    ]
  }
}

// shared methods --------------------------------------------------------

ExportDefinition.methods = {

  prepParser: function(ac, options, paths, include, expand, callback) {

    if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

    async.waterfall(
      [
        callback => {
          ac.org.createObject(this.objects, { usePluralName: null }, (err, model) => {
            if (!err && ~['accounts', 'objects', 'scripts', 'views', 'exports', 'deployments'].indexOf(model.pluralName)) {
              err = Fault.create('cortex.invalidArgument.unspecified', { reason: '' + model.pluralName + ' are not available for export.' })
            }
            callback(err, model)
          })
        },

        (model, callback) => {
          if (!this.principal) {
            return callback(null, model, ac.principal)
          }
          ap.create(ac.org, this.principal, (err, principal) => {
            callback(err, model, principal)
          })
        },

        (model, principal, callback) => {

          const loadOptions = {
            paths: (paths && paths.length) ? paths : null,
            include: (include && include.length) ? include : null,
            expand: (expand && expand.length) ? expand : null,
            allowNoLimit: true,
            returnParser: true,
            where: options.where || this.where,
            limit: false,
            skipAcl: true,
            nodeFilter: n => !n.virtual
          }
          if (this.principal) {
            loadOptions.nodeFilter = null
            loadOptions.skipAcl = false
          }
          if (this.principal && this.prefix) {
            const parts = normalizeObjectPath(String(this.prefix).replace(/\//g, '.')).split('.'),
                  _id = getIdOrNull(parts[0]),
                  path = parts.slice(1).join('.'),
                  through = _.once((err, results, parser, select) => {
                    callback(err, principal, parser, model, select)
                  }),
                  readOptions = {
                    paths: [path],
                    singlePath: path,
                    singleCursor: true,
                    singleOptions: loadOptions,
                    singleCallback: through
                  }

            if (!_id || !path) {
              return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid path prefix for cursor_open(). An _id and property are required.' }))
            }
            return model.aclReadOne(principal, _id, readOptions, function(err, results, parser, select) {
              through(err, principal, parser, model, select)
            })
          }

          model.aclLoad(principal, loadOptions, (err, results, parser, select) => {
            if (!err) {
              select.facets = 1
            }
            callback(err, principal, parser, model, select)
          })
        }

      ],
      callback
    )

  }

}

// shared statics --------------------------------------------------------

ExportDefinition.statics = {

  PAD_MAX: 9999999999,
  DEF_KEYS: 100,
  MIN_KEYS: 1,
  MAX_KEYS: 999,
  PAD: '0000000000',

  padExportFileName: function(num) {
    const str = (num).toString()
    return this.PAD.substring(0, this.PAD.length - str.length) + str
  },

  logEvent: function(_id, name, event, callback = () => {}) {

    modules.db.sequencedUpdate(
      this,
      { _id },
      {
        $push: {
          events: [{
            _id: createId(),
            name,
            event
          }]
        }
      },
      (err) => {
        callback(err)
      }
    )

  }

}

// indexes ---------------------------------------------------------------

ExportDefinition.indexes = [

]

// shared hooks  ---------------------------------------------------------

ExportDefinition.apiHooks = [
  {

    name: 'create',
    before: function(vars, callback) {

      // when created by an admin, the initial acl will include Read access by other administrators.
      if (vars.ac.principal.isOrgAdmin()) {
        vars.ac.subject.acl.push({ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Delete })
      }

      callback()

    }

  },
  {

    name: 'validate',
    after: function(vars, callback) {

      // locations are determined during validation so this needs to go here.
      if (vars.ac.subject.isNew) {

        if (!isValidDate(vars.ac.subject.expiresAt)) {

          let days = clamp(rInt(config('exports.defaultTtlDays'), 7), 0, config('exports.maxTtlDays'))

          if (vars.ac.subject.storageId !== consts.storage.availableLocationTypes.medable) {

            const storageId = vars.ac.subject.storageId,
                  location = vars.ac.org.configuration.storage.locations.find(v => v.name === storageId)

            if (location) {
              days = clamp(rInt(location.exportTtlDays, 0), 0, config('exports.maxTtlDays'))
            }

          }

          if (days !== 0) {
            vars.ac.subject.expiresAt = new Date(Date.now() + (1000 * 86400 * days))
          }

        }

      }

      callback()
    }

  },
  {

    name: 'save',
    before: function(vars, callback) {
      callback()
    }

  },
  {
    name: 'create',
    after: function(vars) {

      modules.workers.send('work', 'exporter', {
        org: vars.ac.orgId,
        export: vars.ac.subjectId
      },
      {
        reqId: vars.ac.reqId,
        orgId: vars.ac.orgId
      })

      this.logEvent(
        vars.ac.subjectId,
        'queued',
        {
          state: 'pending'
        }
      )

    }

  }
]

// exports --------------------------------------------------------

module.exports = ExportDefinition
