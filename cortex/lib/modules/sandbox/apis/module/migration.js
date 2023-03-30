'use strict'

/**
 * here be dragons!
 * - migrations where instances cascade delete based on parents will fail because the children can't be deleted.
 * - behaviour when deleting or refreshing an org while a migration is in progress is undefined.
 * - deployments during migrations is undefined.
 */

const ap = require('../../../../access-principal'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      async = require('async'),
      modules = require('../../../../modules'),
      utils = require('../../../../utils'),
      NativeDocumentCursor = require('../../../db/definitions/classes/native-document-cursor'),
      WorkerLock = modules.db.models.WorkerLock,
      Obj = modules.db.models.Object,
      Org = modules.db.models.Org,
      MIGRATION_IDENTIFIER = 'MIGRATION_IDENTIFIER',
      commands = new Map()

let Undefined

class Migration {

  static getOrgAndObject(sourceOrg, sourceObject, callback) {

    Org.loadOrg(sourceOrg, (err, org) => {
      if (err) {
        return callback(err)
      } else if (org.code === 'medable') {
        return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Migrations in base orgs are not permitted.' }))
      }
      org.createObject(sourceObject, (err, object) => {
        if (err) {
          return callback(err)
        } else if (modules.db.definitions.builtInObjectDefsMap[object.objectName]) {
          return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Migrations cannot occur on built-ins.' }))
        }
        callback(null, org, object)
      })
    })

  }

  static getObjectAccessContext(org, object, callback) {
    Obj.findOne({ org: org._id, name: object.objectName, reap: false }).select(Obj.requiredAclPaths.join(' ')).exec((err, subject) => {
      if (!err && !subject) {
        err = Fault.create('cortex.notFound.unspecified', { reason: 'Migrations object target not found.' })
      }
      callback(err, subject && new acl.AccessContext(ap.synthesizeAnonymous(org), subject))
    })
  }

  static lowLevelUpdateAndSync(ac, callback) {
    ac.lowLevelUpdate(err => {
      if (err) {
        return callback(err)
      }
      ac.org.syncObjects(err => {
        callback(err)
      })
    })
  }

  static updateObjectAccessSubject(ac, condition, fn, callback) {

    modules.db.sequencedFunction(
      function(callback) {
        Obj.findOne({ _id: ac.subject._id, reap: false }).select(Obj.requiredAclPaths.join(' ')).exec((err, subject) => {
          if (err) {
            return callback(err)
          } else if (!subject) {
            return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Migrations object target not found.' }))
          } else if (!condition(subject)) {
            return callback(consts.Transactions.Signals.Restart)
          }
          fn(subject)
          ac.subject = subject
          Migration.lowLevelUpdateAndSync(ac, callback)
        })

      },
      20,
      err => callback(err)
    )

  }

  static getNextObjectAccessContext(callback) {

    Obj
      .findOne({ reap: false, object: 'object', 'dataset.migration': { $exists: true }, 'dataset.options.priority': { $gte: 0 } })
      .select(Obj.requiredAclPaths.join(' '))
      .sort({ 'dataset.options.priority': 1 })
      .exec((err, subject) => {
        if (err || !subject) {
          return callback(err)
        }
        this.getOrgAndObject(subject.org, subject.name, (err, org, object) => {
          if (object.sequence !== subject.sequence) {
            return this.getNextObjectAccessContext(callback)
          }
          callback(err, object, new acl.AccessContext(ap.synthesizeAnonymous(org), subject))
        })

      })

  }

  static getCollection(collectionName, callback) {
    modules.db.connection.db.collection(collectionName, { strict: true }, (err, collection) => {
      if (err && err.message && err.message.includes(`${collectionName} does not exist`)) { // @todo see what we get here for 'no collection' error
        err = null
      }
      if (!err && collection) {
        return callback(null, collection)
      }
      modules.db.connection.db.createCollection(collectionName, (err, collection) => {
        if (err || collection.collectionName === 'contexts') { // just in case!
          return callback(err, collection)
        }
        modules.db.definitions.resetContextIndexes(collection, { dryRun: false }, err => {
          callback(err, collection)
        })
      })

    })
  };

  static collections(...args) {
    const collectionNames = _.initial(args), callback = _.last(args)
    async.mapSeries(
      collectionNames,
      (collectionName, callback) => this.getCollection(collectionName, callback),
      (err, collections) => callback(err, ...utils.array(collections))
    )
  }

  /**
   *
   * @param options
   * @param callback -> err, signal or true/false
   */
  static migrate(options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    const updateIntervalMs = 1000,
          timeoutMs = 5000

    WorkerLock.createOrSignalRestart(MIGRATION_IDENTIFIER, { timeoutMs, updateIntervalMs }, (err, lock) => {

      // err or could not get a lock
      if (err || !lock) {
        return callback(err, false)
      }

      // capture lock signals. once emitted, only write once and pass in to methods so they can detect it.
      const signalled = new (class {

        get signal() { return this._signal || consts.Transactions.Signals.Idle }
        set signal(s) { if (!this._signal) this._signal = s }

      })()

      lock.on('signal', (lock, s) => {
        signalled.signal = s
      })

      // current subject.
      let done = false

      async.whilst(

        () => !done && !signalled.signal,

        callback => {

          this.getNextObjectAccessContext((err, object, ac) => {

            if (err || !ac) {

              done = true
              return callback(err)

            } else if (signalled.signal) {

              return callback()

            } else if (ac.subject.dataset.targetCollection) {

              const targetCollection = ac.subject.dataset.targetCollection

              let inProgress = false

              async.series([

                callback => this._migrate(object, ac, signalled, options, callback),
                callback => this._maintenanceOn(ac, signalled, err => {
                  if (!err) {
                    if (ac.subject.dataset.targetCollection !== targetCollection) {
                      err = consts.Transactions.Signals.Restart
                    } else {
                      inProgress = true
                    }
                  }
                  callback(err)
                }),
                callback => this._migrate(object, ac, signalled, options, callback), // migrate again to catch new updates.

                callback => {
                  this.updateObjectAccessSubject(
                    ac,
                    subject => subject.dataset.targetCollection === targetCollection,
                    subject => {
                      subject.increment()
                      subject.dataset.oldCollection = ac.subject.dataset.collection
                      subject.dataset.collection = subject.dataset.targetCollection
                      subject.dataset.targetCollection = undefined
                      subject.dataset.updated = new Date()
                      subject.dataset.log.push({ _id: utils.createId(), migration: ac.subject.dataset.migration, entry: 'data migration completed. starting cleanup.' })
                    },
                    callback
                  )
                }

              ], err => {
                if (!inProgress) {
                  callback(err)
                } else {
                  this._maintenanceOff(ac, (localErr) => {
                    void localErr
                    callback(err)
                  })
                }
              })

            } else if (ac.subject.dataset.oldCollection) {

              const oldCollection = ac.subject.dataset.oldCollection

              this._cleanup(ac, signalled, options, err => {

                if (err || signalled.signal) {
                  callback(err)
                } else {
                  this.updateObjectAccessSubject(
                    ac,
                    subject => subject.dataset.oldCollection === oldCollection,
                    subject => {
                      subject.increment()
                      subject.dataset.log.push({ _id: utils.createId(), migration: ac.subject.dataset.migration, entry: subject.dataset.cancelling ? 'migration reverted' : 'migration completed' })
                      subject.dataset.oldCollection = undefined
                      subject.dataset.lastMigration = subject.dataset.migration
                      subject.dataset.migration = undefined
                      subject.dataset.cancelling = undefined
                      subject.dataset.lastId = undefined
                      subject.dataset.updated = new Date()
                    },
                    callback
                  )
                }

              })

            } else {

              this._dequeue(ac, lock, 'migration is in an oddball state. de-prioritizing.', callback)
            }

          })
        },

        // err can be error or signal.
        err => {

          let signal = signalled.signal
          if (utils.isInt(err)) {
            signal = err
            err = null
          } else if (err && signal === consts.Transactions.Signals.Error) {
            err = lock.getLastError()
          }

          if (!err && signal === consts.Transactions.Signals.Restart) {

            // leave a second here in case we end up in a state where lots of restarts are happening.
            setTimeout(() => {
              lock.complete(err => {
                if (err) {
                  return callback(err)
                }
                this.migrate(options, callback)
              })
            }, 1000)

          } else {

            lock.complete(() => {
              callback(err, signal || true)
            })
          }
        }
      )

    })

  }

  /**
   * move documents in 2 stages. move all documents in a range, until exhausted, then all documents that have updates,
   * until there are no more updates
   */
  static _migrate(object, ac, signalled, options, callback) {

    const delayMs = Math.min(10000, Math.max(0, utils.rInt(options.delayMs, 0)))

    async.waterfall([

      callback => this.collections(ac.subject.dataset.collection, ac.subject.dataset.targetCollection, callback),

      // stage 1. copy all non-updated documents by range.
      (source, target, callback) => {

        let batchSize = 100, batchOps, lastId, ops, total = 0

        logger.info(`[migration] migration stage 1 - migrating documents from ${source.collectionName} to ${target.collectionName} in ${ac.org.code}`)

        async.doWhilst(

          callback => {

            batchOps = 0
            ops = []
            lastId = ac.subject.dataset.lastId

            const masterNode = object.schema.node.typeMasterNode || object.schema.node,
                  typeFilter = masterNode.typed ? { $in: [...masterNode.typeNames, null] } : null,
                  bulk = target.initializeUnorderedBulkOp(),
                  options = ac.subject.dataset.options,
                  match = Object.assign(utils.deserializeObject(options.match || 'null') || {}, { org: ac.orgId, object: ac.subject.name, type: typeFilter, reap: false, _id: { $gt: lastId, $gte: ac.subject.dataset.startId || consts.emptyId }, 'meta.up': { $ne: consts.metadata.updateBits.migrate } }),
                  cursor = source.find(match).limit(batchSize).snapshot().sort({ _id: 1 })

            async.during(

              callback => {
                if (signalled.signal) {
                  callback(signalled.signal)
                } else if (cursor.isClosed()) {
                  callback(null, false)
                } else {
                  cursor.hasNext((err, hasNext) => callback(err, hasNext))
                }
              },

              callback => {
                cursor.next((err, doc) => {
                  if (!err) {
                    batchOps++
                    ops.push(doc)
                    lastId = doc._id
                    bulk.find({ _id: doc._id }).upsert().replaceOne(doc)
                  }
                  callback(err)
                })
              },

              err => {

                try {
                  cursor.close(() => {})
                } catch (e) {}

                if (err || !batchOps || signalled.signal) {
                  return callback(err || signalled.signal)
                }
                bulk.execute((err, writeResult) => {
                  if (writeResult) {
                    err = null
                  }
                  let writeErrors
                  if (!err && writeResult.getWriteErrorCount() > 0) {

                    writeErrors = writeResult.getWriteErrors()
                      .map(err => {
                        if (err && ((err instanceof Error && err.name === 'MongoError') || err.constructor.name === 'WriteError')) {
                          if (err.code === 11000 || err.code === 11001) {
                            if (options.ignoreDuplicates) {
                              return null
                            }
                          }
                        }
                        const doc = ops[err.index]
                        logger.warn(`[migration] migration copy error for ${ac.subject.name} in ${ac.org.code}`, err.toJSON())
                        return {
                          _id: doc._id,
                          fault: err.toJSON(),
                          document: doc
                        }
                      })
                      .filter(v => v)

                    if (writeErrors.length && !options.continueOnWriteError) {
                      err = Fault.create('cortex.error.unspecified', { reason: 'bulk move had write errors' })
                    }
                  }

                  const hasWriteErrors = writeErrors && writeErrors.length && options.storeWriteErrors,
                        handled = (err) => {
                          total += writeResult.nUpserted
                          this.updateObjectAccessSubject(
                            ac,
                            subject => subject.dataset.targetCollection === target.collectionName,
                            subject => {
                              subject.increment()
                              subject.dataset.lastId = lastId
                              subject.dataset.count += writeResult.nUpserted
                              subject.dataset.updated = new Date()
                              subject.dataset.hasWriteErrors = subject.dataset.hasWriteErrors || hasWriteErrors
                            },
                            updateErr => {
                              if (!err && updateErr) {
                                err = updateErr
                              }
                              setTimeout(() => callback(err), delayMs)
                            }
                          )
                        }

                  if (hasWriteErrors) {
                    modules.db.connection.db.collection('migration.errors', (localErr, collection) => {
                      if (localErr) {
                        return handled(localErr)
                      }
                      const bulk = collection.initializeUnorderedBulkOp()
                      writeErrors.forEach(doc => {
                        bulk.find({ _id: doc._id }).upsert().replaceOne(doc)
                      })
                      bulk.execute((localErr, writeResult) => {
                        if (_.isFunction(localErr?.result?.getWriteErrors)) {
                          writeResult = localErr.result
                          localErr = null
                        }
                        if (writeResult) {
                          localErr = null
                        }
                        if (!localErr && writeResult.getWriteErrorCount() > 0) {
                          localErr = Fault.create('cortex.error.unspecified', { reason: 'failed to write errors to log.', faults: writeResult.getWriteErrors() })
                          logger.error(`[migration] migration failed to store copy errors for ${ac.subject.name} in ${ac.org.code}`, localErr.toJSON())
                        }
                        handled(localErr)
                      })
                    })
                  } else {
                    handled(err)
                  }

                })
              }
            )
          },

          () => batchOps && !signalled.signal,

          err => {
            logger.info(`[migration] migration stage 1 - migrated ${total} from ${source.collectionName} to ${target.collectionName} in ${ac.org.code}`)
            callback(err || signalled.signal, source, target)
          }

        )

      },

      // stage 2. copy all updated documents. eventually, these will all be exhausted.
      (source, target, callback) => {

        let batchSize = 100, batchOps, total = 0

        logger.info(`[migration] migration stage 2 - migrating updated documents from ${source.collectionName} to ${target.collectionName} in ${ac.org.code}`)

        async.doWhilst(

          callback => {

            batchOps = 0

            const sourceBulk = source.initializeUnorderedBulkOp(),
                  targetBulk = target.initializeUnorderedBulkOp(),
                  options = ac.subject.dataset.options,
                  match = Object.assign(utils.deserializeObject(options.match || 'null') || {}, { org: ac.orgId, object: ac.subject.name, reap: false, _id: { $gte: ac.subject.dataset.startId || consts.emptyId }, 'meta.up': consts.metadata.updateBits.migrate })

            source.find(match).limit(batchSize).snapshot().toArray((err, docs) => {

              if (err || signalled.signal || docs.length === 0) {
                return callback(err)
              }
              batchOps += docs.length
              docs.forEach(doc => {
                const sequence = doc.sequence
                doc.sequence++
                doc.meta.up = _.without(doc.meta.up, consts.metadata.updateBits.migrate)
                sourceBulk.find({ _id: doc._id, sequence: sequence }).updateOne({ $inc: { sequence: 1 }, $pullAll: { 'meta.up': [consts.metadata.updateBits.migrate] } })
                targetBulk.find({ _id: doc._id }).upsert().replaceOne(doc)
              })

              targetBulk.execute((err, result) => {
                if (_.isFunction(err?.result?.getWriteErrors)) {
                  result = err.result
                  err = null
                }
                if (!err && result.getWriteErrorCount() > 0) {
                  err = Fault.create('cortex.error.unspecified', { reason: 'bulk move had write errors', faults: result.getWriteErrors() })
                }
                if (err) {
                  return callback(err)
                }

                sourceBulk.execute((err, result) => {
                  if (_.isFunction(err?.result?.getWriteErrors)) {
                    result = err.result
                    err = null
                  }
                  if (!err && result.getWriteErrorCount() > 0) {
                    err = Fault.create('cortex.error.unspecified', {
                      reason: 'bulk move had write errors',
                      faults: result.getWriteErrors()
                    })
                  }
                  if (err) {
                    return callback(err)
                  }
                  total += result.nUpserted + result.nModified
                  this.updateObjectAccessSubject(
                    ac,
                    subject => subject.dataset.targetCollection === target.collectionName,
                    subject => {
                      subject.increment()
                      subject.dataset.count += result.nUpserted
                      subject.dataset.updated = new Date()
                    },
                    err => setTimeout(() => callback(err), delayMs)
                  )
                })

              })

            })

          },

          () => batchOps && !signalled.signal,

          err => {
            logger.info(`[migration] migration stage 2 - migrated ${total} from ${source.collectionName} to ${target.collectionName} in ${ac.org.code}`)
            callback(err || signalled.signal)
          }
        )
      }

    ], err => {

      if (signalled.signal) {
        logger.info(`[migration] migration in ${ac.org.code} stopped due to signal ${signalled.signal}`)
      }
      callback(err)

    })

  }

  static _cleanup(ac, signalled, options, callback) {

    const oldCollection = ac.subject.dataset.oldCollection,
          delayMs = Math.min(10000, Math.max(0, utils.rInt(options.delayMs, 0)))

    async.waterfall([

      callback => this.collections(ac.subject.dataset.collection, ac.subject.dataset.oldCollection, callback),

      // stage 1. remove all old documents (in batches so we can re-prioritize)
      (current, old, callback) => {

        logger.info(`[migration] cleanup stage 1 - clearing documents from ${old.collectionName} in ${ac.org.code}`)

        let batchSize = 1000, hasMore = true, totalRemoved = 0

        async.whilst(

          () => hasMore && !signalled.signal,

          callback => {

            const options = ac.subject.dataset.options,
                  match = Object.assign(utils.deserializeObject(options.match || 'null') || {}, { org: ac.orgId, object: ac.subject.name, reap: false, _id: { $gte: ac.subject.dataset.startId || consts.emptyId } })

            old.find(match).project({ _id: 1 }).limit(batchSize).toArray((err, docs) => {
              if (err || docs.length === 0) {
                hasMore = false
                callback(err)
              } else {

                old.deleteMany({ _id: { $in: docs.map(v => v._id) }, reap: false }, (err, result) => {
                  if (!err) {
                    totalRemoved += result.deletedCount
                  }
                  logger.info(`[migration] cleared ${totalRemoved} docs.`)
                  setTimeout(() => callback(err), delayMs)
                })
              }
            })
          },

          err => {

            this.updateObjectAccessSubject(
              ac,
              subject => subject.dataset.oldCollection === oldCollection,
              subject => {
                subject.increment()
                subject.dataset.log.push({ _id: utils.createId(), migration: ac.subject.dataset.migration, entry: subject.dataset.cancelling ? `reverted ${totalRemoved} documents.` : `removed ${totalRemoved} old documents.` })
                subject.dataset.updated = new Date()
              },
              localErr => {
                callback(err || localErr || signalled.signal, current)
              }
            )
          }
        )

      },

      // stage 2. remove migration bit on anything in the current collection (in the event it was a cancellation.)
      (current, callback) => {

        logger.info(`[migration] cleanup stage 2 - clearing migration bit in ${current.collectionName} in ${ac.org.code}`)

        let batchSize = 1000, batchOps

        async.doWhilst(

          callback => {

            batchOps = 0

            const bulk = current.initializeUnorderedBulkOp(),
                  options = ac.subject.dataset.options,
                  match = Object.assign(utils.deserializeObject(options.match || 'null') || {}, { org: ac.orgId, object: ac.subject.name, reap: false, _id: { $gte: ac.subject.dataset.startId || consts.emptyId }, 'meta.up': consts.metadata.updateBits.migrate })

            current.find(match).limit(batchSize).project({ _id: 1, sequence: 1 }).snapshot().toArray((err, docs) => {

              logger.info(`[migration] clearing migration bit on ${docs.length} docs.`)

              if (err || signalled.signal || docs.length === 0) {
                return callback(err)
              }
              batchOps += docs.length
              docs.forEach(doc => {
                bulk.find({ _id: doc._id, sequence: doc.sequence }).updateOne({ $inc: { sequence: 1 }, $pullAll: { 'meta.up': [consts.metadata.updateBits.migrate] } })
              })

              bulk.execute((err, result) => {
                if (_.isFunction(err?.result?.getWriteErrors)) {
                  result = err.result
                }
                if (result) {
                  err = null
                }
                if (!err && result.getWriteErrorCount() > 0) {
                  err = Fault.create('cortex.error.unspecified', { reason: 'bulk move had write errors', faults: result.getWriteErrors() })
                }
                setTimeout(() => callback(err), delayMs)
              })
            })
          },

          () => batchOps && !signalled.signal,

          err => {

            if (signalled.signal) {
              logger.info(`[migration] cleanup in ${ac.org.code} stopped due to signal ${signalled.signal}`)
            }

            callback(err || signalled.signal)
          }
        )
      }

    ], callback)

  }

  static _dequeue(ac, message, callback) {

    ac.subject.dataset.options.priority = -1
    ac.subject.dataset.log.push({ _id: utils.createId(), migration: ac.subject.dataset.migration, entry: message })
    this.lowLevelUpdateAndSync(ac, err => {
      if (err && err.errCode === 'cortex.conflict.sequencing') {
        err = null // something's changed in the meantime, so continue and catch again on the next pass.
      }
      callback(err)
    })
  }

  static _maintenanceOn(ac, signalled, callback) {

    let unsetInProgress = false

    async.series([

      // 1. set the org to a maintenance state. this is probably safe.
      callback => {
        modules.db.sequencedFunction(
          function(callback) {
            Org.findOne({ org: ac.orgId }, (err, doc) => {
              if (err) {
                return callback(err)
              } else if (doc.deployment.inProgress) {
                return callback(Fault.create('cortex.accessDenied.deploymentInProgress'))
              }
              doc.deployment.inProgress = true
              new acl.AccessContext(ap.synthesizeAnonymous(doc), doc, { req: ac.req }).lowLevelUpdate(callback)
            })
          },
          10,
          err => {
            if (!err) unsetInProgress = true
            callback(err)
          }
        )
      },

      // 2. wait until all request and worker (other than this one) have completed. if x seconds has elapsed and we haven't yet got control, back out.
      callback => {

        callback = _.once(callback)

        let inactive = false,
            giveUpTimer = setTimeout(() => {
              giveUpTimer = null
              callback(Fault.create('cortex.timeout.envActivity', { path: 'migration' }))
            }, 1000 * 60)

        async.whilst(
          () => !inactive,
          callback => {
            if (!giveUpTimer) {
              inactive = true
              return callback()
            } else if (signalled.signal) {
              return callback(signalled.signal)
            }
            modules.services.api.clusterGetActivity(ac.orgId, (err, activity) => {
              if (!err) {
                inactive = activity.requests === 0 && activity.workers === 0 && activity.scripts === 0
                if (!inactive) {
                  return setTimeout(callback, 500)
                }
              }
              callback(err)
            })
          },
          err => {
            clearTimeout(giveUpTimer)
            giveUpTimer = null
            callback(err)
          }
        )
      }

    ], err => {

      // attempt to take the org out of maintenance mode if there was an error.
      if (!err || !unsetInProgress) {
        return callback(err)
      }
      this._maintenanceOff(ac, callback)
    })

  }

  static _maintenanceOff(ac, callback) {
    modules.db.sequencedFunction(
      function(callback) {
        Org.findOne({ org: ac.orgId }, (err, doc) => {
          if (err) return callback(err)
          doc.deployment.inProgress = false
          new acl.AccessContext(ap.synthesizeAnonymous(doc), doc, { req: ac.req }).lowLevelUpdate(callback)
        })
      },
      10,
      err => callback(err)
    )
  }

}

function addCommand(name, description, handler) {
  commands.set(name, description)
  const fn = function(script, message, payloadArgs, callback) {
    if (!script.ac.principal.isSysAdmin()) {
      return callback(Fault.create('cortex.accessDenied.unspecified'))
    }
    payloadArgs.length = handler.length - 2
    handler(script, ...payloadArgs, callback)
  }
  fn.$is_var_args = true
  module.exports[name] = fn
}

addCommand(
  'listCommands',
  'List all available migration modules commands.',
  function(script, callback) {
    callback(null, Array.from(commands.keys()).sort().map(command => ({
      command: command,
      description: commands.get(command)
    })))
  }
)

// ---------------------------------------------

addCommand(
  'assignData',
  `Assigns orphaned data to a copy of an existing object using a custom collection.
        @param sourceOrg (String|ObjectId) org code/id
        @param sourceObject (String|ObjectId) object name/pluralName/id
        @param targetName
        @param targetCollection
        @param options
          delayMs: 0 - a delay between batch operations to give other program elements
          batchSize: 250 (1 - 10000)
          signal: 'start': ("start", "stop", "status")                                                
  `,
  function(script, sourceOrg, sourceObject, targetName, targetCollection, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    let delayMs = Math.min(10000, Math.max(0, utils.rInt(options.delayMs, 0))),
        workerLockId = 'MigrationAssignerIdentifier'

    switch (options.signal || 'start') {

      case 'stop':

        WorkerLock.signalLock(workerLockId, consts.Transactions.Signals.Cancel, callback)
        break

      case 'status':

        WorkerLock.peekLock(workerLockId, (err, lock) => {
          callback(null, (err && err.toJSON()) || {
            state: (lock && consts.Transactions.StatesLookup[lock.state]) || 'Idle',
            signal: (lock && consts.Transactions.SignalsLookup[lock.signal]) || 'None'
          })
        })
        break

      case 'start':

        let lock
        async.whilst(

          () => !lock,

          callback => {

            WorkerLock.createOrSignalRestart(workerLockId, (err, l) => {

              if (err || l) {
                lock = l
                return callback(err)
              }
              setTimeout(callback, 250)

            })

          },

          err => {

            if (!err) {
              _do(lock, (err, lock, total) => {
                logger.info(`[archive] ${lock ? 'done' : 'cancelled'}. ${err ? JSON.stringify(err.toJSON()) : 'ok.'}`)
                if (lock) {
                  lock.complete(err => {
                    void err
                  })
                }
              })
            }

            callback(err, {
              state: (lock && consts.Transactions.StatesLookup[lock.state]) || 'Idle',
              signal: (lock && consts.Transactions.SignalsLookup[lock.signal]) || 'None'
            })

          }

        )
        break

      default:
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid signal' }))

    }

    function _do(lock, callback) {

      const onSignalReceived = (l, sig) => {
        lock = null
        logger.info(`[archive] lock ${sig} signal received, cancelling.`)
      }

      lock.on('signal', onSignalReceived)

      targetCollection = utils.rString(targetCollection, '').toLowerCase().trim()
      if (targetCollection !== 'contexts') {
        if (targetCollection.indexOf('ctx.') !== 0) {
          targetCollection = `ctx.${targetCollection}`
        }
        if (!targetCollection.match(/^ctx\.[a-z0-9_-]{3,40}(\.[a-z0-9_-]{3,40})?$/)) {
          return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'targetCollection must match /^ctx\\.[a-z0-9_-]{3,40}(\\.[a-z0-9_-]{3,40})?$/' }))
        }
      }

      async.waterfall([

        callback => Migration.getOrgAndObject(sourceOrg, sourceObject, callback),

        (org, sourceObject, callback) => {
          modules.db.models.Object.findOne({ org: org._id, name: sourceObject.objectName, reap: false }).exec((err, subject) => {
            if (err) {
              return callback(err)
            } else if (!subject) {
              return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Source object not found.' }))
            } else if (subject.dataset.migration) {
              return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Data assignment cannot occur while a migration is in progress.' }))
            } else if (subject.dataset.collection === targetCollection) {
              return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Data must be assigned away from current data.' }))
            } else if (subject.dataset.hasWriteErrors) {
              return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Migration write errors must be cleared before any data can be assigned.' }))
            }
            callback(null, org, sourceObject, new acl.AccessContext(ap.synthesizeOrgAdmin(org), subject))
          })
        },

        (org, sourceObject, sourceAc, callback) => {
          Migration.collections(targetCollection, (err, target) => {
            callback(err, org, sourceObject, sourceAc, target)
          })
        },

        (org, sourceObject, sourceAc, target, callback) => {

          if (org.findObjectInfo(targetName, false, true)) {
            callback(null, org, sourceObject, sourceAc, target)
          } else {

            sourceAc.subject.aclRead(sourceAc, (err, doc) => {

              if (err) {
                return callback(err)
              }

              const payload = utils.walk(doc, true, true, (value, key) => key === '_id' ? Undefined : value),
                    options = {
                      bypassCreateAcl: true,
                      grant: acl.AccessLevels.Update,
                      passive: true,
                      beforeWrite: function(ac, payload, callback) {
                        ac.hook('save').before((vars, callback) => {
                          vars.ac.subject.dataset.collection = targetCollection
                          callback()
                        })
                        callback()
                      }
                    }

              payload.name = targetName
              payload.label = `Copy of ${payload.label}`

              modules.db.models.object.aclCreate(sourceAc.principal, payload, options, err => {
                callback(err, org, sourceObject, sourceAc, target)
              })

            })
          }
        },

        (org, sourceObject, sourceAc, target, callback) => {
          org.createObject(targetName, (err, targetObject) => {
            if (err) {
              return callback(err)
            }
            Migration.getObjectAccessContext(org, targetObject, (err, targetAc) => {
              if (err) {
                return callback(err)
              } else if (targetAc.subject.dataset.migration) {
                return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Data assignment cannot occur while a migration is in progress.' }))
              } else if (targetAc.subject.dataset.collection !== targetCollection) {
                return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Data must be assigned to the same collection as the target object.' }))
              } else if (targetAc.subject.dataset.hasWriteErrors) {
                return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Migration write errors must be cleared before any data can be assigned.' }))
              }
              callback(null, org, sourceObject, targetObject, sourceAc, targetAc, target)
            })
          })
        },

        (org, sourceObject, targetObject, sourceAc, targetAc, target, callback) => {

          let batchSize = Math.min(10000, Math.max(1, utils.rInt(options.batchSize, 1000))), hasMore = true, totalUpdated = 0

          async.whilst(

            () => hasMore && lock,

            callback => {

              target.find({ org: org._id, object: sourceObject.objectName }).project({ _id: 1 }).limit(batchSize).toArray((err, docs) => {

                if (err || docs.length === 0) {
                  hasMore = false
                  return callback(err)
                }

                target.updateMany({ _id: { $in: docs.map(v => v._id) } }, { $set: { object: targetObject.objectName } }, {
                  w: 'majority'
                }, (err, result) => {
                  err = Fault.from(err)
                  totalUpdated += utils.path(result, 'modifiedCount') || 0
                  logger.info(`[assign] assign ${totalUpdated} from ${sourceObject.objectName} to ${targetObject.objectName} in ${org.code}`)
                  setTimeout(() => callback(err), delayMs)
                })
              })
            },

            err => {
              callback(err, lock, totalUpdated)
            }

          )

        }

      ], callback)
    }

  }
)

