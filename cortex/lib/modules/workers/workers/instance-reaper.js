'use strict'

const Worker = require('../worker'),
      util = require('util'),
      async = require('async'),
      logger = require('cortex-service/lib/logger'),
      _ = require('underscore'),
      acl = require('../../../acl'),
      modules = require('../../../modules'),
      storage = modules.storage,
      consts = require('../../../consts'),
      utils = require('../../../utils'),
      { promised } = utils,
      Fault = require('cortex-service/lib/fault'),
      ap = require('../../../access-principal'),
      { Stat, WorkerLock } = modules.db.models,
      { StatsGroup } = Stat,
      getAwsKey = (f) => {
        // for now, custom location reaping left to bucket owner.
        if (f && (f.location === consts.LocationTypes.AwsS3 || f.location === consts.LocationTypes.UploadObject) && f.meta && _.isArray(f.meta)) {
          const o = _.find(f.meta, o => o.name === 'awsId')
          if (o) {
            return o.value
          }
        }
        return null
      }

/* @todo future

- support for custom location reaping.
- maintenance routine to check for dangling instances (where there are no matching objects)
- maintenance routine to check on media that has no matching instance, post, or comment

*/

function InstanceReaperWorker() {
  Worker.call(this)
}

util.inherits(InstanceReaperWorker, Worker)

// InstanceReaperWorker.prototype.maxConcurrent = 1
InstanceReaperWorker.prototype.maxQueued = 5

/**
 * @param message
 * @param payload a string that revives to the following (see org.sendNotification)
 *      org                         // the org or org id.
 *      object                      // the object reaping target.
 * @param options
 * @param callback
 * @private
 */

let running = 0

InstanceReaperWorker.prototype._process = function(message, payload, options, callback) {

  const jobUpdateInterval = 1000,
        jobLockTimeout = 10000,
        uniqueIdentifier = 'InstanceReaper'

  WorkerLock.createOrSignalRestart(uniqueIdentifier, { timeoutMs: jobLockTimeout, updateIntervalMs: jobUpdateInterval }, (err, lock) => {
    if (err || !lock) {
      return callback(err)
    }

    if (running > 0) {
      logger.error('[instance-reaper] MORE THAN ONE INSTANCE RUNNING')
    }
    running++
    this._do(lock, message, payload, options, err => {
      running--
      callback(err)
    })
  })

}

InstanceReaperWorker.prototype._do = function(lock, message, payload, options, callback) {

  let request, signal

  const start = new Date(),
        cancel = () => {
          if (request) {
            request.cancel()
          }
        },
        onCancelMessage = () => {
          logger.info(`[instance-reaper] message cancel requested`)
          cancel()
        },
        onSignalReceived = (lock, sig) => {
          signal = sig
          logger.info(`[instance-reaper] lock signal received`)
          cancel()
        }

  message.once('cancel', onCancelMessage)
  lock.on('signal', onSignalReceived)

  modules.db.connection.db.collections((err, collections) => {

    if (err) {
      return callback(err)
    }

    const contextCollections = collections.filter(v => ['contexts', 'history', 'events', 'i18ns', 'i18n-bundles'].includes(v.collectionName) || v.collectionName.indexOf('contexts_') === 0 || v.collectionName.indexOf('ctx.') === 0),
          ooDataCollections = collections.filter(v => ['oo-data'].includes(v.collectionName))

    function wrap(callback, what) {
      const start = process.hrtime()
      return function(err, ...args) {
        const ms = utils.profile.end(start, what)
        logger.info(`[instance-reaper] ${what} took ${ms}ms`)
        request = null
        if (!err && (message.cancelled || signal)) {
          err = Fault.create('cortex.error.aborted', { reason: 'Signal received' })
        }
        callback(err, ...args)
      }
    }

    async.series(
      [
        // mark old exports as deleted
        callback => {
          request = this._expireExports(wrap(callback, 'expireExports'))
        },

        // mark old events as deleted
        callback => {
          request = this._expireEvents(wrap(callback, 'expireEvents'))
        },

        // mark old oos as deleted
        callback => {
          request = this._expireOos(wrap(callback, 'expireOos'))
        },

        // mark old uploads as deleted
        callback => {
          request = this._expireUploads(wrap(callback, 'expireUploads'))
        },

        // mark old ephemeral org as deleted
        callback => {
          request = this._expireEphemeralOrgs(wrap(callback, 'expireEphemeralOrgs'))
        },

        // reap built-in objects
        callback => {
          request = this._reapBuiltInObjects(contextCollections, wrap(callback, 'reapBuiltInObjects'))
        },

        // reap deleted objects
        callback => {
          request = this._reapObjects(contextCollections, wrap(callback, 'reapObjects'))
        },

        // take a break
        callback => {
          request = this._reapObjectTypes(contextCollections, wrap(callback, 'reapObjectTypes'))
        },

        // reap deleted object types
        callback => {
          request = this._reapObjectTypes(contextCollections, wrap(callback, 'reapObjectTypes'))
        },

        // reap oos
        callback => {
          request = this._reapOoDefinitions(ooDataCollections, wrap(callback, 'reapOOs'))
        },

        // reap oos
        callback => {
          request = this._reapOoInstances(ooDataCollections, wrap(callback, 'reapOoInstances'))
        },
        // reap deleted post types
        callback => {
          request = this._reapPostTypes(wrap(callback, 'reapPostTypes'))
        },

        // reap deleted instances
        callback => {
          request = this._reapObjectInstances(contextCollections, wrap(callback, 'reapObjectInstances'))
        },

        // reap deleted posts and comments
        callback => {
          request = this._reapPostsAndComments(wrap(callback, 'reapPostsAndComments'))
        },

        // reap ephemeral orgs
        callback => {
          request = this._reapEphemeralOrgs(wrap(callback, 'reapEphemeralOrgs'))
        },

        // maintain the lock once more in case a restart was requested
        callback => {
          lock.maintain(callback)
        }

      ],
      err => {

        message.removeListener('cancel', onCancelMessage)
        lock.removeListener('signal', onSignalReceived)

        if (message.cancelled) {
          err = Fault.create('cortex.error.aborted')
        } else if (signal) {
          switch (signal) {
            case consts.Transactions.Signals.Restart:
              return setImmediate(() => this._do(lock, message, payload, options, callback))
            case consts.Transactions.Signals.Error:
              err = (lock && lock.getLastError()) || Fault.create('cortex.error.unspecified', { reason: 'unspecified error signal received.' })
              break
            case consts.Transactions.Signals.Shutdown:
              err = Fault.create('cortex.error.aborted', { reason: 'Shutdown signal received.' })
              break
            case consts.Transactions.Signals.Cancel:
            default:
              break
          }
        }

        lock.complete(() => {
          if (err) {
            const logged = Fault.from(err, null, true)
            logged.trace = logged.trace || 'Error\n\tnative instance-reaper:0'
            logger.error('[instance-reaper]', Object.assign(utils.toJSON(err, { stack: true }), { doc: message.doc }))
            modules.db.models.Org.loadOrg('medable', function(err, org) {
              if (!err) {
                modules.db.models.Log.logApiErr(
                  'api',
                  logged,
                  new acl.AccessContext(
                    ap.synthesizeAnonymous(org),
                    null,
                    { req: message.req })
                )
              }
            })
          } else {
            logger.info('[instance-reaper] ran in ' + (Date.now() - start) + 'ms')
          }
          callback(err)
        })

      }

    )
  })

}

