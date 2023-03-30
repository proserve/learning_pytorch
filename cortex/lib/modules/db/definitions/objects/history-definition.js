'use strict'

const acl = require('../../../../acl'),
      async = require('async'),
      _ = require('underscore'),
      consts = require('../../../../consts'),
      util = require('util'),
      utils = require('../../../../utils'),
      modules = require('../../../../modules'),
      SelectionTree = require('../classes/selection-tree'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition')

let Undefined

function HistoryDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(HistoryDefinition, BuiltinContextModelDefinition)

HistoryDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = HistoryDefinition.statics
  options.methods = HistoryDefinition.methods
  options.indexes = HistoryDefinition.indexes
  options.options = { collection: HistoryDefinition.collection }
  options.apiHooks = HistoryDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

HistoryDefinition.collection = 'history'

HistoryDefinition.prototype.getNativeOptions = function() {

  return {
    _id: consts.NativeIds.history,
    objectLabel: 'History',
    objectName: 'history',
    pluralName: 'histories',
    collection: 'history',
    isExtensible: false,
    defaultAclOverride: false,
    defaultAclExtend: false,
    defaultAcl: [],
    createAclOverwrite: false,
    createAclExtend: false,
    allowConnections: false,
    allowConnectionsOverride: false,
    isVersioned: false,
    isDeletable: false,
    isUnmanaged: true,
    shareChainOverride: false,
    shareAclOverride: false,
    createAcl: [],
    shareChain: [acl.AccessLevels.Share, acl.AccessLevels.Connected],
    isFavoritable: false,
    allowConnectionOptionsOverride: false,
    properties: [
      {
        // the operations applied
        label: 'Operations',
        name: 'ops',
        type: 'Document',
        array: true,
        maxItems: -1,
        readAccess: acl.AccessLevels.Script,
        properties: [
          {
            // the id of the property
            label: 'Property Identifier',
            name: 'pid',
            type: 'ObjectId',
            nativeIndex: true
          },
          {
            // the id of the updating principal
            label: 'Updater',
            name: 'updater',
            type: 'ObjectId'
          },
          {
            // the operation type, using consts.history.operations
            label: 'Type',
            name: 'type',
            type: 'Number'
          },
          {
            // the operation path, which is present if the update is contained in a document array
            // Examples: 'c_doc_array.4578616d706c6556616c7565'
            label: 'Path',
            name: 'path',
            type: 'String'
          },
          {
            // the array index of the operation when the property is an array
            label: 'Index',
            name: 'index',
            type: 'Number'
          },
          {
            // the affected value, when changed or removed
            label: 'Value',
            name: 'value',
            type: 'Any',
            serializeData: false
          }
        ]
      },
      {
        label: 'Context',
        name: 'context',
        type: 'Document',
        forceId: true,
        autoId: false,
        nativeIndexId: true,
        properties: [
          {
            // the originating context identifier
            label: 'Identifier',
            name: '_id',
            type: 'ObjectId',
            nativeIndex: true
          },
          {
            // the originating context object
            label: 'Object',
            name: 'object',
            type: 'String',
            nativeIndex: true
          },
          {
            // the date of the last document update
            label: 'Updated',
            name: 'updated',
            type: 'Date',
            readable: false
          },
          {
            // the id of the last principal to update the document
            label: 'Updater',
            name: 'updater',
            type: 'ObjectId',
            readable: false
          },
          {
            // the sequence at which the document was updated
            label: 'Sequence',
            name: 'sequence',
            type: 'Number',
            nativeIndex: true
          },
          {
            // if versioned, the version at which the change was made
            label: 'Version',
            name: 'version',
            type: 'Number',
            readable: false
          }
        ]
      },
      {
        // the tracked document values prior to applying changes
        label: 'Original Document',
        name: 'document',
        type: 'Any',
        serializeData: false,
        dependencies: ['ops', 'context'],
        readAccess: acl.AccessLevels.Public,
        groupReader: function(node, principal, entries, req, script, selection, callback) {

          const Definitions = modules.db.definitions,
                objects = {}

          async.series(
            [

              // load all possible objects
              callback => {
                async.reduce(
                  entries,
                  objects,
                  (objects, entry, callback) => {
                    const object = entry.input.context.object
                    if (objects[object] !== Undefined) {
                      objects[object].ids[entry.input.context._id] = null
                      return callback(null, objects)
                    }
                    principal.org.createObject(object, (err, model) => {
                      void err
                      objects[object] = {
                        model: model || null,
                        ids: {
                          [entry.input.context._id]: null
                        }
                      }
                      callback(null, objects)
                    })
                  },
                  callback
                )
              },

              // load source instance required acl paths to merge into original document and read a snapshot
              callback => {

                async.eachSeries(
                  objects,
                  (entry, callback) => {
                    if (!entry.model) {
                      return callback()
                    }
                    const loadOps = {
                      req,
                      script,
                      skipAcl: true,
                      grant: acl.AccessLevels.Script,
                      where: { _id: { $in: Object.keys(entry.ids) } },
                      limit: false,
                      allowNoLimit: true,
                      paths: ['_id']
                    }
                    entry.model.aclLoad(principal, loadOps, (err, docs) => {
                      void err
                      if (docs && docs.data) {
                        docs.data.forEach(doc => {
                          entry.ids[doc._id] = doc
                        })
                      }
                      callback()
                    })
                  },
                  callback
                )
              },

              // read out history document wherever possible
              callback => {

                async.eachSeries(
                  entries,
                  (entry, callback) => {

                    const { model, ids } = objects[entry.input.context.object],
                          required = ids[entry.input.context._id] || {},
                          typeModel = model && model.getModelForType(required.type),
                          { context, message, document, ops } = entry.input,
                          { updated, updater, sequence, version } = context,
                          include = Object.keys(utils.flattenObjectPaths(document)).map(path => path.replace('._dat_', '')), // @hack for safe any
                          paths = ['updated', 'updater', 'version', ...include],
                          selectionTree = new SelectionTree({ paths, ignoreMissing: true }),
                          subject = typeModel && Definitions.makeLightweightSubject(
                            Object.assign(
                              _.pick(required, typeModel.requiredAclPaths),
                              { updated, updater: { _id: updater }, sequence, version },
                              document
                            ),
                            typeModel
                          )

                    if (typeModel) {
                      selectionTree.setOption('forgiving', true)
                      selectionTree.setOption('ignoreAdhocPaths', true)
                      entry.ac.passive = true
                      const docAc = entry.ac.copy(subject)
                      subject.aclRead(docAc, selectionTree, readDoc)
                    } else {
                      readDoc(null, Object.assign(
                        { updated, updater: { _id: updater }, sequence, version },
                        document
                      ))
                    }

                    function readDoc(err, doc) {
                      // add sequence so it can be sorted later
                      if (doc) {
                        doc.sequence = sequence
                        const deleted = _.uniq(ops
                          .filter(op => [consts.history.operations.pull, consts.history.operations.remove].includes(op.type))
                          .map(op => op.path)
                          .filter(path => utils.digIntoResolved(doc, path, true, true) === undefined))
                        if (deleted.length) {
                          utils.path(doc, 'deleted', deleted)
                        }
                        if (message) {
                          utils.path(doc, 'message', message)
                        }
                        // delete doc._id
                        // delete doc.object
                        delete doc.org
                        // delete doc.type
                        delete doc.sequence

                        entry.output.document = doc

                      }
                      callback(err, doc)
                    }

                  },
                  callback
                )

              }

            ],
            callback
          )
        }
      },
      {
        // the raw data
        label: 'Raw Document Data',
        name: 'data',
        type: 'Any',
        optional: true,
        virtual: true,
        dependencies: ['document'],
        readAccess: acl.AccessLevels.Script,
        reader: function(ac) {
          return this.document
        }
      },
      {
        // audit changes
        label: 'Audit Message',
        name: 'message',
        type: 'String'
      }
    ]
  }

}

// shared methods --------------------------------------------------------

HistoryDefinition.methods = {}

// shared statics --------------------------------------------------------

HistoryDefinition.statics = {}

// indexes ---------------------------------------------------------------

HistoryDefinition.indexes = [

  [{ 'org': 1, 'object': 1, 'type': 1, 'context._id': 1, 'context.sequence': 1 }, { name: 'idxSourceContext' }],

  [{ 'org': 1, 'object': 1, 'type': 1, 'ops.pid': 1 }, { name: 'idxSourceProperty' }]

]

// shared hooks  ---------------------------------------------------------

HistoryDefinition.apiHooks = []

// exports --------------------------------------------------------

module.exports = HistoryDefinition