// ---------------------------------------------

addCommand(
  'archiveData',
  `Move data from one collection to another. this is not a proper migration and moves data without concern. it should only 
   be used to move orphaned data.      
        @param sourceOrg (String|ObjectId) org code/id
        @param sourceObject (String|ObjectId) object name/pluralName/id
        @param sourceCollection
        @param targetCollection
        @param options              
          match: null          
          ignoreDuplicates: false       
          delayMs: 0  
          batchSize: 250 (1 - 10000)
          signal: 'start': ("start", "stop", "status")            
  `,
  function(script, sourceOrg, sourceObject, sourceCollection, targetCollection, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    let delayMs = Math.min(10000, Math.max(0, utils.rInt(options.delayMs, 0))),
        workerLockId = 'MigrationArchiveIdentifier'

    switch (options.signal || 'start') {

      case 'stop':

        WorkerLock.signalLock(workerLockId, consts.Transactions.Signals.Cancel, callback)
        break

      case 'status':

        WorkerLock.peekLock(workerLockId, (err, lock) => {
          callback(null, (err && err.toJSON()) || {
            state: (lock && consts.Transactions.StatesLookup[lock.state]) || 'Idle',
            signal: (lock && consts.Transactions.SignalsLookup[lock.signal]) || 'None'
          })
        })
        break

      case 'start':

        let lock
        async.whilst(

          () => !lock,

          callback => {

            WorkerLock.createOrSignalRestart(workerLockId, (err, l) => {

              if (err || l) {
                lock = l
                return callback(err)
              }
              setTimeout(callback, 250)

            })

          },

          err => {

            if (!err) {
              _do(lock, (err, lock, total) => {
                logger.info(`[archive] ${lock ? 'done' : 'cancelled'}. ${err ? JSON.stringify(err.toJSON()) : 'ok.'}`)
                if (lock) {
                  lock.complete(err => {
                    void err
                  })
                }
              })
            }

            callback(err, {
              state: (lock && consts.Transactions.StatesLookup[lock.state]) || 'Idle',
              signal: (lock && consts.Transactions.SignalsLookup[lock.signal]) || 'None'
            })

          }

        )
        break

      default:
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid signal' }))
    }

    function _do(lock, callback) {

      const onSignalReceived = (l, sig) => {
        lock = null
        logger.info(`[archive] lock ${sig} signal received, cancelling.`)
      }

      lock.on('signal', onSignalReceived)

      sourceCollection = utils.rString(sourceCollection, '').toLowerCase().trim()
      if (sourceCollection !== 'contexts') {
        if (sourceCollection.indexOf('ctx.') !== 0) {
          sourceCollection = `ctx.${sourceCollection}`
        }
        if (!sourceCollection.match(/^ctx\.[a-z0-9_-]{3,40}(\.[a-z0-9_-]{3,40})?$/)) {
          return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'sourceCollection must match /^ctx\\.[a-z0-9_-]{3,40}(\\.[a-z0-9_-]{3,40})?$/' }))
        }
      }

      targetCollection = utils.rString(targetCollection, '').toLowerCase().trim()
      if (targetCollection !== 'contexts') {
        if (targetCollection.indexOf('ctx.') !== 0) {
          targetCollection = `ctx.${targetCollection}`
        }
        if (!targetCollection.match(/^ctx\.[a-z0-9_-]{3,40}(\.[a-z0-9_-]{3,40})?$/)) {
          return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'targetCollection must match /^ctx\\.[a-z0-9_-]{3,40}(\\.[a-z0-9_-]{3,40})?$/' }))
        }
      }

      if (sourceCollection === targetCollection) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'sourceCollection and targetCollection cannot match.' }))
      }

      async.waterfall([

        callback => Migration.getOrgAndObject(sourceOrg, sourceObject, callback),

        (org, object, callback) => Migration.getObjectAccessContext(org, object, (err, ac) => {
          if (err) {
            return callback(err)
          } else if (ac.subject.dataset.migration) {
            return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Data archive cannot occur while a migration is in progress.' }))
          } else if (ac.subject.dataset.collection === sourceCollection || ac.subject.dataset.collection === targetCollection) {
            return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Data must be archived away from the source or target collections and cannot match current collection.' }))
          } else if (ac.subject.dataset.hasWriteErrors) {
            return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Write errors must be cleared before any data can be archived.' }))
          }
          callback(null, org, object, ac)
        }),

        (org, object, ac, callback) => {
          Migration.collections(sourceCollection, targetCollection, (err, source, target) => {
            callback(err, org, object, ac, source, target)
          })
        },

        (org, object, ac, source, target, callback) => {

          let batchSize = Math.min(10000, Math.max(1, utils.rInt(options.batchSize, 250))), batchOps, ops, total = 0

          logger.info(`[archive] moving documents from ${source.collectionName} to ${target.collectionName} in ${ac.org.code}`)

          async.doWhilst(

            callback => {

              batchOps = 0
              ops = []

              const masterNode = object.schema.node.typeMasterNode || object.schema.node,
                    typeFilter = masterNode.typed ? { $in: [...masterNode.typeNames, null] } : null,
                    bulk = target.initializeUnorderedBulkOp(),
                    match = Object.assign(options.match || {}, { org: ac.orgId, object: ac.subject.name, type: typeFilter, reap: false }),
                    cursor = source.find(match).limit(batchSize).snapshot().sort({ _id: 1 })

              async.during(

                callback => {
                  if (cursor.isClosed()) {
                    callback(null, false)
                  } else {
                    cursor.hasNext((err, hasNext) => setImmediate(callback, err, hasNext))
                  }
                },

                callback => {
                  cursor.next((err, doc) => {
                    if (!err) {
                      batchOps++
                      ops.push(doc)
                      bulk.find({ _id: doc._id }).upsert().replaceOne(doc)
                    }
                    callback(err)
                  })
                },

                err => {

                  try {
                    cursor.close(() => {})
                  } catch (e) {}

                  if (err || !batchOps) {
                    return callback(err)
                  }
                  bulk.execute((err, writeResult) => {
                    if (writeResult) {
                      err = null
                    }
                    let writeErrors
                    if (!err && writeResult.getWriteErrorCount() > 0) {
                      writeErrors = writeResult.getWriteErrors()
                        .map(err => {
                          if (err && ((err instanceof Error && err.name === 'MongoError') || err.constructor.name === 'WriteError')) {
                            if (err.code === 11000 || err.code === 11001) {
                              if (options.ignoreDuplicates) {
                                return null
                              }
                            }
                          }
                          return err
                        })
                        .filter(v => v)

                      if (writeErrors.length) {
                        err = Fault.create('cortex.error.unspecified', { reason: 'archive had write errors', faults: writeErrors })
                      }
                    }
                    if (err) {
                      return callback(err)
                    }
                    source.deleteMany({ _id: { $in: ops.map(v => v._id) }, reap: false }, (err, result) => {
                      if (!err) {
                        total += result.deletedCount
                      }
                      logger.info(`[archive] moved ${total} from ${source.collectionName} to ${target.collectionName} in ${ac.org.code}`)
                      setTimeout(() => callback(err), delayMs)
                    })
                  })
                }
              )
            },

            () => batchOps && lock,

            err => {
              callback(err, lock, total)
            }

          )

        }

      ],

      callback)

    }

  }
)