InstanceReaperWorker.prototype._expireExports = function(callback) {

  const request = {
    cancel: () => {
      this.cancelled = true
    }
  }

  modules.db.models.Export.collection.updateMany({ object: 'export', reap: false, expiresAt: { $lte: new Date() } }, { $set: { reap: true } }, err => {
    callback(err)
  })

  return request

}

InstanceReaperWorker.prototype._expireEvents = function(callback) {

  const request = {
    cancel: () => {
      this.cancelled = true
    }
  }

  modules.db.models.Event.collection.updateMany({ object: 'event', reap: false, expiresAt: { $lte: new Date() } }, { $set: { reap: true }, $unset: { key: 1 } }, err => {
    callback(err)
  })

  return request

}

InstanceReaperWorker.prototype._expireOos = function(callback) {

  const request = {
    cancel: () => {
      this.cancelled = true
    }
  }

  modules.db.models.OO.collection.updateMany({ object: 'oo', reap: false, expiresAt: { $lte: new Date() } }, { $set: { reap: true } }, err => {
    callback(err)
  })

  return request

}

InstanceReaperWorker.prototype._expireUploads = function(callback) {

  const request = {
    cancel: () => {
      this.cancelled = true
    }
  }

  modules.db.models.Upload.collection.updateMany({ object: 'upload', reap: false, expiresAt: { $lte: new Date() } }, { $set: { reap: true } }, err => {
    callback(err)
  })

  return request

}

InstanceReaperWorker.prototype._expireEphemeralOrgs = function(callback) {

  const request = {
    cancel: () => {
      this.cancelled = true
    }
  }

  modules.db.models.Org.collection.updateMany({
    object: 'org',
    reap: false,
    'configuration.ephemeral': true,
    'configuration.ephemeralExpireAt': { $lte: new Date() }
  }, { $set: { reap: true } }, err => {
    callback(err)
  })

  return request

}

