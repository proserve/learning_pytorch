'use strict'

const Fault = require('cortex-service/lib/fault'),
      utils = require('../../utils'),
      _ = require('underscore'),
      consts = require('../../consts'),
      modules = require('../../modules'),
      async = require('async'),
      MediaPointer = require('./pointer'),
      TempFilePointer = require('./temp-file'),
      classes = new Map([
        [consts.LocationTypes.File, require('./file')],
        [consts.LocationTypes.Buffer, require('./buffer')],
        [consts.LocationTypes.AwsS3, require('./aws.s3')],
        [consts.LocationTypes.AwsS3Upload, require('./aws.s3.upload')],
        [consts.LocationTypes.UploadObject, require('./upload.object')]
      ])

function getOrAddToMap(map, key, value) {

  return map.get(key) || (map.set(key, value), value)

}

class StorageModule {

  static get BufferPointer() { return classes.get(consts.LocationTypes.Buffer) }
  static get FilePointer() { return classes.get(consts.LocationTypes.File) }
  static get AwsS3Pointer() { return classes.get(consts.LocationTypes.AwsS3) }
  static get AwsS3UploadPointer() { return classes.get(consts.LocationTypes.AwsS3Upload) }
  static get UploadObjectPointer() { return classes.get(consts.LocationTypes.UploadObject) }
  static get TempFilePointer() { return TempFilePointer }

  static create(node, entry, ac = null) {
    const Cls = classes.get(utils.path(entry, 'location'))
    return Cls ? new Cls(node, entry, ac) : null
  }

  static isPointer(ptr) {

    return ptr && (ptr instanceof MediaPointer)
  }

  static accessPointer(rootDocument, facetNode, file, facetIdOrName, ac) {

    if (!rootDocument || !file || !_.isArray(file.facets)) {
      throw Fault.create('cortex.notFound.file')
    }

    // read by id, name, or default value.
    let facet,
        f,
        pointer,
        len = file.facets.length

    const name = facetIdOrName || null,
          facetId = utils.getIdOrNull(facetIdOrName),
          facetsIndex = utils.array(utils.path(rootDocument, 'facets'))

    if (facetId) {
      if (utils.inIdArray(file.facets, facetId)) {
        facet = utils.findIdInArray(facetsIndex, 'pid', facetId)
      }
    } else if (name) {
      while (!facet && len--) {
        f = utils.findIdInArray(facetsIndex, 'pid', file.facets[len])
        if (f && f.name === name) {
          facet = f
        }
      }
    }

    if (!facetNode) {
      const facetObject = rootDocument.constructor,
            facetRoot = facetObject && facetObject.schema && facetObject.schema.node

      if (facetRoot && facetRoot.findNodeById) {
        facetNode = facetRoot.findNodeById(facet._pi)
      }
    }

    if (!facet) {
      throw Fault.create('cortex.notFound.facet')
    }

    if (ac && facet.private && !utils.equalIds(facet.creator, utils.path(ac, 'principalId'))) {
      throw Fault.create('cortex.accessDenied.privateFacet')
    }

    if (facet.state === consts.media.states.pending || facet.state === consts.media.states.processing) {
      throw Fault.create('cortex.accepted.mediaNotReady', { reason: 'File is not ready. State: ' + facet.state })
    }

    if (facet.state !== consts.media.states.ready) {
      const err = Fault.create('cortex.error.facet')
      if (facet.fault) {
        err.add(Fault.from(facet.fault))
      }
      throw err
    }

    pointer = StorageModule.create(facetNode, facet, ac)
    if (!pointer) {
      throw Fault.create('cortex.notFound.file')
    }
    return pointer

  }

