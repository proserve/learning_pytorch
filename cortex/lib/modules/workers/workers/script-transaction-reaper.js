'use strict'

const Worker = require('../worker'),
      util = require('util'),
      async = require('async'),
      _ = require('underscore'),
      logger = require('cortex-service/lib/logger'),
      consts = require('../../../consts'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault')

function ScriptTransactionReaper() {
  Worker.call(this)
}

util.inherits(ScriptTransactionReaper, Worker)

/**
 * @param message
 * @param payload
 * @param options
 * @param callback
 * @private
 */
ScriptTransactionReaper.prototype._process = function(message, payload, options, callback) {

  var working = true, Tx = modules.db.models.Transaction, Log = modules.db.models.Log

  async.whilst(function() {

    return working

  }, function(callback) {

    var find = {
      type: Tx.Types.ScriptRun,
      timeout: { $lte: Date.now() }
    }

    Tx.findOneAndRemove(find, function(err, tx) {
      working = !err && tx
      if (working) {

        let now = new Date(),
            log = new Log({
              req: tx.reqId,
              org: tx.org,
              beg: now,
              end: now,
              src: consts.logs.sources.script,
              in: 0,
              out: 0,
              pid: tx.principalId,
              oid: tx.originalPrincipal,
              exp: new Date(Date.now() + (86400 * 1000 * 30)),
              lvl: consts.logs.levels.error,
              sid: tx.scriptId,
              stp: tx.scriptType,
              ops: 0,
              ctt: 0,
              cms: 0
            }),
            fault = Fault.create('script.error.didNotComplete')

        fault.trace = 'Error\n\tnative script:0'
        fault = utils.toJSON(fault)

        log.sts = fault.status
        if (_.isString(fault.trace)) {
          log.trc = Log._getTrace(fault.trace)
        }
        if (log.trc.length === 0) {
          log.trc = undefined
        }
        log.dat = undefined
        log.err = fault

        Log.collection.insertOne(log.toObject(), function(err) {
          if (err) {
            logger.error('error adding log record', err.toJSON())
          }
        })
      }

      callback()

    })

  }, function() {
    callback()
  })

}

module.exports = ScriptTransactionReaper
