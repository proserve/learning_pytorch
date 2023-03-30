'use strict'

const Worker = require('../worker'),
      util = require('util'),
      async = require('async'),
      _ = require('underscore'),
      utils = require('../../../utils'),
      modules = require('../../../modules'),
      acl = require('../../../acl'),
      consts = require('../../../consts'),
      Fault = require('cortex-service/lib/fault'),
      ap = require('../../../access-principal'),
      WorkerLock = modules.db.models.WorkerLock

class HistoryProcessorInstance {

  constructor(lock) {

    this._lock = lock
    this._signal = null
    lock.on('signal', (lock, signal) => {
      this._signal = signal
    })
  }

  run(message, payload = {}, passes = 0, callback = () => {}) {

    const models = modules.db.models,
          HistoryModel = models.history,
          maxPasses = 5

    let updates = 0

    async.waterfall(
      [

        // gather all context collections
        // callback => {
        //
        //   models.object.collection.aggregate([{$match: {reap: false}}, {$group: {_id: '$dataset.collection'}}], {cursor: {}}).toArray((err, result) => {
        //     if (err) {
        //       return callback(err)
        //     }
        //     const names = result.map(v => v._id).filter(v => v)
        //     if (!names.includes('contexts')) {
        //       names.push('contexts')
        //     }
        //     async.map(names, (name, callback) => modules.db.connection.db.collection(name, (err, collection) => callback(err, collection)), callback)
        //   })
        // },
        callback => {

          modules.db.connection.db.collections((err, collections) => {
            if (err) {
              return callback(err)
            }
            const contextCollections = collections.filter(v => ['contexts', 'history'].includes(v.collectionName) || v.collectionName.indexOf('contexts_') === 0 || v.collectionName.indexOf('ctx.') === 0)
            callback(null, contextCollections)
          })
        },

        // move history entries
        (collections, callback) => {

          async.eachSeries(
            collections,
            (collection, callback) => {
              if (message.cancelled || this._signal) {
                return callback()
              }
              const cursor = collection.find({ 'meta.up': consts.metadata.updateBits.history, reap: false }).project({ _id: 1, org: 1, object: 1, sequence: 1, hist: 1, meta: 1 })
              async.during(
                callback => {
                  if (message.cancelled || this._signal) {
                    return callback(null, false)
                  }
                  cursor.hasNext((err, hasNext) => callback(err, hasNext))
                },

                callback => {

                  async.waterfall(
                    [
                      callback => cursor.next(callback),

                      (doc, callback) => models.org.loadOrg(doc.org, (err, org) => callback(err, org, doc)),

                      (org, doc, callback) => {

                        updates++

                        const entries = utils.array(doc.hist).map(entry => new HistoryModel(entry))
                        if (entries.length === 0) {
                          return callback(null, org, doc, [])
                        }

                        HistoryModel.aclCreateMany(ap.synthesizeAnonymous(org), entries, { scoped: false, forceAllowCreate: true, bypassCreateAcl: true, grant: acl.AccessLevels.Update }, (err, results) => {

                          // remove duplicates and newly inserted entries
                          const hist = doc.hist
                          if (!err && results) {
                            for (let i = hist.length - 1; i >= 0; i--) {
                              if (results.insertedIds.find(inserted => inserted.index === i) || results.writeErrors.find(err => err.index === i && err.code === 'kValidationError' && err.faults && err.faults[0] && err.faults[0].code === 'kDuplicateKey')) {
                                hist.splice(i, 1)
                              }
                            }
                          }
                          callback(null, org, doc, hist)
                        })

                      },

                      (org, doc, hist, callback) => {

                        // remove the history bits if we're done, and trigger a document size update as well
                        let metaBits = doc.meta.up, unset = hist.length === 0
                        if (unset) {
                          metaBits = metaBits.filter(v => v !== consts.metadata.updateBits.history)
                        } else if (!metaBits.includes(consts.metadata.updateBits.documentSize)) {
                          metaBits.push(consts.metadata.updateBits.documentSize)
                        }

                        const filter = {
                                _id: doc._id,
                                sequence: doc.sequence
                              },
                              update = {
                                $set: {
                                  'meta.up': metaBits
                                },
                                $inc: {
                                  sequence: 1
                                }
                              }

                        if (unset) {
                          update.$unset = { hist: 1 }
                        } else {
                          update.$set.hist = hist
                        }

                        collection.updateOne(filter, update, { writeConcern: { w: 'majority' } }, function(err, result) {
                          if (!err && result.matchedCount === 0) {
                            // Fault.create('cortex.conflict.sequencing', {reason: 'Sequencing Error (so)'})
                            // assume a sequence error. we should get it on the second pass.
                          }
                          callback()
                        })
                      }

                    ],
                    () => callback() // waterfall
                  )
                },
                () => { // during
                  callback = _.once(callback)
                  try {
                    cursor.close(() => callback())
                  } catch (e) {
                    callback()
                  }
                }
              )
            },
            () => setImmediate(callback) // eachSeries
          )
        },

        // final check for a signal
        callback => {
          if (this._lock) {
            this._lock.maintain(callback)
          } else {
            callback()
          }
        }
      ],
      () => {

        let err
        if (message.cancelled) {
          err = Fault.create('cortex.error.aborted')
        } else if (this._signal) {
          const signal = this._signal
          this._signal = null
          switch (signal) {
            case consts.Transactions.Signals.Restart:
              return setImmediate(() => this.run(message, payload, 0, callback))
            case consts.Transactions.Signals.Error:
              err = (this._lock && this._lock.getLastError()) || Fault.create('cortex.error.unspecified', { reason: 'unspecified error signal received.' })
              break
            case consts.Transactions.Signals.Shutdown:
              err = Fault.create('cortex.error.aborted', { reason: 'Shutdown signal received.' })
              break
            case consts.Transactions.Signals.Cancel:
            default:
              break
          }
        } else if (updates > 0 && passes < maxPasses) {
          return setTimeout(() => this.run(message, payload, passes + 1, callback), 500)
        }

        if (!this._lock) {
          return callback(err)
        } else {
          const lock = this._lock
          delete this._lock
          lock.complete(() => callback(err))
        }

      })

  }

}

// ------------------------------------------------------------

function HistoryProcessorWorker() {
  Worker.call(this)
}

util.inherits(HistoryProcessorWorker, Worker)

HistoryProcessorWorker.prototype._process = function(message, payload, options, callback) {

  const jobUpdateInterval = 1000,
        jobLockTimeout = 10000,
        uniqueIdentifier = 'HistoryProcessor'

  WorkerLock.createOrSignalRestart(uniqueIdentifier, { timeoutMs: jobLockTimeout, updateIntervalMs: jobUpdateInterval }, function(err, lock) {
    if (err || !lock) {
      return callback(err)
    }
    (new HistoryProcessorInstance(lock)).run(
      message,
      payload,
      0,
      callback
    )
  })

}

module.exports = HistoryProcessorWorker