  /**
     * updates the bson size of documents until no more updates are found. note: posts and comments are not included with objects and must be passed
     * in as 'post' and 'comment', or as 'post' in collections
     *
     * @important this makes the assumption that posts and comments will never be in their own custom collections (because they are deprecated)
     *
     * @param org
     * @param options
     *     limit (10,000): stop after this number of modifications (may be set to false to continue until complete)
     *     batchSize (10,000, max 10,000): limit to a batch size.
     *     objects ([]): array of objects to process (if none, loads all org objects). this can include post and comment
     *     writeConcern ('majority'): the mongodb write concern
     *     readPreference ('secondary')
     *     wTimeout (1000): write concern timeout
     *     journal (true): write concern journal
     *     continueOnError (false): if true, adds an errors array and tolerates errors. invalid agument errors will still be at the top level.
     *
     * @param callback err, {numModified: Number, hasMore: Bool, errors: []}
     * @return a request that can be cancelled.
     */
  static updateDocumentSizes(org, options, callback) {

    const { Object: Obj, OO, Stat } = modules.db.models,
          { StatsGroup } = Stat,
          request = {
            cancel: () => {
              this.cancelled = true
            }
          },
          accumulatedErrors = []

    if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

    if (!(org && (org instanceof modules.db.models.org))) {
      setImmediate(callback, Fault.create('cortex.invalidArgument.unspecified', { reason: 'org argument be an instance of Org.' }))
      return request
    }

    // 1. determine what to process.
    async.waterfall([

      async() => {

        const objectEntries = await Obj.collection.aggregate([{
                $match: {
                  org: org._id,
                  object: 'object',
                  reap: false
                }
              }, {
                $group: {
                  _id: '$dataset.collection',
                  objectNames: { $addToSet: '$name' }
                }
              }], { cursor: {} }).toArray(),

              ooEntries = await OO.collection.aggregate([{
                $match: {
                  org: org._id,
                  object: 'oo',
                  reap: false
                }
              }, {
                $group: {
                  _id: '$dataset.collection',
                  objectNames: { $addToSet: '$name' }
                }
              }], { cursor: {} }).toArray(),

              // figure out which objects are in which collections and resolve collection objects.
              collectionEntries = Object.values([...objectEntries, ...ooEntries].reduce((map, entry) => {
                if (map[entry._id]) {
                  map[entry._id].objectNames.push(...entry.objectNames)
                } else {
                  map[entry._id] = {
                    collectionName: entry._id,
                    objectNames: entry.objectNames
                  }
                }
                return map
              }, {
                // native objects and posts/comments are in predictable collections.
                contexts: {
                  collectionName: 'contexts',
                  objectNames: org.configuration.legacyObjects ? Object.keys(consts.NativeIds) : (_.difference(Object.keys(consts.NativeIds), Object.keys(consts.LegacyObjectIds)))
                },
                // count these because there may be a lot of them.
                oos: {
                  collectionName: 'oo-definitions',
                  objectNames: ['oo']
                },
                audits: {
                  collectionName: 'audits',
                  objectNames: ['audit']
                },
                posts: {
                  collectionName: 'posts',
                  objectNames: ['post', 'comment']
                }
              }))

        for (let entry of collectionEntries) {
          entry.collection = await modules.db.connection.db.collection(entry.collectionName)
        }

        return collectionEntries

      },

      (collectionsEntries, callback) => {

        let hasMore = collectionsEntries.length > 0, numModified = 0

        const limit = options.limit === false ? false : Math.max(1, utils.rInt(options.limit, 1000)),
              batchSize = Math.min(Math.max(1, utils.rInt(options.batchSize, 1000)), Math.min(1000, limit === false ? 1000 : limit))

        async.whilst(

          () => hasMore && (limit === false || numModified < limit),

          callback => {

            if (request.cancelled) {
              return callback(Fault.create('cortex.error.aborted'))
            }

            const filter = {
              'meta.up': consts.metadata.updateBits.documentSize,
              org: org._id,
              object: { $in: collectionsEntries[0].objectNames },
              reap: false
            }

            collectionsEntries[0].collection.mapReduce(

              function map() {
                emit({ // eslint-disable-line no-undef
                  sequence: this.sequence,
                  size: NumberInt(Object.bsonsize(this)), // eslint-disable-line new-cap, no-undef
                  oldSize: this.meta.sz
                }, {
                  documents: [{
                    _id: this._id,
                    org: this.org,
                    object: this.object,
                    type: this.type,
                    pcontext: this.pcontext,
                    context: this.context
                  }]
                })
              },

              function reduce(key, values) {
                return values.reduce(function(out, value) {
                  out.documents = out.documents.concat(value.documents)
                  return out
                }, { documents: [] })
              },
              {
                readPreference: utils.rString(options.readPreference, 'secondary'),
                out: {
                  inline: 1
                },
                query: filter,
                limit: limit === false ? batchSize : (Math.min(limit - numModified, batchSize))
              },
              (err, groups) => {
                if (err || groups.length === 0) {
                  collectionsEntries.shift()
                  hasMore = collectionsEntries.length > 0
                  return callback(err)
                }
                onMapReduce(groups)
              }
            )

            function onMapReduce(groups) {

              const statsGroup = new StatsGroup(),
                    sizeUpdates = groups.reduce((operations, group) => {

                      group.value.documents.forEach(document => {
                        const { org, object, type } = document
                        statsGroup.add(consts.operations.codes.docStorage, org, object, object, type, null, 0, utils.rInt(group._id.size, 0) - utils.rInt(group._id.oldSize, 0))
                      })

                      const updateMany = {
                        filter: {
                          _id: { $in: group.value.documents.map(v => v._id) },
                          sequence: group._id.sequence
                        },
                        update: {
                          $inc: { sequence: 1 }
                        }
                      }
                      updateMany.update.$set = { 'meta.sz': group._id.size }
                      updateMany.update.$pullAll = { 'meta.up': [consts.metadata.updateBits.documentSize] }

                      operations.push({
                        updateMany
                      })
                      return operations

                    }, [])

              collectionsEntries[0].collection.bulkWrite(sizeUpdates, {
                ordered: false,
                writeConcern: {
                  w: utils.rString(options.writeConcern, 'majority'),
                  wtimeout: utils.rInt(options.wTimeout, 60000),
                  j: utils.rBool(options.journal, true)
                }
              }, (err, result) => {

                if (!err) {
                  numModified += result.modifiedCount
                  statsGroup.save()
                }
                callback(err) // dangerous to continue on error here.

              })

            }

          },

          err => callback(err, { numModified, hasMore })

        )

      }

    ], (err, result) => {
      if (result && options.continueOnError) {
        result.errors = accumulatedErrors
      }
      callback(err, result)
    })

    return request

  }