// ---------------------------------------------
addCommand(
  'status',
  'List migration states and statistics.',
  function(script, callback) {

    async.parallel(
      {

        status: callback => {
          WorkerLock.peekLock(MIGRATION_IDENTIFIER, (err, lock) => {
            callback(null, (err && err.toJSON()) || {
              state: (lock && consts.Transactions.StatesLookup[lock.state]) || 'Idle',
              signal: (lock && consts.Transactions.SignalsLookup[lock.signal]) || 'None'
            })
          })
        },

        active: callback => {

          Obj
            .find({ reap: false, object: 'object', 'dataset.migration': { $exists: true } })
            .select('_id org name dataset')
            .sort({ 'dataset.options.priority': 1 })
            .exec((err, subjects) => {
              if (!err) {
                subjects = subjects.map(subject => subject.toObject())
              }
              if (err || subjects.length === 0) {
                return callback(null, (err && err.toJSON()) || subjects)
              }
              Org.find({ _id: { $in: subjects.map(v => v.org) } }).lean().select('_id code').exec((err, orgs) => {
                if (!err) {
                  subjects.forEach(v => {
                    v.org = (orgs.find(o => utils.equalIds(o._id, v.org)) || {}).code || v.org
                  })
                }
                callback(null, (err && err.toJSON()) || subjects)
              })
            })
        },

        history: callback => {

          Obj
            .find({ reap: false, object: 'object', 'dataset.migration': { $exists: false }, 'dataset.updated': { $exists: true } })
            .select('_id org name dataset')
            .sort({ 'dataset.updated': 1 })
            .exec((err, subjects) => {
              if (!err) {
                subjects = subjects.map(subject => subject.toObject())
              }
              if (err || subjects.length === 0) {
                return callback(null, (err && err.toJSON()) || subjects)
              }
              Org.find({ _id: { $in: subjects.map(v => v.org) } }).lean().select('_id code').exec((err, orgs) => {
                if (!err) {
                  subjects.forEach(v => {
                    v.org = (orgs.find(o => utils.equalIds(o._id, v.org)) || {}).code || v.org
                  })
                }
                callback(null, (err && err.toJSON()) || subjects)
              })
            })
        }

      },
      callback
    )

  }
)

