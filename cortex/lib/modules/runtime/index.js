
const Startable = require('cortex-service/lib/startable'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      async = require('async'),
      Fault = require('cortex-service/lib/fault'),
      registry = require('./registry'),
      { sleep, path: pathTo, array: toArray, toJSON } = require('../../utils'),
      { services: { api } } = require('../../modules')

class RuntimeModule extends Startable {

  constructor(options) {

    super('runtime', options)

    api.addCommand('runtime.operations.find', (payload, callback) => {

      return callback(
        null,
        this.db
          .find(pathTo(payload, 'find'))
          .map(v => v.export())
      )

    })

    api.addCommand('runtime.operations.cancel', (payload, callback) => {

      return callback(
        null,
        this.db
          .find(pathTo(payload, 'find'))
          .map(v => {
            v.cancel(Fault.from(pathTo(payload, 'err')))
            return v.export()
          })
      )

    })

  }

  get operations() {
    return require('./operations')
  }

  get db() {
    return registry
  }

  clusterFind(find, callback) {

    api.command(
      'runtime.operations.find',
      {
        body: { find }
      },
      (err, results) => {
        callback(
          err,
          [].concat(
            ...Object.values(results || {}).map(v => toArray(v))
          )
        )
      })

  }

  clusterCancel(find, err, callback) {

    api.command(
      'runtime.operations.cancel',
      {
        body: { find, err: toJSON(Fault.from(err)) }
      },
      (err, results) => {
        callback(
          err,
          [].concat(
            ...Object.values(results || {}).map(v => toArray(v))
          )
        )
      })

  }

  count() {
    return registry.count()
  }

  preStop(callback) {

    let all = registry.find({ type: { $in: ['request', 'db.bulk'] } }).filter(op => op.activeCursor)

    const gracePeriodMs = config('modules.runtime.preStop.gracePeriodMs')

    if (all.length === 0) {
      return callback()
    }

    logger.info(`Runtime module preStop. Waiting ${gracePeriodMs}ms for ${all.length} cursor stream(s) to finish before aborting.`)

    Promise.resolve(null)
      .then(async() => {

        const waitStart = Date.now(),
              waitInterval = 100

        while ((Date.now() - waitStart) < gracePeriodMs) {
          all = all.filter(op => op.activeCursor)
          if (all.length === 0) {
            break
          }
          await sleep(waitInterval)
        }

        all = all.filter(op => op.activeCursor)

        if (all.length) {
          logger.info(`Runtime module preStop grace period expired. Aborting ${all.length} cursor stream(s).`)
        }

        async.each(
          all,
          (operation, callback) => {
            operation.cancel()
            callback() // return immediately, allowing http service module to detect the request end.
          },
          callback
        )

      })
  }

  _waitStop(callback) {

    let all = registry.find()

    if (all.length) {
      logger.info(`Attempting to cancel ${all.length} operation(s).`)
    }

    for (const operation of all) {
      operation.cancel(Fault.create('cortex.error.aborted', 'Shutting down.'))
    }

    async.until(
      () => this.count() === 0,
      callback => {
        setTimeout(callback, 10)
      },
      () => {
        logger.info(`${this.logName} module stopped`)
        callback()
      }
    )

  }

}

module.exports = new RuntimeModule()