  static calculateCacheUsage(org, starting, ending, callback) {

    const pipeline = [{
            $match: { org: org._id }
          }, {
            $group: {
              _id: null,
              count: { $sum: 1 },
              size: { $sum: '$sz' }
            }
          }],
          readOptions = {
            readPreference: 'secondaryPreferred',
            cursor: {}
          }

    modules.db.models.cache.collection.aggregate(pipeline, readOptions).toArray((err, result) => {

      if (err || !(result && result[0])) {
        return callback(err)
      }

      const entry = result && result[0],
            find = {
              org: org._id,
              starting: starting,
              ending: ending,
              code: consts.stats.sources.cacheStorage,
              s_source: 'cache',
              s_object: 'cache',
              s_type: 'cache',
              s_property: 'cache'
            },
            update = {
              $setOnInsert: find,
              $set: {
                count: entry.count,
                size: entry.size
              }
            }

      modules.db.models.stat.collection.update(find, update, { writeConcern: { w: 'majority' }, upsert: true }, err => {
        callback(err)
      })
    })

  }

  static isInternallyStoredFacet(facet) {
    return facet && this.isInternalStorage(facet.location, facet.storageId)
  }

  static isInternalStorage(location, storageId) {
    return (location === consts.LocationTypes.AwsS3 || location === consts.LocationTypes.UploadObject) &&
           (!storageId || storageId === consts.storage.availableLocationTypes.medable || storageId === consts.storage.availableLocationTypes.public)
  }