addCommand(
  'clearHistory',
  `Clear all migration history, where possible`,
  function(script, callback) {

    Obj.find({ reap: false, object: 'object', 'dataset.migration': { $exists: false }, 'dataset.updated': { $exists: true }, 'dataset.hasWriteErrors': { $ne: true } }).select(Obj.requiredAclPaths.join(' ')).exec((err, subjects) => {
      if (err) {
        return callback(err)
      }
      async.mapSeries(
        subjects.filter(subject => !modules.db.definitions.builtInObjectDefsMap[subject.name]),
        (subject, callback) => {
          modules.db.sequencedFunction(
            function(callback) {
              Obj.findOne({ _id: subject._id, reap: false, 'dataset.migration': { $exists: false }, 'dataset.updated': { $exists: true }, 'dataset.hasWriteErrors': { $ne: true } }).select(Obj.requiredAclPaths.join(' ')).exec((err, subject) => {
                if (err || !subject) {
                  return callback()
                }
                const ac = new acl.AccessContext(ap.synthesizeAnonymous(script.ac.org), subject)
                ac.subject.dataset.updated = undefined
                ac.subject.dataset.log = []
                Migration.lowLevelUpdateAndSync(ac, err => {
                  return callback(err, subject)
                })
              })
            },
            10,
            (err, subject) => callback(null, !err && subject)
          )
        },
        (err, updates) => {
          callback(err, updates && updates.filter(v => v) && updates.map(v => v.name))
        }
      )

    })

  }
)

