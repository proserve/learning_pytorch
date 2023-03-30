'use strict'

/**
 * @todo. in order to guarantee this only runs once, we need a worker lock.
 */

const Worker = require('../worker'),
      util = require('util'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      acl = require('../../../acl'),
      consts = require('../../../consts'),
      ap = require('../../../access-principal'),
      later = require('later'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      { promised, sleep } = utils,
      Fault = require('cortex-service/lib/fault')

function StorageCalculator() {
  Worker.call(this)
}

util.inherits(StorageCalculator, Worker)

StorageCalculator.prototype._logError = function(err, message, medable, data) {
  if (err && medable) {
    const logged = Fault.from(err, null, true)
    try {
      logged.trace = logged.trace || 'Error\n\tnative storage-calculator:0'
      logger.error('[storage-calculator]', Object.assign(utils.toJSON(logged, { stack: true }), {
        data,
        sequence: utils.path(message, 'parent.sequence'),
        started: message.started,
        runtime: Date.now() - message.started
      }))
      modules.db.models.Log.logApiErr(
        'api',
        logged,
        new acl.AccessContext(ap.synthesizeAnonymous(medable), null, { req: message.req })
      )
    } catch (e) {}
    return logged
  }
  return null
}

// let running = 0

StorageCalculator.prototype._process = function(message, payload, options, callback) {

  // turn off altogether - CTXAPI-778
  return callback()

  // const updateIntervalMs = 10,
  //       timeoutMs = 60000,
  //       uniqueIdentifier = 'StorageCalculatorWorker'
  //
  // modules.db.models.WorkerLock.createOrSignalRestart(uniqueIdentifier, { timeoutMs, updateIntervalMs }, (err, lock) => {
  //
  //   if (err || !lock) {
  //     return callback(err)
  //   }
  //
  //   if (running > 0) {
  //     logger.error('[storage-calculator] MORE THAN ONE INSTANCE RUNNING')
  //   }
  //   running++
  //
  //   this._do(lock, message, payload, options)
  //     .then(v => {
  //       running--
  //       callback()
  //     })
  //     .catch(e => {
  //       running--
  //       callback(e)
  //     })
  // })

}

StorageCalculator.prototype._do = async function(lock, message, payload, options) {

  let request,
      err,
      signal = 0,
      prevCode = '',
      skip = 0

  const start = new Date(),
        cancelRequest = () => {
          if (request) {
            request.cancel()
          }
        },
        onCancelMessage = () => {
          logger.info(`[storage-calculator] message cancel requested`)
          cancelRequest()
        },
        onSignalReceived = (lock, sig) => {
          signal = sig
          logger.info(`[storage-calculator] lock signal received`)
          cancelRequest()
        },
        maxSkip = 100,
        arr = later.schedule(later.parse.cron(message.parent.schedule)).prev(2),
        starting = arr[1],
        ending = arr[0],
        medable = await modules.db.models.Org.loadOrg('medable')

  ending.setMilliseconds(-1)

  message.once('cancel', onCancelMessage)
  lock.on('signal', onSignalReceived)

  while (1) {

    if (message.cancelled || signal) {
      break
    }

    let org

    // if there was a failure, skip until we successfully load an org.
    // once a code is loaded, reset the skip to look for the next code.
    try {
      const match = { reap: false, object: 'org', code: { $gt: prevCode } },
            { _id, code } = await modules.db.models.org.findOne(match).lean().select('_id code').sort({ code: 1 }).skip(skip).exec() || {}

      if (!code) {
        break
      }
      org = await modules.db.models.org.loadOrg(_id)
      prevCode = org.code
      skip = 0
    } catch (e) {
      const ee = this._logError(e, message, medable)
      if (skip > maxSkip) {
        err = ee
        break
      }
      skip += 1
      continue
    }

    try {

      // update document sizes
      await new Promise((resolve, reject) => {
        const start = process.hrtime()
        logger.debug(`[storage-calculator] starting documents size updates for ${org.code} at ${new Date()}`)
        request = modules.storage.updateDocumentSizes(org, { limit: false }, (err, result) => {
          request = null
          err = this._logError(err, message, medable, org._id)
          if (!err && (message.cancelled || signal)) {
            err = Fault.create('cortex.error.aborted', { reason: 'Signal received' })
          }
          if (result) {
            const diff = process.hrtime(start),
                  duration = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(3)
            logger.debug(`[storage-calculator] updated ${result.numModified} documents sizes in ${org.code} in ${duration}ms`)
          }
          err ? reject(err) : resolve()
        })
      })

      await sleep(10)

      // reconcile storage, if active.
      // @todo turn on by default for 2.14.0
      if (config('scheduled.storage-calculator.reconcile')) {

        await new Promise((resolve, reject) => {
          const start = process.hrtime()
          logger.debug(`[storage-calculator] starting reconciliation for ${org.code} at ${new Date()}`)
          request = modules.db.models.Stat.reconcile(org._id, { days: config('scheduled.storage-calculator.days') }, (err, count) => {
            request = null
            if (!err && (message.cancelled || signal)) {
              err = Fault.create('cortex.error.aborted', { reason: 'Signal received' })
            }
            err = this._logError(err, message, payload, medable, org._id)
            const diff = process.hrtime(start),
                  duration = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(3)
            logger.debug(`[storage-calculator] reconciled ${count} stats(s) for ${org.code} in ${duration}ms`)
            err ? reject(err) : resolve()
          })
        })

        await sleep(10)

      }

      // re-calculate cache
      await new Promise((resolve, reject) => {
        const start = process.hrtime()
        logger.debug(`[storage-calculator] starting cache usage calculation for ${org.code} at ${new Date()}`)
        modules.storage.calculateCacheUsage(org, starting, ending, err => {
          err = this._logError(err, message, payload, medable, org._id)
          const diff = process.hrtime(start),
                duration = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(3)
          logger.debug(`[storage-calculator] cache usage for ${org.code} in ${duration}ms`)
          err ? reject(err) : resolve()
        })
      })

    } catch (err) {

      // cancelled or signalled, stop else log actual error and continue.
      if (message.cancelled || signal) {
        break
      }
      this._logError(err, message, medable)
    }

  }

  message.removeListener('cancel', onCancelMessage)
  lock.removeListener('signal', onSignalReceived)

  if (message.cancelled) {
    err = Fault.create('cortex.error.aborted')
  } else if (signal) {
    switch (signal) {
      case consts.Transactions.Signals.Restart:
        logger.info('[storage-calculator] restarting')
        return Promise.resolve(null)
          .then(() => sleep(0))
          .then(() => this._do(lock, message, payload, options))

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

  return promised(lock, 'complete')
    .catch(() => {
      // locks should not trap errors but swallow just in case.
    })
    .then(async() => {

      if (err) {

        // attempt to log the error
        try {

          const logged = Fault.from(err, null, true),
                org = await modules.db.models.Org.loadOrg('medable')

          logged.trace = logged.trace || 'Error\n\tnative storage-calculator:0'
          logger.error('[instance-reaper]', Object.assign(utils.toJSON(err, { stack: true }), { doc: message.doc }))

          modules.db.models.Log.logApiErr(
            'api',
            logged,
            new acl.AccessContext(
              ap.synthesizeAnonymous(org),
              null,
              { req: message.req })
          )

        } catch (e) {
          void e
        }
      } else {
        logger.info('[storage-calculator] ran in ' + (Date.now() - start) + 'ms')
      }
      return err
    })

}

module.exports = StorageCalculator