  /**
     * re-calculate point-in-time storage values.
     *
     * org.
     * objects ([]): array of objects to process (if none, loads all org objects)
     *     readPreference ('secondary')
     *     continueOnError (false): if true, adds an errors array to the result, and tolerates some errors. invalid agument errors will still be at the top level.
     *     documents: true,
     *     files: true
     *
     * @param org
     * @param starting
     * @param ending
     * @param options
     * @param callback err, results {documents: [], files: [], errors: []}
     * @return a request that can be cancelled.
     */
  static recalculateStorage(org, starting, ending, options, callback) {

    if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

    const request = {
            cancel: () => {
              this.cancelled = true
            }
          },
          accumulatedErrors = [],
          objectNames = options.objects ? _.uniq(_.intersection(org.getObjectNames(), utils.array(options.objects, true))) : org.getObjectNames()

    if (org && !(org instanceof modules.db.models.org)) {
      setImmediate(callback, Fault.create('cortex.invalidArgument.unspecified', { reason: 'org argument be an instance of Org.' }))
      return request
    }

    async.reduce(objectNames, {}, (definitions, objectName, callback) => {

      if (request.cancelled) {
        return callback(Fault.create('cortex.error.aborted'))
      }

      org.createObject(objectName, (err, object) => {

        if (err) {
          if (options.continueOnError) {
            accumulatedErrors.push(err)
            err = null
          }
          return callback(err, definitions)
        }

        definitions[objectName] = {
          objectName: objectName,
          collection: object.collection,
          context_files: [],
          posts: {}
        }

        const node = object.schema.node,
              types = node.typed ? [object, ..._.values(node.types).map(v => v.model)] : [object]

        types.forEach(object => {
          object.schema.node.walk(function(node) {
            if (node.getTypeName() === 'File' && node._id) {
              if (!utils.inIdArray(definitions[objectName].context_files, node._id)) {
                definitions[objectName].context_files.push(node._id)
              }
            }
          })
        })

        object.feedDefinition.map(function(def) {

          const postModel = object.getPostModel(def.postType)
          if (postModel) {
            const postData = (definitions[objectName].posts[postModel.postType] = {
                    post_files: [],
                    comment_files: []
                  }),
                  commentModel = postModel.getCommentModel()

            postModel.schema.node.walk(function(node) {
              if (node.getTypeName() === 'File' && node._id) {
                postData.post_files.push(node._id)
              }
            })
            postData.hasComments = utils.isSet(commentModel)
            if (postData.hasComments) {
              commentModel.schema.node.walk(function(node) {
                if (node.getTypeName() === 'File' && node._id) {
                  postData.comment_files.push(node._id)
                }
              })
            }
          }

        })

        callback(null, definitions)

      })

    }, (err, definitions) => {

      void err

      const tasks = {},
            processDocuments = utils.rBool(options.documents, true),
            processFiles = utils.rBool(options.files, true),
            processCache = utils.rBool(options.cache, true)

      if (processDocuments) {

        const postAndCommentMatches = [],
              // group into collections (post and comment are always in the 'posts' collection).
              collections = Object.keys(definitions).reduce((collections, objectName) => {
                const objectEntry = definitions[objectName]
                getOrAddToMap(collections, objectEntry.collection, []).push(objectEntry)
                let postTypes = Object.keys(objectEntry.posts)
                if (postTypes.length) {
                  postAndCommentMatches.push({
                    org: org._id,
                    object: 'post',
                    type: { $in: postTypes },
                    'context.object': objectName
                  }, {
                    org: org._id,
                    object: 'comment',
                    type: { $in: postTypes },
                    'pcontext.object': objectName
                  })
                }
                return collections

              }, new Map())

        tasks.context_documents = callback => {

          // aggregate each collection into document size statistics
          async.reduce(Array.from(collections), [], (results, entry, callback) => {

            if (request.cancelled) {
              return callback(Fault.create('cortex.error.aborted'))
            }

            const collection = entry[0], definitions = entry[1],
                  pipeline = [{
                    $match: {
                      org: org._id,
                      object: { $in: definitions.map(v => v.objectName) }
                    }
                  }, {
                    $project: {
                      org: 1,
                      object: 1,
                      type: 1,
                      meta: 1
                    }
                  }, {
                    $group: {
                      _id: {
                        object: '$object',
                        type: '$type'
                      },
                      count: { $sum: 1 },
                      size: { $sum: '$meta.sz' }
                    }
                  }, {
                    $project: {
                      _id: false,
                      org: org._id,
                      code: { $literal: consts.stats.sources.docStorage },
                      s_source: '$_id.object',
                      s_object: '$_id.object',
                      s_type: '$_id.type',
                      s_property: null,
                      count: 1,
                      size: 1
                    }
                  }],
                  readOptions = {
                    readPreference: 'secondaryPreferred',
                    cursor: {}
                  }

            collection.aggregate(pipeline, readOptions).toArray((err, result) => {

              if (err && options.continueOnError) {
                accumulatedErrors.push(err)
                err = null
                result = []

              }
              callback(err, err ? null : results.concat(result))

            })

          }, callback)

        }

        if (postAndCommentMatches.length) {
          tasks.post_documents = callback => {

            const pipeline = [{
                    $match: {
                      $or: postAndCommentMatches
                    }
                  }, {
                    $project: {
                      org: 1,
                      object: 1,
                      type: 1,
                      meta: 1,
                      context: 1,
                      pcontext: 1
                    }
                  }, {
                    $group: {
                      _id: {
                        source: { $ifNull: ['$pcontext.object', '$context.object'] },
                        object: '$object',
                        type: '$type'
                      },
                      count: { $sum: 1 },
                      size: { $sum: '$meta.sz' }
                    }
                  }, {
                    $project: {
                      _id: false,
                      org: org._id,
                      code: { $literal: consts.stats.sources.docStorage },
                      s_source: '$_id.source',
                      s_object: '$_id.object',
                      s_type: '$_id.type',
                      s_property: null,
                      count: 1,
                      size: 1
                    }
                  }],
                  readOptions = {
                    readPreference: 'secondaryPreferred',
                    cursor: {}
                  }

            modules.db.models.post.collection.aggregate(pipeline, readOptions).toArray((err, result) => {
              if (err && options.continueOnError) {
                accumulatedErrors.push(err)
                err = null
                result = []
              }
              callback(err, result)

            })

          }
        }

      }

      if (processFiles) {

        const postAndCommentMatches = [],
              // group into collections (post and comment are always in the 'posts' collection).
              collections = Object.keys(definitions).reduce((collections, objectName) => {
                const objectEntry = definitions[objectName]
                getOrAddToMap(collections, objectEntry.collection, []).push(objectEntry)
                let postTypes = Object.keys(objectEntry.posts)
                if (postTypes.length) {

                  const postFiles = utils.idArrayUnion(..._.values(objectEntry.posts).map(v => v.post_files))
                  if (postFiles.length) {
                    postAndCommentMatches.push({
                      org: org._id,
                      object: 'post',
                      type: { $in: postTypes },
                      'context.object': objectName,
                      facets: {
                        $elemMatch: {
                          _pi: { $in: postFiles },
                          state: 2,
                          _kl: false,
                          $or: [{
                            storageId: { $exists: false }
                          }, {
                            storageId: consts.storage.availableLocationTypes.medable
                          }]
                        }
                      }
                    })
                  }

                  let commentFiles = utils.idArrayUnion(..._.values(objectEntry.posts).map(v => v.comment_files))
                  if (commentFiles.length) {
                    postAndCommentMatches.push({
                      org: org._id,
                      object: 'post',
                      type: { $in: postTypes },
                      'pcontext.object': objectName,
                      facets: {
                        $elemMatch: {
                          _pi: { $in: commentFiles },
                          state: 2,
                          _kl: false,
                          $or: [{
                            storageId: { $exists: false }
                          }, {
                            storageId: consts.storage.availableLocationTypes.medable
                          }]
                        }
                      }
                    })
                  }
                }
                return collections

              }, new Map())

        tasks.context_files = callback => {

          // aggregate each collection into document size statistics
          async.reduce(Array.from(collections), [], (results, entry, callback) => {

            if (request.cancelled) {
              return callback(Fault.create('cortex.error.aborted'))
            }

            const collection = entry[0], definitions = entry[1],
                  contextFiles = utils.idArrayUnion(...definitions.map(v => v.context_files)),
                  pipeline = [{
                    $match: {
                      org: org._id,
                      object: { $in: definitions.map(v => v.objectName) },
                      'facets._pi': { $in: contextFiles }
                    }
                  }, {
                    $project: {
                      org: 1,
                      object: 1,
                      type: 1,
                      meta: 1,
                      facets: 1,
                      context: 1,
                      pcontext: 1
                    }
                  }, {
                    $unwind: '$facets'
                  }, {
                    $match: {
                      'facets._pi': { $in: contextFiles },
                      'facets.state': 2,
                      'facets._kl': false,
                      $or: [{
                        'facets.storageId': { $exists: false }
                      }, {
                        'facets.storageId': consts.storage.availableLocationTypes.medable
                      }]
                    }
                  }, {
                    $group: {
                      _id: {
                        object: '$object',
                        type: '$type',
                        property: '$facets._pi'
                      },
                      count: { $sum: 1 },
                      size: { $sum: '$facets.size' }
                    }
                  }, {
                    $project: {
                      _id: false,
                      org: org._id,
                      code: { $literal: consts.stats.sources.fileStorage },
                      s_source: '$_id.object',
                      s_object: '$_id.object',
                      s_type: '$_id.type',
                      s_property: '$_id.property',
                      count: 1,
                      size: 1
                    }
                  }],
                  readOptions = {
                    readPreference: 'secondaryPreferred',
                    cursor: {}
                  }

            if (contextFiles.length === 0) {
              return callback(null, results)
            }

            collection.aggregate(pipeline, readOptions, (err, result) => {

              if (err && options.continueOnError) {
                accumulatedErrors.push(err)
                err = null
                result = []

              }
              callback(err, err ? null : results.concat(result))

            })

          }, callback)

        }

        if (postAndCommentMatches.length) {
          tasks.post_files = callback => {

            const allPostAndCommentFileIds = utils.idArrayUnion(
                    ...Object.keys(definitions).map(objectName => {
                      return _.union(..._.values(definitions[objectName].posts).map(v => v.post_files))
                    }),
                    ...Object.keys(definitions).map(objectName => {
                      return _.union(..._.values(definitions[objectName].posts).map(v => v.comment_files))
                    })
                  ),
                  pipeline = [{
                    $match: {
                      'facets._pi': { $in: allPostAndCommentFileIds },
                      $or: postAndCommentMatches
                    }
                  }, {
                    $unwind: '$facets'
                  }, {
                    $match: {
                      'facets._pi': { $in: allPostAndCommentFileIds },
                      'facets.state': 2,
                      'facets._kl': false,
                      'facets.location': { $type: 16 } // int
                    }
                  }, {
                    $group: {
                      _id: {
                        source: { $ifNull: ['$pcontext.object', '$context.object'] },
                        object: '$object',
                        type: '$type',
                        property: '$facets._pi'
                      },
                      count: { $sum: 1 },
                      size: { $sum: '$facets.size' }
                    }
                  }, {
                    $project: {
                      _id: false,
                      org: org._id,
                      code: { $literal: consts.stats.sources.fileStorage },
                      s_source: '$_id.source',
                      s_object: '$_id.object',
                      s_type: '$_id.type',
                      s_property: '$_id.property',
                      count: 1,
                      size: 1
                    }
                  }],
                  readOptions = {
                    readPreference: 'secondaryPreferred',
                    cursor: {}
                  }

            if (allPostAndCommentFileIds.length === 0) {
              return callback(null, [])
            }

            modules.db.models.post.collection.aggregate(pipeline, readOptions, (err, result) => {
              if (err && options.continueOnError) {
                accumulatedErrors.push(err)
                err = null
                result = []
              }
              callback(err, result)

            })

          }
        }

      }

      if (processCache) {
        tasks.cache_data = callback => {

          const pipeline = [{
                  $match: { org: org._id }
                }, {
                  $group: {
                    _id: null,
                    count: { $sum: 1 },
                    size: { $sum: '$sz' }
                  }
                }, {
                  $project: {
                    _id: false,
                    org: org._id,
                    code: { $literal: consts.stats.sources.cacheStorage },
                    s_source: 'cache',
                    s_object: 'cache',
                    s_type: 'cache',
                    s_property: 'cache',
                    count: 1,
                    size: 1
                  }
                }],
                readOptions = {
                  readPreference: 'secondaryPreferred',
                  cursor: {}
                }

          modules.db.models.cache.collection.aggregate(pipeline, readOptions).toArray((err, result) => {
            if (err && options.continueOnError) {
              accumulatedErrors.push(err)
              err = null
              result = []
            }
            callback(err, result)

          })
        }
      }

      async.series(tasks, (err, result) => {

        const output = { entries: [] }
        if (result) {
          if (options.continueOnError) {
            output.errors = accumulatedErrors
          }
          if (processDocuments) {
            output.entries.push(...utils.array(result.context_documents).concat(utils.array(result.post_documents)))
          }
          if (processFiles) {
            output.entries.push(...utils.array(result.context_files).concat(utils.array(result.post_files)))
          }
          if (processCache) {
            output.entries.push(...utils.array(result.cache_data))
          }
        }

        if (err || output.entries.length === 0) {
          return callback(err, output)
        }

        async.eachSeries(output.entries, (entry, callback) => {

          const Statistic = modules.db.models.Stat,
                find = {
                  org: org._id,
                  starting: starting,
                  ending: ending,
                  code: entry.code,
                  s_source: entry.s_source,
                  s_object: entry.s_object,
                  s_type: entry.s_type,
                  s_property: entry.s_property
                },
                update = {
                  $setOnInsert: find,
                  $set: {
                    count: entry.count,
                    size: entry.size
                  }
                }

          // allow low-level query access to internal property updaters for special cases like favorites array updates.
          Statistic.collection.updateOne(find, update, { writeConcern: { w: 'majority' }, upsert: true }, () => {
            callback()
          })

        }, err => {
          callback(err, output)
        })
      })

    })

    return request

  }

}

module.exports = StorageModule