addCommand(
  'clearErrors',
  `Clear migration errors for a non-running migration. this will also remove all error documents.
        @param sourceOrg (String|ObjectId) org code/id
        @param sourceObject (String|ObjectId) object name/pluralName/id        
    `,
  function(script, sourceOrg, sourceObject, callback) {

    Migration.getOrgAndObject(sourceOrg, sourceObject, (err, org, object) => {
      if (err) {
        return callback(err)
      }
      modules.db.sequencedFunction(
        function(callback) {
          Migration.getObjectAccessContext(org, object, (err, ac) => {
            if (err) {
              return callback(err)
            } else if (ac.subject.dataset.migration) {
              return callback(Fault.create('cortex.notFound.unspecified', { reason: 'A migration is currently in progress.' }))
            } else if (!ac.subject.dataset.hasWriteErrors) {
              return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Migration has no write errors.' }))
            }
            ac.subject.dataset.hasWriteErrors = false
            ac.subject.dataset.log.push({ _id: utils.createId(), migration: ac.subject.dataset.lastMigration, entry: 'write errors manually cleared' })
            Migration.lowLevelUpdateAndSync(ac, err => {
              if (err) {
                return callback(err)
              }
              modules.db.connection.db.collection('migration.errors', (err, collection) => {
                if (err) {
                  return callback(err)
                }
                collection.deleteMany({ 'document.org': org._id, 'document.object': object.objectName }, (err, result) => {
                  callback(err, utils.path(result, 'deletedCount'))
                })
              })
            })
          })
        },
        10,
        callback
      )
    })
  }
)