InstanceReaperWorker.prototype._reapBuiltInObjects = function(contextCollections, callback) {

  const request = {
          cancel: () => {
            this.cancelled = true
          }
        },
        Model = modules.db.models.Object

  async.waterfall([

    // find all reaped objects, grouped by org. (exclude built-ins as a safety!)
    callback =>

      Model.collection.aggregate(
        [{
          $match: {
            reap: true,
            'dataset.targetCollection': { $exists: false },
            name: { $in: Object.keys(modules.db.definitions.builtInObjectDefsMap) }
          }
        }, {
          $group: {
            _id: '$org',
            objects: { $addToSet: '$name' },
            lookups: { $addToSet: '$lookup' }
          }
        }],
        { cursor: {} })
        .toArray((err, results) => callback(err, results)
        ),

    // for each one, ensure all instances, posts and comments are reaped, and all callbacks, connections and notifications are deleted, then delete the objects
    (results, callback) => {

      if (request.cancelled) {
        return callback(Fault.create('cortex.error.aborted'))
      }

      if (results.length === 0) {
        return callback()
      }

      async.series([

        callback =>

          modules.db.models.object.collection.deleteMany({ $or: results.map(result => ({ org: result._id, lookup: { $in: result.lookups } })) }, callback),

        // clean up number increment property counters.
        callback => {
          async.each(
            results.reduce((keys, result) => {
              return result.objects.reduce((keys, object) => {
                return [...keys, `number.increment.${result._id}.${object}#`, `number.increment.${result._id}.${object}.`]
              }, keys)
            }, []),
            (key, callback) => {
              modules.counters.clear(null, key, callback)
            },
            callback)
        }

      ], callback)

    }

  ], err => {
    callback(err)
  })

  return request

}

InstanceReaperWorker.prototype._reapObjects = function(contextCollections, callback) {

  const request = {
          cancel: () => {
            this.cancelled = true
          }
        },
        Model = modules.db.models.Object

  async.waterfall([

    // find all reaped objects, grouped by org. (exclude built-ins as a safety!)
    callback =>

      Model.collection.aggregate(
        [{
          $match: {
            reap: true,
            'dataset.targetCollection': { $exists: false },
            name: { $nin: Object.keys(modules.db.definitions.builtInObjectDefsMap) }
          }
        }, {
          $group: {
            _id: '$org',
            objects: { $addToSet: '$name' },
            lookups: { $addToSet: '$lookup' }
          }
        }],
        { cursor: {} })
        .toArray((err, results) => callback(err, results)
        ),

    // for each one, ensure all instances, posts and comments are reaped, and all callbacks, connections and notifications are deleted, then delete the objects
    (results, callback) => {

      if (request.cancelled) {
        return callback(Fault.create('cortex.error.aborted'))
      }

      if (results.length === 0) {
        return callback()
      }

      async.series([

        callback =>

          async.parallel([

            callback => {
              async.each(
                contextCollections,
                (collection, callback) => {
                  collection.updateMany({ $or: results.map(result => ({ org: result._id, object: { $in: result.objects }, reap: false })) }, { $set: { reap: true } }, callback)
                },
                callback
              )
            },
            callback => modules.db.models.post.collection.updateMany({ $or: results.map(result => ({ org: result._id, $or: [{ 'context.object': { $in: result.objects } }, { 'pcontext.object': { $in: result.objects } }], reap: false })) }, { $set: { reap: true } }, callback),
            callback => modules.db.models.connection.collection.deleteMany({ $or: results.map(result => ({ org: result._id, 'context.object': { $in: result.objects } })) }, callback),
            callback => modules.db.models.notification.collection.deleteMany({ $or: results.map(result => ({ org: result._id, 'context.object': { $in: result.objects } })) }, callback),
            callback => modules.db.models.callback.collection.deleteMany({ $or: results.map(result => ({ org: result._id, 'context.object': { $in: result.objects } })) }, callback)
          ], callback),

        callback =>
          modules.db.models.object.collection.deleteMany({ $or: results.map(result => ({ org: result._id, lookup: { $in: result.lookups } })) }, callback),

        // clean up number increment property counters.
        callback => {
          async.each(
            results.reduce((keys, result) => {
              return result.objects.reduce((keys, object) => {
                return [...keys, `number.increment.${result._id}.${object}#`, `number.increment.${result._id}.${object}.`]
              }, keys)
            }, []),
            (key, callback) => {
              modules.counters.clear(null, key, callback)
            },
            callback)
        }

      ], callback)

    }

  ], err => {
    callback(err)
  })

  return request

}

