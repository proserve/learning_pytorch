'use strict'

const Worker = require('../worker'),
      util = require('util'),
      async = require('async'),
      logger = require('cortex-service/lib/logger'),
      _ = require('underscore'),
      utils = require('../../../utils'),
      modules = require('../../../modules'),
      acl = require('../../../acl'),
      consts = require('../../../consts'),
      Fault = require('cortex-service/lib/fault'),
      ap = require('../../../access-principal'),
      WorkerLock = modules.db.models.WorkerLock

// @todo: batch updates using sequencing.
// @todo: add status and api to see worker status.
// @todo: expose status to org jobs, tying them into worker locks. (they should be able to receive a signal)

function IndexerInstance(lock, message) {

  this._lock = lock
  this._signal = null
  this.message = message

  lock.on('signal', function(lock, signal) {
    this._signal = signal
  }.bind(this))

}

IndexerInstance.prototype.run = function(message, payload, callback) {

  var self = this, theOrg

  async.waterfall([

    function(callback) {

      modules.db.models.Org.createObject(payload.object, payload.org, function(err, { model, org }) {

        // find the slots via the setPath and setId, then collect the property paths for selection.
        if (err) {
          return callback(err)
        }

        theOrg = org

        var found, postType = null, isPost = false, isComment = false, len, feedDef

        if (payload.setPath === 'properties' && utils.equalIds(payload.setId, model.objectId)) {

          found = true

        } else {

          // post or comment property?
          len = model.feedDefinition.length

          while (len-- && !found) {

            feedDef = model.feedDefinition[len]
            if (utils.equalIds(payload.setId, feedDef.postTypeId)) {
              postType = feedDef.postType
              if (payload.setPath === 'feedDefinition.body.properties') {
                found = true
                isPost = true
              } else if (payload.setPath === 'feedDefinition.comments.properties') {
                found = true
                isComment = true
              }
            }
          }

        }

        if (!found) {
          err = Fault.create('cortex.notFound.unspecified', { reason: 'could not find index slots in object: ' + payload.object, path: payload.object })
        }

        callback(err, org, model, isPost, isComment, postType)
      })
    },

    function(org, object, isPost, isComment, postType, callback) {

      let principal = ap.synthesizeOrgAdmin(org),
          limit = 1000,
          Post = (isComment || isPost) ? object.getPostModel(postType) : null,
          Comment = isComment ? Post.getCommentModel() : null,
          workingModel = (isComment ? Comment : (isPost ? Post : object)),
          lastId = null,
          find = (isPost || isComment) ? { org: org._id, object: isPost ? 'post' : 'comment', type: postType, reap: false } : { org: org._id, object: object.objectName, reap: false },
          propertyPaths = [],
          properties = [],
          property,
          root = workingModel.schema.node,
          slots = root.slots,
          len = slots.length,
          slot,
          select

      while (len--) {
        slot = slots[len]
        property = root.findNodeById(slot._id)
        if (property) {
          propertyPaths.push(property.fullpath)
          properties.push(property)
        }
      }

      select = workingModel.schema.node.selectPaths(principal, { paths: [...propertyPaths, ...workingModel.requiredAclPaths] })

      async.doWhilst(function(callback) {

        if (message.cancelled) {
          return callback(Fault.create('cortex.error.aborted'))
        }

        if (lastId) {
          find._id = { $gt: lastId }
        }

        workingModel.find(find).select('_id').sort({ _id: 1 }).limit(limit).lean().exec(function(err, docs) {

          if (err) {
            return callback(err)
          }

          lastId = docs.length > 0 ? docs[docs.length - 1]._id : null

          if (docs.length === 0) {
            return callback()
          }

          async.eachLimit(docs, 100, function(doc, callback) {

            if (message.cancelled) {
              return callback(Fault.create('cortex.error.aborted'))
            }

            if (self._signal) {
              const signal = self._signal
              self._signal = null
              switch (signal) {
                case consts.Transactions.Signals.Error:
                  let signalError
                  callback(self._lock && (signalError = self._lock.getLastError()) ? signalError : Fault.create('cortex.error.unspecified', { reason: 'unspecified error signal received.' }))
                  break
                case consts.Transactions.Signals.Restart:
                  callback('kRestart') // eslint-disable-line standard/no-callback-literal
                  break
                case consts.Transactions.Signals.Cancel:
                  callback('kDone') // eslint-disable-line standard/no-callback-literal
                  break
                case consts.Transactions.Signals.Shutdown:
                  callback(Fault.create('cortex.error.aborted', { reason: 'Shutdown signal received.' }))
                  break
              }
              return
            }

            modules.db.sequencedFunction(function(callback) {

              var find = { _id: doc._id, reap: false },
                  ac = new acl.AccessContext(principal, null, { req: self.message.req })

              workingModel.findOne(find).select(select).lean().exec(function(err, raw) {

                if (err || !raw) {
                  return callback(err)
                }

                // ensure that ONLY the sequence and idx may be updated.
                const TypedModel = workingModel.getModelForType(raw.type),
                      doc = new TypedModel(undefined, { _id: true, sequence: true, idx: true }, true)

                doc.init(raw)
                modules.db.definitions.prepIndex(doc)

                properties.forEach(function(property) {
                  try {
                    property._rebuildPropertyIndex(doc)
                  } catch (err) {
                    // an error in the internals. this items cannot be updated. most likely a unique duplicate.
                    // this shouldn't occur here, as we have made unique a creatable-only property.
                  }
                })

                ac.lowLevelUpdate({ subject: doc }, function(err) {
                  if (err && err.errCode !== 'cortex.conflict.sequencing') {
                    err = null
                  }
                  callback(err)
                })

              })

            }, 10, function(err) {

              if (err) {
                logger.error('indexing error', utils.toJSON(err))
              }

              // handle other errors. don't kill the whole indexer over a single error.
              callback()

            })

          }, function(err) {
            callback(err) // next batch.
          })

        })

      }, function() {

        return !!lastId

      }, callback)

    }

  ], function(err) {

    // restarting?
    if (err === 'kRestart') {
      return self.run(message, payload, callback)
    }

    // short-circuit sans error?
    if (err === 'kDone') {
      err = null
    }

    if (err) {
      logger.error('indexer', { err: err.toJSON(), org: payload.org, object: payload.object, property: payload.property })
      if (theOrg) {
        const logged = Fault.from(err, null, true)
        logged.trace = logged.trace || 'Error\n\tnative indexer:0'
        var principal = ap.synthesizeAnonymous(theOrg)
        modules.db.models.Log.logApiErr(
          'api',
          logged,
          new acl.AccessContext(principal, null, { req: message.req })
        )
      }
    }
    theOrg = null

    // calling back with an error leaves the index job on the queue.
    if (!self._lock) {
      return callback(err)
    }
    if (self._lock) {
      const lock = self._lock
      delete self._lock
      lock.complete(function() {
        callback(err)
      })
    }

  })

}