addCommand(
  'info',
  `Get object info. 
        @param sourceOrg (String|ObjectId) org code/id
        @param sourceObject (String|ObjectId) object name/pluralName/id        
    `,
  function(script, sourceOrg, sourceObject, pipeline, callback) {

    Migration.getOrgAndObject(sourceOrg, sourceObject, (err, org, object) => {
      if (err) {
        return callback(err)
      }
      Migration.getObjectAccessContext(org, object, (err, ac) => {
        callback(err, ac && ac.subject.dataset)
      })
    })
  }
)

addCommand(
  'showErrors',
  `Show errors for a running or non-running migration. 
        @param sourceOrg (String|ObjectId) org code/id
        @param sourceObject (String|ObjectId) object name/pluralName/id        
    `,
  function(script, sourceOrg, sourceObject, pipeline, callback) {

    Migration.getOrgAndObject(sourceOrg, sourceObject, (err, org, object) => {
      if (err) {
        return callback(err)
      }
      modules.db.connection.db.collection('migration.errors', (err, collection) => {
        if (err) {
          return callback(err)
        }
        const cursor = collection.aggregate([{ $match: { 'document.org': org._id, 'document.object': object.objectName } }, ...utils.array(pipeline, pipeline)], { cursor: {} }),
              result = new NativeDocumentCursor(cursor, {})

        callback(null, result)
      })

    })
  }
)