InstanceReaperWorker.prototype._reapOoDefinitions = function(ooDataCollections, callback) {

  const request = {
          cancel: () => {
            this.cancelled = true
          }
        },
        Model = modules.db.models.OO

  async.waterfall([

    // find all reaped objects, grouped by org. (exclude built-ins as a safety!)
    callback =>

      Model.collection.aggregate(
        [{
          $match: {
            reap: true
          }
        }, {
          $group: {
            _id: '$org',
            objects: { $addToSet: '$name' },
            _ids: { $addToSet: '$_id' }
          }
        }],
        { cursor: {} })
        .toArray((err, results) => callback(err, results)
        ),

    // for each one, ensure all instances are reaped, then delete the objects
    (results, callback) => {

      if (request.cancelled) {
        return callback(Fault.create('cortex.error.aborted'))
      }

      if (results.length === 0) {
        return callback()
      }

      async.series([

        callback =>

          async.parallel([

            callback => {
              async.each(
                ooDataCollections,
                (collection, callback) => {
                  collection.updateMany({ $or: results.map(result => ({ org: result._id, object: { $in: result.objects }, reap: false })) }, { $set: { reap: true } }, callback)
                },
                callback
              )
            }

          ], callback),

        callback =>
          Model.collection.deleteMany({ $or: results.map(result => ({ org: result._id, _id: { $in: result._ids } })) }, callback),

        // clean up number increment property counters.
        callback => {
          async.each(
            results.reduce((keys, result) => {
              return result.objects.reduce((keys, object) => {
                return [...keys, `number.increment.${result._id}.${object}#`, `number.increment.${result._id}.${object}.`]
              }, keys)
            }, []),
            (key, callback) => {
              modules.counters.clear(null, key, callback)
            },
            callback)
        }

      ], callback)

    }

  ], err => {
    callback(err)
  })

  return request

}

InstanceReaperWorker.prototype._reapObjectTypes = function(contextCollections, callback) {

  const request = {
          cancel: () => {
            this.cancelled = true
          }
        },
        Model = modules.db.models.Object

  async.waterfall([

    // find all reaped objects, grouped by org.
    callback =>

      Model.collection.aggregate(
        [{
          $match: {
            reap: false,
            'dataset.targetCollection': { $exists: false }
          }
        }, {
          $unwind: '$deletedTypes'
        }, {
          $project: {
            org: 1,
            objectName: '$name',
            lookup: '$lookup',
            typeId: '$deletedTypes._id',
            typeName: '$deletedTypes.name'
          }
        }, {
          $group: {
            _id: {
              org: '$org',
              objectName: '$objectName',
              lookup: '$lookup'
            },
            typeIds: { $addToSet: '$typeId' },
            typeNames: { $addToSet: '$typeName' }

          }
        }],
        { cursor: {} })
        .toArray((err, results) => callback(err, results)),

    // reap all instances of the deleted types.
    (results, callback) => {

      if (results.length === 0) {
        return callback()
      }

      async.eachSeries(results, (result, callback) => {

        if (request.cancelled) {
          return callback(Fault.create('cortex.error.aborted'))
        }

        async.series([

          // everything assigned this type must be reaped. we don't know enough to reap posts, comments, or others, so that has to wait until the instance reap stage.
          callback => {

            async.each(
              contextCollections,
              (collection, callback) => {
                collection.updateMany({ org: result._id.org, object: result._id.objectName, reap: false, type: { $in: result.typeNames } }, { $set: { reap: true } }, callback)
              },
              callback
            )

          },

          // pull the deleted types out of the deleted types array, freeing up the type name for use. this must be done using sequencing!
          callback =>

            modules.db.sequencedFunction(
              function(callback) {
                modules.db.models.object.findOne({ org: result._id.org, lookup: result._id.lookup, reap: false }).select('sequence').lean().exec((err, object) => {
                  if (err || !object) return callback(err)
                  modules.db.models.object.collection.updateOne(
                    { org: result._id.org, lookup: result._id.lookup, reap: false, sequence: object.sequence },
                    { $inc: { sequence: 1 }, $pull: { deletedTypes: { _id: { $in: result.typeIds } } } },
                    (err, result) => {
                      if (!err && result.matchedCount === 0) {
                        err = Fault.create('cortex.conflict.sequencing', { reason: '[instance-reaper] pulling deleted types' })
                      }
                      callback(err)
                    }
                  )
                })
              },
              10,
              callback
            )

        ], callback)

      }, callback)

    }

  ], err => {
    callback(err)
  })

  return request

}

InstanceReaperWorker.prototype._reapPostTypes = function(callback) {

  const request = {
          cancel: () => {
            this.cancelled = true
          }
        },

        Model = modules.db.models.Object, Post = modules.db.models.Post

  async.waterfall([

    // find all reaped post types
    callback =>

      Model.collection.aggregate(
        [{
          $match: {
            reap: false
          }
        }, {
          $unwind: '$deletedFeeds'
        }, {
          $project: {
            org: 1,
            objectName: '$lookup',
            lookup: '$lookup',
            typeId: '$deletedFeeds._id',
            typeName: '$deletedFeeds.name'
          }
        }, {
          $group: {
            _id: {
              org: '$org',
              objectName: '$objectName',
              lookup: '$lookup'
            },
            typeIds: { $addToSet: '$typeId' },
            typeNames: { $addToSet: '$typeName' }
          }
        }],
        { cursor: {} }
      ).toArray((err, results) => callback(err, results)
      ),

    // reap all instances of the deleted types.
    (results, callback) => {

      if (results.length === 0) {
        return callback()
      }

      async.eachSeries(results, (result, callback) => {

        if (request.cancelled) {
          return callback(Fault.create('cortex.error.aborted'))
        }

        async.series([

          // everything assigned this type must be reaped.
          callback =>

            Post.collection.updateMany({ org: result._id.org, reap: false, $or: [{ 'context.object': result.objectName }, { 'pcontext.object': result.objectName }], type: { $in: result.typeNames } }, { $set: { reap: true } }, callback),

          // pull the deleted feeds out of the deleted feeds array, freeing up the post type name for use. this must be done using sequencing!
          callback =>

            modules.db.sequencedFunction(
              function(callback) {
                modules.db.models.object.findOne({ org: result._id.org, lookup: result._id.lookup, reap: false }).select('sequence').lean().exec((err, object) => {
                  if (err || !object) return callback(err)
                  modules.db.models.object.collection.updateOne(
                    { org: result._id.org, lookup: result._id.lookup, reap: false, sequence: object.sequence },
                    { $inc: { sequence: 1 }, $pull: { deletedFeeds: { _id: { $in: result.typeIds } } } },
                    (err, result) => {
                      if (!err && result.matchedCount === 0) {
                        err = Fault.create('cortex.conflict.sequencing', { reason: '[instance-reaper] pulling deleted feeds' })
                      }
                      callback(err)
                    }
                  )
                })
              },
              10,
              callback
            )

        ], callback)

      }, callback)

    }

  ], err => {
    callback(err)
  })

  return request

}

