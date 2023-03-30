'use strict'

const Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      utils = require('../../../utils'),
      { resolveOptionsCallback } = utils,
      async = require('async'),
      crypto = require('crypto'),
      consts = require('../../../consts')

module.exports = function(mongoose) {

  const schema = new mongoose.Schema({
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: false
    },
    state: Number, // current transaction state consts.Transactions.States
    signal: Number, // signal received. consts.Transactions.Signals
    hash: String, // unique hash of job.
    expires: Date // operation expiry, in case an error occurs. bumped every time the signal checker runs.
  }, {
    versionKey: false
  })

  schema.index({ expires: 1 }, { expireAfterSeconds: 0, name: 'idxExpires' })
  schema.index({ hash: 1 }, { unique: true, name: 'idxHash' })

  /**
     * creates a new lock instance or signals the other worker that is still running to restart.
     * the process may take a while to complete because it will wait to ensure the restart signal was picked up.
     *
     * IMPORTANT: the caller must call complete() to destroy the lock once work has completed. otherwise, the maintenance timer will
     * continue to run forever.
     *
     * @param uniqueIdentifier
     * @param signal (Number) consts.Transactions.Signals.Restart, consts.Transactions.Signals.Cancel
     * @param callback (Function) -> err, boolean (true if signalled, false if not found or if a signal is already waiting)
     */
  schema.statics.signalLock = function(uniqueIdentifier, signal, callback) {

    if (![consts.Transactions.Signals.Restart, consts.Transactions.Signals.Cancel].includes(signal)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Only Restart or Cancel signals are supported: ' + uniqueIdentifier }))
    }
    const hash = crypto.createHash('sha1').update(uniqueIdentifier).digest('hex')

    this.findOneAndUpdate({ hash: hash, signal: consts.Transactions.Signals.Idle }, { $set: { signal: signal } }, { returnDocument: 'after' }, (err, lock) => {
      callback(err, !!lock)
    })
  }

  schema.statics.peekLock = function(uniqueIdentifier, callback) {
    const hash = crypto.createHash('sha1').update(uniqueIdentifier).digest('hex')
    this.findOne({ hash: hash }, (err, lock) => {
      callback(err, lock)
    })
  }

  /**
   * acquire a new lock instance. fails if another lock is present.
   *
   * IMPORTANT: the caller must call complete() to destroy the lock once work has completed. otherwise, the maintenance timer will
   * continue to run forever.
   *
   * @param uniqueIdentifier
   * @param options
   * @param callback -> err, lock
   */
  schema.statics.acquire = function(uniqueIdentifier, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    options.timeoutMs = utils.rInt(options.timeoutMs, 5000)
    options.updateIntervalMs = utils.rInt(options.updateIntervalMs, 1000)

    const hash = crypto.createHash('sha1').update(uniqueIdentifier).digest('hex'),
          lockId = utils.createId(),
          Lock = this,
          lock = new Lock({ _id: lockId, hash, expires: new Date(Date.now() + options.timeoutMs), state: consts.Transactions.States.Active, signal: consts.Transactions.Signals.Idle })

    lock.save((err, lock) => {

      if (err) {
        if (err instanceof Error && err.name === 'MongoError' && err.code === 11000) {
          logger.debug(`[worker-lock] '${uniqueIdentifier}'@${lockId} duplicated by another actor`)
          err = Fault.create('cortex.conflict.lockExists', { resource: `${uniqueIdentifier}'@${lockId}` })
        }
        logger.error(`[worker-lock] '${uniqueIdentifier}'@${lockId} error initiating lock`, utils.toJSON(err, { stack: true }))
      } else {
        logger.debug(`[worker-lock] '${uniqueIdentifier}'@${lockId} lock acquired`)
        lock._startMaintain(options, uniqueIdentifier)
      }

      callback(err, lock)

    })

  }

  /**
     * creates a new lock instance or signals the other worker that is still running to restart.
     * the process may take a while to complete because it will wait to ensure the restart signal was picked up.
     *
     * IMPORTANT: the caller must call complete() to destroy the lock once work has completed. otherwise, the maintenance timer will
     * continue to run forever.
     *
     * @param uniqueIdentifier
     * @param options
     * @param callback -> err, lock
     */
  schema.statics.createOrSignalRestart = function(uniqueIdentifier, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    if (config('__is_mocha_test__')) {
      const cb = callback
      callback = (err, lock) => {
        cb(err, lock)
        require('../../../../test/lib/server').events.emit('lock.createOrRestart', { err, uniqueIdentifier, lock })
      }
    }

    options.timeoutMs = utils.rInt(options.timeoutMs, 5000)
    options.updateIntervalMs = utils.rInt(options.updateIntervalMs, 1000)

    const hash = crypto.createHash('sha1').update(uniqueIdentifier).digest('hex'),
          lockId = utils.createId()

    // attempt to either create a new lock or send a restart signal.
    this.findOneAndUpdate({ hash: hash }, { $setOnInsert: { _id: lockId, hash: hash, expires: new Date(Date.now() + options.timeoutMs), state: consts.Transactions.States.Pending }, $set: { signal: consts.Transactions.Signals.Restart } }, { upsert: true, returnDocument: 'after' }, (err, lock) => {
      if (!err && !lock) {
        // this should not be possible. but just in case. callback with an error so the message will be re-processed.
        err = Fault.create('cortex.error.unspecified', { reason: 'WorkerLock could not be created: ' + uniqueIdentifier })
      }
      if (err) {
        lock = null

        if (err instanceof Error &&
            (err.name === 'MongoError' || err.constructor.name === 'WriteError' || err.constructor.name === 'BulkWriteError') &&
            (err.code === 11000 || err.code === 11001)
        ) {
          err = null
          logger.debug(`[worker-lock] '${uniqueIdentifier}'@${lockId} duplicated by another actor`)
        } else {
          logger.error(`[worker-lock] '${uniqueIdentifier}'@${lockId} error initiating lock`, utils.toJSON(err, { stack: true }))
        }
        return callback(err)
      }

      // caller created the lock. update the signal to idle, fire up the signalling timer, and return.
      // if the signal or state has changed, then we should assume the operation was cancelled elsewhere (such as a process shutdown).
      if (utils.equalIds(lockId, lock._id)) {
        logger.debug(`[worker-lock] '${uniqueIdentifier}'@${lockId} acquiring lock`)
        return this.findOneAndUpdate({ _id: lockId, state: consts.Transactions.States.Pending, signal: consts.Transactions.Signals.Restart }, { $set: { state: consts.Transactions.States.Active, signal: consts.Transactions.Signals.Idle } }, { returnDocument: 'after' }, (err, lock) => {
          if (!err && lock) {
            logger.debug(`[worker-lock] '${uniqueIdentifier}'@${lockId} lock acquired`)
            lock._startMaintain(options, uniqueIdentifier)
          }
          callback(err, lock)
        })
      }

      // the other lock is pending, meaning another process created it but has not yet starting processing. no need to signal or process.
      if (lock.state === consts.Transactions.States.Pending) {
        logger.debug(`[worker-lock] '${uniqueIdentifier}'@${lockId} lock pending elsewhere`)
        return callback()
      }

      logger.debug(`[worker-lock] '${uniqueIdentifier}'@${lockId} signalling lock holder`)

      // the lock is elsewhere. poll the signal until it has been reset or the lock has disappeared. if the lock is no more, then start over.
      // once the signal has been reset, return a null lock so the worker knows to exit. if the lockId happens to change, another worker has
      // created a job, so consider this one obsolete.
      async.whilst(
        () => {
          return lock && lock.signal !== consts.Transactions.Signals.Idle
        },
        callback => {
          this.findOne({ hash: hash }, (err, _lock) => {

            if (err) {
              logger.error(`[worker-lock] '${uniqueIdentifier}'@${lockId} signaling`, utils.toJSON(err, { stack: true }))
              return callback(err)
            }

            // lock has disappeared. could have timed out or completed. start over by attempting to
            // gain a new lock. if acquired, the new lock signal will be 'Idle'.
            if (!_lock) {
              logger.debug(`[worker-lock] '${uniqueIdentifier}'@${lockId} lock disappeared. restarting`)
              return this.createOrSignalRestart(uniqueIdentifier, options, (err, _lock) => {
                if (!err) {
                  lock = _lock
                }
                callback(err)
              })
            }

            // lock exists but lock id has changed, meaning another worker has just created a lock. allow the other to handle the job.
            if (!utils.equalIds(lock._id, _lock._id)) {
              lock = null
              logger.debug(`[worker-lock] '${uniqueIdentifier}'@${lockId} lock also acquired by other. giving up.`)
              return callback()
            }

            // restart signal received and lock reset to idle.
            if (_lock.signal === consts.Transactions.Signals.Idle) {
              lock = null
              logger.debug(`[worker-lock] '${uniqueIdentifier}'@${lockId} lock signal received by other. done.`)
              return callback()
            }

            lock = _lock

            // wait a few moments before checking again.
            setTimeout(function() {
              callback(err)
            }, parseInt(options.updateIntervalMs / 2))

          })
        },
        err => {
          callback(err, lock)
        }

      )

    })

  }

  /**
     * signal all locks
     * @param signal
     * @param callback
     */
  schema.statics.signalAll = function(signal, callback) {

    this.collection.updateMany({}, { $set: { signal: signal } }, err => callback(err))
  }

  schema.methods.complete = function(callback) {

    logger.debug(`[worker-lock] '${this._uniqueIdentifier}'@${this._id} completing`)
    this._stopMaintain()
    this.removeAllListeners('signal')
    this.remove(() => callback())

  }

  schema.methods.getLastError = function() {
    return this._lastErr
  }

  schema.methods.maintain = function(callback) {

    if (this._maintaining) {
      return callback()
    }

    this._maintaining = true

    const WorkerLock = this.constructor,
          options = this._options

    // look for signals, while bumping the lock expiry. if the lock was not found, emit and error.

    WorkerLock.findOneAndUpdate({ _id: this._id }, { $set: { expires: new Date(Date.now() + options.timeoutMs) } }, { returnDocument: 'after' }, (err, lock) => {

      if (!err && !lock) {
        err = Fault.create('cortex.notFound.unspecified', { reason: 'worker lock disappeared' })
      }
      if (err) {
        this._signalled(err, consts.Transactions.Signals.Error)
        this._maintaining = false
        return callback(err)
      }

      this.expires = lock.expires
      this.signal = lock.signal

      switch (lock.signal) {

        // received a restart signal. accept the signal and reset to Idle.
        case consts.Transactions.Signals.Restart:
          logger.debug(`[worker-lock] '${this._uniqueIdentifier}'@${this._id} restart signal received`)
          WorkerLock.findOneAndUpdate({ _id: this._id, signal: consts.Transactions.Signals.Restart }, { $set: { signal: consts.Transactions.Signals.Idle } }, { returnDocument: 'after' }, (err, lock) => {
            if (!err && !lock) {
              err = Fault.create('cortex.notFound.unspecified', { reason: 'worker lock disappeared' })
            }
            this._signalled(err, consts.Transactions.Signals.Restart)
            this.signal = consts.Transactions.Signals.Idle
            this._maintaining = false
            callback()
          })
          return

          // attempt to remove the lock, stop maintenance, signal listeners, then removes all listeners.
        case consts.Transactions.Signals.Cancel:
        case consts.Transactions.Signals.Shutdown:
          this._signalled('kDone', lock.signal)
          this._maintaining = false
          break
        default:
          this._maintaining = false
          break
      }
      callback()

    })

  }

  schema.methods._signalled = function(err, signal) {

    logger.debug(`[worker-lock] '${this._uniqueIdentifier}'@${this._id} handling signal ${signal}`)
    this.signal = err ? consts.Transactions.Signals.Error : signal
    if (err) {
      if (err !== 'kDone') {
        logger.error(`[worker-lock] '${this._uniqueIdentifier}'@${this._id} signal error`, utils.toJSON(err, { stack: true }))
      } else {
        logger.debug(`[worker-lock] '${this._uniqueIdentifier}'@${this._id} done!`)
      }
      this._stopMaintain()
      this._lastErr = (err === 'kDone') ? null : Fault.from(err)
    }
    this.emit('signal', this, signal)
    if (config('__is_mocha_test__')) {
      require('../../../../test/lib/server').events.emit('lock.signal', { lock: this, uniqueIdentifier: this._uniqueIdentifier, signal })
    }

    if (err) {
      this.removeAllListeners('signal')
      this.remove()
    }
  }

  schema.methods._stopMaintain = function() {
    if (this._maintenanceRef) {
      clearInterval(this._maintenanceRef)
      this._maintenanceRef = null
    }
  }

  schema.methods._startMaintain = function(options, uniqueIdentifier) {
    this._options = options
    this._uniqueIdentifier = uniqueIdentifier
    if (!this._maintenanceRef) {
      this._maintenanceRef = setInterval(() => this.maintain(() => {}), this._options.updateIntervalMs)
      this._maintenanceRef.unref()
    }
  }

  return schema

}
