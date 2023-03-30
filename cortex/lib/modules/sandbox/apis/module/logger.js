'use strict'

var utils = require('../../../../utils'),
    consts = require('../../../../consts'),
    logger = require('cortex-service/lib/logger'),
    modules = require('../../../../modules'),
    _ = require('underscore'),

    MaxDataItems = 100

function log(logLevel, script, message, data, callback) {

  const source = utils.rVal(script.ac.option('sandbox.logger.source'), consts.logs.sources.logger),
        sourceId = utils.getIdOrNull(script.ac.option('sandbox.logger.sourceId')),
        now = new Date(),
        log = new modules.db.models.log({
          req: script.ac.reqId || utils.createId(),
          org: script.ac.orgId,
          beg: now,
          end: now,
          src: source,
          in: utils.rInt(message.stats.bytesIn, 0),
          out: utils.rInt(message.stats.bytesOut, 0),
          pid: script.ac.principalId,
          oid: script.ac.option('originalPrincipal') || script.ac.principalId,
          exp: new Date(Date.now() + (86400 * 1000 * 30)),
          lvl: consts.logs.levels[logLevel] != null ? consts.logs.levels[logLevel] : consts.logs.levels.info,
          sid: script.configuration._id,
          stp: script.configuration.type,
          ops: message.stats.ops,
          ctt: utils.rInt(message.stats.callouts, 0),
          cms: utils.rInt(message.stats.calloutsMs, 0)
        })

  if (source === consts.logs.sources.deployment) {
    log.dpl = script.ac.subjectId
  }
  if (sourceId) {
    log.src_id = sourceId
  }

  if (_.isString(message.trace)) {
    log.trc = modules.db.models.log._getTrace(message.trace)
  } else {
    log.trc = undefined
  }
  log.err = log.err.faults = undefined

  data = utils.array(data, data)
  if (data.length > MaxDataItems) {
    data = data.slice(0, MaxDataItems) // just silently cut them out.
  }
  log.dat = data.length ? data : undefined

  modules.db.models.log.collection.insertOne(log.toObject(), function(err) {
    if (err) {
      logger.error('error adding log record', err.toJSON())
    }
  })

  callback()

}

module.exports = ['warn', 'error', 'info', 'debug', 'trace'].reduce(
  (mod, logLevel) => {
    const fn = mod[logLevel] = function(script, message, data, callback) {
      log(logLevel, script, message, data, callback)
    }
    fn.$is_var_args = true
    return mod
  },
  {
    version: '1.0.0'
  }
)