InstanceReaperWorker.prototype._reapOoInstances = function(ooCollections, callback) {

  let exportDeleteRequest

  const request = {
    cancel: () => {
      this.cancelled = true
      if (exportDeleteRequest) {
        exportDeleteRequest.cancel()
      }
    }
  }

  async.eachSeries(

    ooCollections,

    (collection, callback) => {

      const max = 1000

      let ops = 0

      async.doWhilst(

        callback => {

          if (request.cancelled) {
            return callback(Fault.create('cortex.error.aborted'))
          }

          collection.find({ reap: true }).project({ _id: 1, org: 1, object: 1, type: 1, reap: 1, stats: 1, 'meta.sz': 1 }).limit(max).toArray((err, docs) => {

            ops = err ? 0 : docs.length

            if (err || docs.length === 0) {
              return callback(err)
            }

            const statsGroup = new StatsGroup(),
                  $in = []

            docs.forEach(doc => {
              statsGroup.removeDoc(doc)
              $in.push(doc._id)
            })
            collection.deleteMany({ _id: { $in } }, err => {
              if (!err) {
                statsGroup.save()
              }
              callback(err)
            })
          })
        },

        () => {
          return ops > 0
        },

        callback
      )

    },

    callback
  )

  return request
}

InstanceReaperWorker.prototype._reapObjectInstances = function(contextCollections, callback) {

  let exportDeleteRequest

  const request = {
    cancel: () => {
      this.cancelled = true
      if (exportDeleteRequest) {
        exportDeleteRequest.cancel()
      }
    }
  }

  async.eachSeries(

    contextCollections,

    (collection, callback) => {

      const max = 1000

      let ops = 0

      async.doWhilst(

        callback => {

          if (request.cancelled) {
            return callback(Fault.create('cortex.error.aborted'))
          }

          collection.find({ $or: [{ reap: true }, { 'facets._kl': true }] }).project({ _id: 1, org: 1, object: 1, type: 1, reap: 1, 'configuration.ephemeral': 1, facets: 1, stats: 1, 'meta.sz': 1, zipFiles: 1, location: 1, storageId: 1 }).limit(max).toArray((err, docs) => {

            if (err) {
              return callback(err)
            }

            const statsGroup = new StatsGroup(), reapedAccounts = [], reapedAwsKeys = [], facetsPullOps = [], exportDeletes = []
            let reapedEphOrgIds = [], reapedDocIds = []
            ops = 0

            docs.forEach(doc => {

              let deletedFacets

              if (doc.reap) {
                ops++

                statsGroup.removeDoc(doc)

                reapedDocIds.push(doc._id)

                if (doc.object === 'org' && utils.path(doc, 'configuration.ephemeral')) {
                  reapedEphOrgIds.push(doc._id)
                }
                if (doc.object === 'account') {
                  reapedAccounts.push(doc._id)
                }

                if (doc.object === 'export') {

                  const locationType = doc.location || consts.LocationTypes.AwsS3,
                        storageId = doc.storageId || consts.storage.availableLocationTypes.medable

                  exportDeletes.push({ storageId, orgId: doc.org, exportPrefix: `exports/${doc._id}/` })

                  // cleanup possible intermediary files
                  if (storageId !== 'medable') {
                    exportDeletes.push({ storageId: 'medable', orgId: doc.org, exportPrefix: `exports/${doc._id}/` })
                  }

                  if (modules.storage.isInternalStorage(locationType, storageId)) {

                    // note physically exported files (deleted as batch deleteDir later on using exportDeletes )
                    if (!doc.zipFiles && (doc.stats.files.count || doc.stats.files.size)) {
                      statsGroup.removeFile(doc.org, doc.object, doc.stats.files.count, doc.stats.files.size)
                    }

                  }

                } else {

                  deletedFacets = utils.array(doc.facets) // attempt to delete all facets, regardless of state.
                }

                // record removal of all ready facets when directly reaping. otherwise, wait until we've
                // successfully removed facets with sequenced writes.
                utils.array(doc.facets).forEach(facet => {
                  if (facet.state === consts.media.states.ready) {
                    // only count internal facet locations, which are always integer consts
                    if (storage.isInternallyStoredFacet(facet)) {
                      statsGroup.removeFacet(doc, facet)
                    }
                  }
                })

              } else {

                deletedFacets = utils.array(doc.facets).filter(facet => facet._kl)
              }

              // prep for removal from aws
              utils.array(deletedFacets).forEach(facet => {
                if (storage.isInternallyStoredFacet(facet)) {
                  const awsKey = getAwsKey(facet)
                  if (awsKey) {
                    reapedAwsKeys.push({ Key: awsKey, facet })
                  }
                }
              })

              // prep atomic facets index updates. if the entire doc is reaped, we don't need to pull the facet(s).
              if (!doc.reap && deletedFacets.length > 0) {
                const deletedFacetIds = deletedFacets.map(v => v.pid).filter(v => !!v)
                if (deletedFacetIds.length > 0) {
                  ops++
                  facetsPullOps.push({
                    doc: doc,
                    facets_ids: deletedFacetIds,
                    counted_ready_facets: deletedFacets.filter(v => storage.isInternallyStoredFacet(v) && v.state === consts.media.states.ready) // need these to record storage removal operation
                  })
                }
              }

            })

            async.series([

              // attempt to erase media from aws
              callback => {

                if (reapedAwsKeys.length === 0) {
                  return callback(err)
                }

                const maxAwsKeys = 1000, chunks = reapedAwsKeys.reduce(function(res, item, index) {
                  if (index % maxAwsKeys === 0) { res.push([]) }
                  res[res.length - 1].push(item)
                  return res
                }, [])

                // if there are any individual failures, we'll let infrequent maintenance routines pick them up later
                async.eachSeries(
                  chunks,
                  (chunk, callback) => {

                    if (request.cancelled) {
                      return callback(Fault.create('cortex.error.aborted'))
                    }
                    const internalPrivateChunks = chunk.filter(c => c.facet.storageId === consts.storage.availableLocationTypes.medable).map(k => ({ Key: k.Key })),
                          internalPublicChunks = chunk.filter(c => c.facet.storageId === consts.storage.availableLocationTypes.public).map(k => ({ Key: k.Key })),
                          promises = []

                    if (internalPrivateChunks.length > 0) {
                      promises.push(promised(modules.aws.getInternalStorageInstance(), 'deleteObjects', {
                        Delete: {
                          Quiet: true,
                          Objects: internalPrivateChunks
                        }
                      }))
                    }
                    if (internalPublicChunks.length > 0) {
                      promises.push(promised(modules.aws.getInternalPublicInstance(), 'deleteObjects', {
                        Delete: {
                          Quiet: true,
                          Objects: internalPublicChunks
                        }
                      }))
                    }
                    if (promises.length) {
                      return Promise.all(promises).then(() => callback()).catch(e => callback(e))
                    }
                    callback()
                  },
                  callback
                )

              },

              // erase exports recursively
              callback => {

                async.eachSeries(exportDeletes, (entry, callback) => {

                  if (request.cancelled) {
                    return callback(Fault.create('cortex.error.aborted'))
                  }

                  callback = _.once(callback)

                  modules.aws.getLocation(entry.orgId, consts.LocationTypes.AwsS3, entry.storageId, (err, location) => {

                    if (err) {
                      logger.error(`[instance-reaper] error deleting export media from location ${entry.storageId} in org ${entry.orgId} (1)`, utils.toJSON(err, { stack: true }))
                      callback()
                    } else if (!location.managed) {
                      callback()
                    } else {
                      exportDeleteRequest = location.deleteDir(entry.exportPrefix, (err, result) => {
                        exportDeleteRequest = null
                        if (err) {
                          if (err.errCode !== 'cortex.error.aborted') {
                            logger.error(`[instance-reaper] error deleting export media from location ${entry.storageId} in org ${entry.orgId} (2)`, utils.toJSON(err, { stack: true }))
                          }
                        } else {
                          logger.silly(`[instance-reaper] deleted ${result.deletedCount} files prefix ${location.buildKey(entry.exportPrefix)} in location ${entry.storageId} `)
                        }
                        callback()
                      })
                    }
                  })

                }, callback)

              },

              // pull facets one by one using sequencing. this sucks a little, so we should revamp the nonAtomicPush situation for the facetsIndex
              callback => {
                async.eachLimit(facetsPullOps, 20, (pullOp, callback) => {

                  if (request.cancelled) {
                    return callback(Fault.create('cortex.error.aborted'))
                  }
                  modules.db.sequencedFunction(
                    function(callback) {
                      collection.find({ _id: pullOp.doc._id, reap: false }).limit(1).project({ org: 1, object: 1, type: 1, sequence: 1, pcontext: 1, context: 1 }).toArray((err, docs) => {
                        const doc = docs && docs[0]
                        if (err || !doc) return callback(err)
                        collection.updateOne(
                          { _id: pullOp.doc._id, reap: false, sequence: doc.sequence },
                          { $inc: { sequence: 1 }, $pull: { facets: { pid: { $in: pullOp.facets_ids } } } },
                          (err, result) => {
                            if (!err && result.matchedCount === 0) {
                              err = Fault.create('cortex.conflict.sequencing', { reason: '[instance-reaper] pulling deleted instance facets' })
                            }
                            if (!err) {
                              for (const facet of pullOp.counted_ready_facets) {
                                statsGroup.removeFacet(doc, facet)
                              }
                            }
                            callback(err)
                          }
                        )
                      })
                    },
                    10,
                    callback
                  )
                }, callback)
              },

              // set posts and comments to be reaped, and remove connections, notifications and callbacks. then, remove reaped docs
              callback => {
                reapedDocIds = _.difference(reapedDocIds, reapedEphOrgIds)
                if (reapedDocIds.length === 0) {
                  if (reapedEphOrgIds.length) {
                    ops = 0
                  }
                  return callback()
                }
                if (request.cancelled) {
                  return callback(Fault.create('cortex.error.aborted'))
                }
                async.series([
                  callback =>
                    async.parallel([
                      callback => modules.db.models.post.collection.updateMany({ $or: [{ 'context._id': { $in: reapedDocIds } }, { 'pcontext._id': { $in: reapedDocIds } }], reap: false }, { $set: { reap: true } }, callback),
                      callback => modules.db.models.history.collection.updateMany({ org: { $exists: true }, object: 'history', type: null, 'context._id': { $in: reapedDocIds }, reap: false }, { $set: { reap: true } }, callback),
                      callback => modules.db.models.connection.collection.deleteMany({ org: { $exists: true }, 'context.object': { $exists: true }, 'context._id': { $in: reapedDocIds } }, callback),
                      callback => modules.db.models.notification.collection.deleteMany({ 'context._id': { $in: reapedDocIds } }, callback),
                      callback => modules.db.models.callback.collection.deleteMany({ 'context._id': { $in: reapedDocIds } }, callback),
                      callback => {
                        if (reapedAccounts.length === 0) {
                          return callback()
                        }
                        modules.db.models.location.collection.deleteMany({ 'accountId': { $in: reapedAccounts } }, callback)
                      }
                    ], callback),

                  callback =>
                    collection.deleteMany({ _id: { $in: reapedDocIds } }, err => {
                      if (!err) {
                        statsGroup.save()
                      }
                      callback(err)
                    })

                ], callback)
              }

            ], callback)

          })

        },

        () => {
          return ops > 0
        },

        callback
      )

    },

    callback
  )

  return request
}