addCommand(
  'start',
  `Signals the migrator to (re)start.   
    @param options
      delayMs = 0
  `,
  function(script, options, callback) {

    Migration.migrate(options, (err, status) => {
      logger.info(`Migration.migrate(${JSON.stringify(options)}) ->`, (err && err.toJSON()) || status)
    })

    callback(null, true)
  }
)

addCommand(
  'stop',
  `Signals the migrator to stop (does not cancel in-progress migrations)`,
  function(script, callback) {

    WorkerLock.signalLock(MIGRATION_IDENTIFIER, consts.Transactions.Signals.Cancel, callback)
  }
)

addCommand(
  'setPriority',
  `Change the priority of an active migration. Changes take effect immediately. priorities < 0 are not run in the loop.
        @param sourceOrg (String|ObjectId) org code/id
        @param sourceObject (String|ObjectId) object name/pluralName/id
        @param priority (Number) the higher the number, the lower the priority.
        @return the new priority setting.
    `,
  function(script, sourceOrg, sourceObject, priority, callback) {

    Migration.getOrgAndObject(sourceOrg, sourceObject, (err, org, object) => {
      if (err) {
        return callback(err)
      }
      modules.db.sequencedFunction(
        function(callback) {
          Migration.getObjectAccessContext(org, object, (err, ac) => {
            if (err) {
              return callback(err)
            }
            if (!ac.subject.dataset.migration) {
              return callback(Fault.create('cortex.notFound.unspecified', { reason: 'No migration is currently in progress.' }))
            }
            ac.subject.dataset.options.priority = utils.rInt(priority, 0)
            Migration.lowLevelUpdateAndSync(ac, err => {
              if (err) {
                return callback(err)
              }
              WorkerLock.signalLock(MIGRATION_IDENTIFIER, consts.Transactions.Signals.Restart, (err, signalled) => {
                void signalled
                callback(err, ac.subject.dataset.options.priority)
              })
            })
          })
        },
        10,
        callback
      )
    })
  }
)

addCommand(
  'cancelAll',
  `Cancel all migrations in an org where possible.
        @param sourceOrg (String|ObjectId) org code/id                       
    `,
  function(script, sourceOrg, callback) {

    Org.loadOrg(sourceOrg, (err, org) => {

      if (err) {
        return callback(err)
      } else if (org.code === 'medable') {
        return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Migrations in base orgs are not permitted.' }))
      }

      Obj.find({ org: org._id, reap: false, 'dataset.migration': { $exists: true }, 'dataset.targetCollection': { $exists: true } }).select(Obj.requiredAclPaths.join(' ')).exec((err, subjects) => {
        if (err) {
          return callback(err)
        }
        async.mapSeries(
          subjects.filter(subject => !modules.db.definitions.builtInObjectDefsMap[subject.name]),
          (subject, callback) => {
            modules.db.sequencedFunction(
              function(callback) {
                Obj.findOne({ _id: subject._id, reap: false, 'dataset.migration': { $exists: true }, 'dataset.targetCollection': { $exists: true } }).select(Obj.requiredAclPaths.join(' ')).exec((err, subject) => {
                  if (err || !subject || subject.dataset.cancelling || subject.dataset.oldCollection) {
                    return callback()
                  }
                  const ac = new acl.AccessContext(ap.synthesizeAnonymous(org), subject)
                  ac.subject.dataset.oldCollection = ac.subject.dataset.targetCollection // cleanup whatever was in there
                  ac.subject.dataset.targetCollection = undefined // the data is all already there.
                  ac.subject.dataset.cancelling = true // signal the migrator to cleanup migration flags on instances ()
                  ac.subject.dataset.log.push({ _id: utils.createId(), migration: ac.subject.dataset.migration, entry: 'cancellation requested.' })
                  Migration.lowLevelUpdateAndSync(ac, err => {
                    return callback(err, subject)
                  })
                })
              },
              10,
              (err, subject) => callback(null, !err && subject)
            )
          },
          (err, updates) => {
            if (updates) updates = updates.filter(v => v) && updates.map(v => v.name)
            if (err || updates.length === 0) {
              return callback(err)
            }
            WorkerLock.signalLock(MIGRATION_IDENTIFIER, consts.Transactions.Signals.Restart, err => {
              callback(err, updates)
            })
          }
        )

      })

    })

  }
)

addCommand(
  'cancel',
  `Cancel a running migration. A migration can only be cancelled if it is in the migrating state (not the cleanup state)
        @param sourceOrg (String|ObjectId) org code/id
        @param sourceObject (String|ObjectId) object name/pluralName/id        
    `,
  function(script, sourceOrg, sourceObject, callback) {

    Migration.getOrgAndObject(sourceOrg, sourceObject, (err, org, object) => {
      if (err) {
        return callback(err)
      }
      modules.db.sequencedFunction(
        function(callback) {
          Migration.getObjectAccessContext(org, object, (err, ac) => {
            if (err) {
              return callback(err)
            } else if (!ac.subject.dataset.migration) {
              return callback(Fault.create('cortex.notFound.unspecified', { reason: 'No migration is currently in progress.' }))
            } else if (ac.subject.dataset.cancelling) {
              return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Migration is already cancelling.' }))
            } else if (ac.subject.dataset.oldCollection) {
              return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Migrations cannot be cancelled during cleanup phase.' }))
            } else if (!ac.subject.dataset.targetCollection) {
              return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Migration is in an invalid/unknown state.' }))
            }
            ac.subject.dataset.oldCollection = ac.subject.dataset.targetCollection // cleanup whatever was in there
            ac.subject.dataset.targetCollection = undefined // the data is all already there.
            ac.subject.dataset.cancelling = true // signal the migrator to cleanup migration flags on instances ()
            ac.subject.dataset.log.push({ _id: utils.createId(), migration: ac.subject.dataset.migration, entry: 'cancellation requested.' })
            Migration.lowLevelUpdateAndSync(ac, err => {
              if (err) {
                return callback(err)
              }
              WorkerLock.signalLock(MIGRATION_IDENTIFIER, consts.Transactions.Signals.Restart, (err, signalled) => {
                void signalled
                callback(err, ac.subject.dataset.cancelling)
              })
            })
          })
        },
        10,
        callback
      )
    })

  }
)