// ------------------------------------------------------------

function IndexWorker() {
  Worker.call(this)
}

util.inherits(IndexWorker, Worker)

/**
 * @param message
 * @param payload
 *     org
 *     object
 *     property
 * @param options
 * @param callback
 * @private
 */
IndexWorker.prototype._process = function(message, payload, options, callback) {

  payload = payload || {}

  const objectLookup = utils.getIdOrNull(payload.object),
        setPath = payload.setPath,
        setId = utils.getIdOrNull(payload.setId),
        jobUpdateInterval = 1000,
        jobLockTimeout = 5000,
        uniqueIdentifier = ['IndexerWorker', objectLookup, setPath, setId].join('.')

  if (!objectLookup) {
    logger.error('invalid object lookup passed to indexer: ' + payload.object)
    return callback()
  }
  if (!setPath || !_.isString(setPath)) {
    logger.error('invalid object set path passed to indexer: ' + payload.setPath)
    return callback()
  }
  if (!setId) {
    logger.error('invalid object set id passed to indexer: ' + payload.setId)
    return callback()
  }

  payload.object = objectLookup
  payload.setPath = setPath
  payload.setId = setId

  // - check for cancellations or restarts whilst processing.
  // - transaction by property id and code consts.Transactions.Types.PropertyIndexer

  WorkerLock.createOrSignalRestart(uniqueIdentifier, { timeoutMs: jobLockTimeout, updateIntervalMs: jobUpdateInterval }, function(err, lock) {

    // err or could not get a lock.
    if (err || !lock) {
      return callback(err)
    }

    var instance = new IndexerInstance(lock, message)
    instance.run(message, payload, callback)

  })

}

module.exports = IndexWorker