InstanceReaperWorker.prototype._reapPostsAndComments = function(callback) {

  const request = {
          cancel: () => {
            this.cancelled = true
          }
        },

        Posts = modules.db.models.Post

  async.series([

    // ensure all reaped posts' comments are marked for reaping
    callback => {

      const max = 1000
      let find = { object: 'post', reap: true }, hasMore = true

      async.whilst(
        () => {
          return hasMore
        },
        callback => {
          if (request.cancelled) {
            return callback(Fault.create('cortex.error.aborted'))
          }
          Posts.find(find).select('_id').sort({ _id: 1 }).lean().limit(max).exec((err, docs) => {
            hasMore = docs && docs.length > 0
            if (err || !hasMore) {
              return callback(err)
            }
            find._id = { $gt: _.last(docs)._id }
            Posts.collection.updateMany({ object: 'comment', reap: false, 'context._id': { $in: docs.map(v => v._id) } }, { $set: { reap: true } }, callback)
          })
        },

        callback
      )

    },

    // reap posts and comments
    callback => {

      const max = 1000

      let ops = 0

      async.doWhilst(

        callback => {

          if (request.cancelled) {
            return callback(Fault.create('cortex.error.aborted'))
          }

          // search and select only the old path.
          Posts.find({ $or: [{ reap: true }, { 'facets._kl': true }] }).select('_id org reap object type pcontext context facets meta.sz sequence').lean().limit(max).exec((err, docs) => {

            if (err) {
              return callback(err)
            }

            const statsGroup = new StatsGroup(), reapedDocIds = [], reapedAwsKeys = [], facetsPullOps = []

            ops = 0

            docs.forEach(doc => {

              let deletedFacets

              if (doc.reap) {
                ops++
                statsGroup.removeDoc(doc)
                reapedDocIds.push(doc._id)
                deletedFacets = utils.array(doc.facets)

                // record removal of all ready facets when directly reaping. otherwise, wait until we've
                // successfully removed facets with sequenced writes.
                utils.array(doc.facets).forEach(facet => {
                  if (facet.state === consts.media.states.ready) {
                    if (storage.isInternallyStoredFacet(facet)) {
                      statsGroup.removeFacet(doc, facet)
                    }
                  }
                })

              } else {
                deletedFacets = utils.array(doc.facets).filter(facet => facet._kl)
              }

              // prep for removal from aws
              utils.array(deletedFacets).forEach(facet => {
                if (storage.isInternallyStoredFacet(facet)) {
                  const awsKey = getAwsKey(facet)
                  if (awsKey) {
                    reapedAwsKeys.push({ Key: awsKey })
                  }
                }
              })

              // prep atomic facets index updates. if the entire doc is reaped, we don't need to pull the facet(s).
              if (!doc.reap && deletedFacets.length > 0) {
                const deletedFacetIds = deletedFacets.map(v => v.pid).filter(v => !!v)
                if (deletedFacetIds.length > 0) {
                  ops++
                  facetsPullOps.push({
                    doc: doc,
                    facets_ids: deletedFacetIds,
                    counted_ready_facets: deletedFacets.filter(v => storage.isInternallyStoredFacet(v) && v.state === consts.media.states.ready) // need these to record storage removal operation
                  })
                }
              }

            })

            async.series([

              // attempt to erase media from aws
              callback => {

                if (reapedAwsKeys.length === 0) {
                  return callback(err)
                }

                const maxAwsKeys = 1000, chunks = reapedAwsKeys.reduce(function(res, item, index) {
                  if (index % maxAwsKeys === 0) { res.push([]) }
                  res[res.length - 1].push(item)
                  return res
                }, [])

                // if there are any individual failures, we'll let infrequent maintenance routines pick them up later
                async.eachSeries(
                  chunks,
                  (chunk, callback) => {
                    if (request.cancelled) {
                      return callback(Fault.create('cortex.error.aborted'))
                    }
                    modules.aws.getInternalStorageInstance().deleteObjects({ Delete: { Quiet: true, Objects: chunk } }, callback)
                  },
                  callback
                )

              },

              // pull facets one by one using sequencing. this sucks a little, so we should revamp the nonAtomicPush situation for the facetsIndex
              callback => {
                async.eachLimit(facetsPullOps, 20, (pullOp, callback) => {
                  if (request.cancelled) {
                    return callback(Fault.create('cortex.error.aborted'))
                  }
                  modules.db.sequencedFunction(
                    function(callback) {
                      Posts.findOne({ _id: pullOp.doc._id, reap: false }).select('_id org reap object type pcontext context sequence').lean().exec((err, doc) => {
                        if (err || !doc) return callback(err)
                        Posts.collection.updateOne(
                          { _id: pullOp.doc._id, reap: false, sequence: doc.sequence },
                          { $inc: { sequence: 1 }, $pull: { facets: { pid: { $in: pullOp.facets_ids } } } },
                          (err, result) => {
                            if (!err && result.matchedCount === 0) {
                              err = Fault.create('cortex.conflict.sequencing', { reason: '[instance-reaper] pulling deleted post facets' })
                            }
                            if (!err) {
                              for (const facet of pullOp.counted_ready_facets) {
                                statsGroup.removeFacet(doc, facet)
                              }
                            }
                            callback(err)
                          }
                        )
                      })
                    },
                    10,
                    callback
                  )
                }, callback)
              },

              callback => {
                if (reapedDocIds.length === 0) {
                  return callback()
                }
                Posts.collection.deleteMany({ _id: { $in: reapedDocIds } }, err => {
                  if (!err) {
                    statsGroup.save()
                  }
                  callback(err)
                })
              }

            ], callback)

          })

        },

        () => {
          return ops > 0
        },

        callback
      )

    }

  ], callback)

  return request
}

InstanceReaperWorker.prototype._reapEphemeralOrgs = function(callback) {

  const request = {
          cancel: () => {
            this.cancelled = true
          }
        },
        Model = modules.db.models.Org

  async.waterfall([

    // find all non reaped orgs that are expired
    callback =>

      // TODO: Add some indexes on ephemeral and ephemeralExpireAt or global ttl index?
      Model.collection.aggregate(
        [{
          $match: {
            reap: true,
            object: 'org',
            'configuration.ephemeral': true
          }
        }],
        { cursor: {} })
        .toArray((err, results) => callback(err, results)
        ),

    // for each one, ensure all instances are reaped, then delete the objects
    (results, callback) => {

      if (request.cancelled) {
        return callback(Fault.create('cortex.error.aborted'))
      }

      if (results.length === 0) {
        return callback()
      }

      // run hub teardown
      const series = []
      results.forEach((org) => {
        series.push((cb) => {
          modules.hub.teardownEnv(org.code, { reap: true }).then(r => cb(null, r)).catch(cb)
        })
      })
      async.series(series, (err) => {
        callback(err)
      })

    }

  ], err => {
    callback(err)
  })

  return request

}

module.exports = InstanceReaperWorker