addCommand(
  'moveAll',
  `Create a migration for each custom object in the org, moving them all to the org's default collection. does
   not affect any currently running migrations or those that have unresolved write errors
        @param sourceOrg (String|ObjectId) org code/id       
        @param options = {
          startId
          priority (Number:0),  the higher the number, the lower the priority.
          ignoreDuplicates: false,
          continueOnWriteError: false,
          storeWriteErrors: true          
        }                
        @param callback                
    `,
  function(script, sourceOrg, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    Org.loadOrg(sourceOrg, (err, org) => {

      if (err) {
        return callback(err)
      } else if (org.code === 'medable') {
        return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Migrations in base orgs are not permitted.' }))
      }

      Obj.collection.countDocuments({ org: org._id, reap: false, properties: { $elemMatch: { type: { $in: ['Reference', 'ObjectId'] }, cascadeDelete: true } } }, (err, count) => {

        if (err) {
          return callback(err)
        } else if (count && org.configuration.objectMode.includes('d')) {
          return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Please turn off "d" objectMode in orgs where cascade deletes are present prior to migrating.' }))
        }

        const targetCollection = org.configuration.defaultCollection
        Obj.find({ org: org._id, reap: false, 'dataset.migration': { $exists: false }, 'dataset.collection': { $ne: targetCollection }, 'dataset.hasWriteErrors': { $ne: true } }).select(Obj.requiredAclPaths.join(' ')).exec((err, subjects) => {
          if (err) {
            return callback(err)
          }
          async.mapSeries(
            subjects.filter(subject => !modules.db.definitions.builtInObjectDefsMap[subject.name]),
            (subject, callback) => {
              modules.db.sequencedFunction(
                function(callback) {
                  Obj.findOne({ name: subject.name, org: org._id, reap: false, 'dataset.migration': { $exists: false }, 'dataset.collection': { $ne: targetCollection }, 'dataset.hasWriteErrors': { $ne: true } }).select(Obj.requiredAclPaths.join(' ')).exec((err, subject) => {
                    if (err || !subject) {
                      return callback()
                    }
                    const ac = new acl.AccessContext(ap.synthesizeAnonymous(org), subject)
                    ac.subject.dataset.targetCollection = targetCollection
                    ac.subject.dataset.oldCollection = undefined
                    ac.subject.dataset.migration = utils.createId()
                    ac.subject.dataset.hasWriteErrors = false
                    ac.subject.dataset.lastMigration = undefined
                    ac.subject.dataset.options = {
                      priority: utils.rInt(options.priority, 0),
                      ignoreDuplicates: utils.rBool(options.ignoreDuplicates, false),
                      continueOnWriteError: utils.rBool(options.continueOnWriteError, true),
                      storeWriteErrors: utils.rBool(options.storeWriteErrors, true)
                    }
                    ac.subject.dataset.cancelling = undefined
                    ac.subject.dataset.startId = utils.getIdOrNull(options.startId) || consts.emptyId
                    ac.subject.dataset.lastId = utils.getIdOrNull(options.startId) || consts.emptyId
                    ac.subject.dataset.count = 0
                    ac.subject.dataset.updated = new Date()
                    ac.subject.dataset.log = [{ _id: utils.createId(), migration: ac.subject.dataset.migration, entry: 'migration queued.' }]
                    Migration.lowLevelUpdateAndSync(ac, err => {
                      callback(err, subject)
                    })
                  })
                },
                10,
                (err, subject) => callback(null, !err && subject)
              )
            },
            (err, updates) => {
              if (updates) updates = updates.filter(v => v) && updates.map(v => v.name)
              if (err || updates.length === 0) {
                return callback(err)
              }
              WorkerLock.signalLock(MIGRATION_IDENTIFIER, consts.Transactions.Signals.Restart, err => {
                callback(err, updates)
              })
            }
          )

        })
      })

    })

  }
)

addCommand(
  'create',
  `Create a migration. Migrations cannot occur in key orgs and cannot move built-in objects. During a migration, instances
     cannot be deleted, nor can properties be removed.
        @param sourceOrg (String|ObjectId) org code/id
        @param sourceObject (String|ObjectId) object name/pluralName/id                
        @param target (String) the target collection. ctx. is added as a prefix if the target is not 'contexts'
        @param options = {
          startId where to start
          priority (Number:0),  the higher the number, the lower the priority.
          ignoreDuplicates: false,
          continueOnWriteError: false,
          storeWriteErrors: true,
          match: null. a match object. anything not matching will be orphaned in the old collection.      
        }                
        @param callback
    `,
  function(script, sourceOrg, sourceObject, targetCollection, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    targetCollection = utils.rString(targetCollection, '').toLowerCase().trim()
    if (targetCollection !== 'contexts') {
      if (targetCollection.indexOf('ctx.') !== 0) {
        targetCollection = `ctx.${targetCollection}`
      }
      if (!targetCollection.match(/^ctx\.[a-z0-9_-]{3,40}(\.[a-z0-9_-]{3,40})?$/)) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'targetCollection must match /^ctx\\.[a-z0-9_-]{3,40}(\\.[a-z0-9_-]{3,40})?$/' }))
      }
    }

    Migration.getOrgAndObject(sourceOrg, sourceObject, (err, org, object) => {
      if (err) {
        return callback(err)
      }

      Obj.collection.countDocuments({ org: org._id, reap: false, properties: { $elemMatch: { type: { $in: ['Reference', 'ObjectId'] }, cascadeDelete: true } } }, (err, count) => {

        if (err) {
          return callback(err)
        } else if (count && org.configuration.objectMode.includes('d')) {
          return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Please turn off "d" objectMode in orgs where cascade deletes are present prior to migrating.' }))
        }

        modules.db.sequencedFunction(
          function(callback) {
            Migration.getObjectAccessContext(org, object, (err, ac) => {

              if (err) {
                return callback(err)
              } else if (ac.subject.dataset.migration) {
                return callback(Fault.create('cortex.notFound.unspecified', { reason: 'A migration is already in progress.' }))
              } else if (ac.subject.dataset.collection === targetCollection) {
                return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'targetCollection cannot match the source collection.' }))
              } else if (ac.subject.dataset.hasWriteErrors) {
                return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Write errors must be cleared before another migration can begin.' }))
              }
              ac.subject.dataset.targetCollection = targetCollection
              ac.subject.dataset.oldCollection = undefined
              ac.subject.dataset.migration = utils.createId()
              ac.subject.dataset.hasWriteErrors = false
              ac.subject.dataset.lastMigration = undefined
              ac.subject.dataset.options = {
                priority: utils.rInt(options.priority, 0),
                ignoreDuplicates: utils.rBool(options.ignoreDuplicates, false),
                continueOnWriteError: utils.rBool(options.continueOnWriteError, true),
                storeWriteErrors: utils.rBool(options.storeWriteErrors, true),
                match: utils.serializeObject(options.match)
              }
              ac.subject.dataset.cancelling = undefined
              ac.subject.dataset.startId = utils.getIdOrNull(options.startId) || consts.emptyId
              ac.subject.dataset.lastId = utils.getIdOrNull(options.startId) || consts.emptyId
              ac.subject.dataset.count = 0
              ac.subject.dataset.updated = new Date()
              ac.subject.dataset.log = [{ _id: utils.createId(), migration: ac.subject.dataset.migration, entry: 'migration queued.' }]
              Migration.lowLevelUpdateAndSync(ac, err => {
                if (err) {
                  return callback(err)
                }
                WorkerLock.signalLock(MIGRATION_IDENTIFIER, consts.Transactions.Signals.Restart, (err, signalled) => {
                  void signalled
                  callback(err, ac.subject.dataset.migration)
                })
              })
            })
          },
          10,
          callback
        )
      })

    })

  }
)
