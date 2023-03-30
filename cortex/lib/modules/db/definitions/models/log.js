'use strict'

const util = require('util'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      utils = require('../../../../utils'),
      modules = require('../../../../modules'),
      http = require('http'),
      onFinished = require('on-finished'),
      consts = require('../../../../consts'),
      ModelDefinition = require('../model-definition'),
      stringifySafe = require('json-stringify-safe'),
      API_REGEX = /^\/([^/?]*)/

Fault.addConverter(function TCPErrorConverter(err) {

  if (!Fault.isFault(err) && err) {
    if (err.code === 'ECONNRESET' || err.errno === 'ECONNRESET') {
      return Fault.create('cortex.error.clientDisconnect', { reason: 'The client disconnected before the request completed.' })
    } else if (err.code === 'EPIPE' || err.errno === 'EPIPE') {
      return Fault.create('cortex.error.clientDisconnect', { reason: 'The client disconnected before the request completed.' })
    }
  }

  return err
})

function LogDefinition() {

  this._id = LogDefinition.statics._id
  this.objectId = LogDefinition.statics.objectId
  this.objectLabel = LogDefinition.statics.objectLabel
  this.objectName = LogDefinition.statics.objectName
  this.pluralName = LogDefinition.statics.pluralName

  const options = {

    label: 'Log',
    name: 'log',
    _id: consts.NativeObjects.log,
    pluralName: 'logs',

    properties: [
      {
        label: 'Id',
        name: '_id',
        type: 'ObjectId',
        auto: true,
        readable: true,
        nativeIndex: true
      },
      {
        label: 'Org',
        name: 'org',
        type: 'ObjectId',
        public: false,
        readable: false
      },
      {
        label: 'Request Id',
        name: 'req',
        type: 'ObjectId',
        nativeIndex: true
      },
      {
        label: 'Principal',
        name: 'pid',
        type: 'ObjectId'
      },
      {
        label: 'Original Principal',
        name: 'oid',
        type: 'ObjectId',
        nativeIndex: true
      },
      {
        label: 'Begin',
        name: 'beg',
        type: 'Date'
      },
      {
        label: 'End',
        name: 'end',
        type: 'Date'
      },
      {
        label: 'Expires',
        name: 'exp',
        type: 'Date',
        readable: false
      },
      {
        label: 'Status Code',
        name: 'sts',
        type: 'Number',
        nativeIndex: true,
        default: 200
      },
      {
        label: 'Source',
        name: 'src',
        type: 'Number',
        nativeIndex: true
      },
      {
        label: 'Source Run Identifier',
        name: 'src_id',
        type: 'ObjectId'
      },
      {
        label: 'Level',
        name: 'lvl',
        type: 'Number',
        nativeIndex: true
      },
      {
        label: 'Trace',
        name: 'trc',
        type: 'Document',
        array: true,
        autoId: false,
        properties: [{
          label: 'File',
          name: 'file',
          type: 'String'
        }, {
          label: 'Line',
          name: 'line',
          type: 'Number'
        }, {
          label: 'Function',
          name: 'function',
          type: 'String'
        }]
      },
      {
        label: 'Error',
        name: 'err',
        type: 'Document',
        properties: [{
          label: 'Name',
          name: 'name',
          type: 'String'
        }, {
          label: 'Code',
          name: 'code',
          type: 'String'
        }, {
          label: 'ErrCode',
          name: 'errCode',
          type: 'String'
        }, {
          label: 'Path',
          name: 'path',
          type: 'String'
        }, {
          label: 'Resource',
          name: 'resource',
          type: 'String'
        }, {
          label: 'Reason',
          name: 'reason',
          type: 'String'
        }, {
          label: 'Message',
          name: 'message',
          type: 'String'
        }, {
          label: 'Status',
          name: 'status',
          type: 'Number'
        }, {
          label: 'Faults',
          name: 'faults',
          type: 'Document',
          array: true,
          properties: [{
            label: 'Name',
            name: 'name',
            type: 'String'
          }, {
            label: 'Code',
            name: 'code',
            type: 'String'
          }, {
            label: 'ErrCode',
            name: 'errCode',
            type: 'String'
          }, {
            label: 'Path',
            name: 'path',
            type: 'String'
          }, {
            label: 'Reason',
            name: 'reason',
            type: 'String'
          }, {
            label: 'Message',
            name: 'message',
            type: 'String'
          }, {
            label: 'Status',
            name: 'status',
            type: 'Number'
          }, {
            label: 'Faults',
            name: 'faults',
            type: 'Any',
            serializeData: false
          }]
        }]
      },

      // common  (scripts callouts in/out. requests in/out)
      {
        label: 'In Bytes',
        name: 'in',
        type: 'Number'
      },
      {
        label: 'Out bytes',
        name: 'out',
        type: 'Number'
      },

      // for scripts,
      {
        label: 'Script Id',
        name: 'sid',
        type: 'ObjectId'
      },
      {
        label: 'Script Type',
        name: 'stp',
        type: 'String'
      },
      {
        label: 'Ops Used',
        name: 'ops',
        type: 'Number'
      },
      {
        label: 'Total http callouts',
        name: 'ctt',
        type: 'Number'
      },
      {
        label: 'Total http callouts ms',
        name: 'cms',
        type: 'Number'
      },

      // for requests.
      {
        label: 'Source IP Address',
        name: 'adr',
        type: 'Number'
      },
      {
        label: 'Request method',
        name: 'mtd',
        type: 'Number'
      },
      {
        label: 'Request Path',
        name: 'url',
        type: 'String'
      },
      {
        label: 'Request Query',
        name: 'que',
        type: 'Any'
      },
      {
        label: 'API Route',
        name: 'rte',
        type: 'String'
      },
      {
        label: 'App Id',
        name: 'aid',
        type: 'ObjectId'
      },
      {
        label: 'App Client Id',
        name: 'cid',
        type: 'ObjectId'
      },
      {
        label: 'Session Id',
        name: 'ses',
        type: 'String',
        readable: false
      },
      {
        label: 'Location Id',
        name: 'lid',
        type: 'ObjectId'
      },

      // passed from script logger
      {
        label: 'Data',
        name: 'dat',
        type: 'Any',
        AnySerializer: stringifySafe,
        AnyDeserializer: JSON.parse

      },

      // for audit events (@todo unused? we moved audit logging. )
      {
        label: 'Context Id',
        name: 'ctx',
        type: 'ObjectId'
      },
      {
        label: 'Object Name',
        name: 'obj',
        type: 'String'
      },

      // for deployments
      {
        label: 'Deployment Identifier',
        name: 'dpl',
        type: 'ObjectId'
      }

    ]

  }

  ModelDefinition.call(this, options)
}
util.inherits(LogDefinition, ModelDefinition)

LogDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = LogDefinition.statics
  options.methods = LogDefinition.methods
  options.indexes = LogDefinition.indexes
  options.options = utils.extend({
    versionKey: false
  }, options.options)

  return ModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

LogDefinition.statics = {

  _id: consts.NativeObjects.log,
  objectId: consts.NativeObjects.log,
  objectLabel: 'Log',
  objectName: 'log',
  pluralName: 'logs',
  requiredAclPaths: ['_id', 'org'],

  initLogging: function(app) {

    const Log = this,
          Stat = modules.db.models.Stat

    Object.defineProperties(http.IncomingMessage.prototype, {
      log: {
        get: function() {
          if (!this.__log) {
            this.__log = new Log({
              req: this._id, // request id
              adr: utils.aton(utils.getClientIp(this)), // source ip address
              mtd: consts.http.methods[this.method], // request method (consts.http.methods)
              beg: new Date(), // request start
              src: consts.logs.sources.request, // from whence it came
              exp: new Date(Date.now() + (86400 * 1000 * 30)) // 30 days
            })
          }
          return this.__log
        }
      }
    })

    app.use(function(req, res, next) {

      if (req.method === 'OPTIONS') {
        return next()
      }

      // unfortunately, we can't peek into the request to see body/header data because adding a listener to the req 'data' event would
      // cause middleware readers to miss data. it would be nice if we could re-emit that data down the line somewhere.
      // so.... @HACK ATTACK. we'll peek inside by telling the stream it thinks it's already flowing so we can add the data
      // event without triggering data emits. there should really be a facility for this.

      /*
             var bytesRead = 0;
             var flowing = req._readableState.flowing;
             req._readableState.flowing = true;
             req.addListener('data', function(chunk) {
             bytesRead += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
             req.log.in = bytesRead;
             });
             req._readableState.flowing = flowing;
             */

      // in case we are using this socket for multiple connections and this is non-zero.
      const bytesWrittenStart = req.connection.bytesWritten

      onFinished(res, function(err, res) {

        try {

          if (res.__err || err) {
            err = Fault.from(res.__err || err, false, true)
            delete res.__err
          }

          const req = res.req,
                prefix = '/:objects'

          if (!req) {
            return
          }

          if (!err && req.aborted) {
            err = Fault.create('cortex.error.clientDisconnect', { reason: 'The client disconnected before the request completed.' })
          }

          let logDoc = req.log,
              rte,
              logObject,
              starting,
              ending,
              api,
              find,
              update

          delete req.__log

          logDoc.org = req.orgId // could be null.
          logDoc.url = req.path // record the url here as it may have been modified along the way.

          // log.aid - set in client-detection
          // log.cid - set in client-detection
          // log.pid - set in authentication
          // log.ses - set in authentication
          // log.lid - set in authentication

          if (utils.isPlainObject(req.query)) {
            delete req.query._ // remove common cache buster.
            if (Object.keys(req.query).length > 0) {
              logDoc.que = req.query
            }
          }

          rte = utils.path(req, 'scriptRoute') || utils.path(req, 'route.path') || '/' // record the route for report aggregation.

          // if the route starts with :objects, we want to replace it with the object from the url.

          if (String(rte).indexOf(prefix) === 0) {
            const object = utils.array(logDoc.url.match(API_REGEX))[1] || ''
            rte = '/' + object + rte.substr(prefix.length)
          }
          logDoc.rte = rte

          logDoc.in = req.connection.bytesRead
          logDoc.out = Math.max(0, req.connection.bytesWritten - bytesWrittenStart)
          logDoc.end = new Date()

          if (err) {
            err.$__logged = true // always log request errors here.
            err = utils.toJSON(err)
            logDoc.sts = err.status
            if (_.isString(err.trace)) {
              logDoc.trc = Log._getTrace(err.trace)
            }
            logDoc.err = err
          } else {
            logDoc.err = logDoc.err.faults = undefined
          }
          if (logDoc.trc.length === 0) {
            logDoc.trc = undefined
          }
          logDoc.dat = undefined
          logDoc.lvl = err ? consts.logs.levels.error : consts.logs.levels.info

          // convert to plain object and store.
          logObject = logDoc.toObject()

          Log.collection.insertOne(logObject, function(err) {
            if (err) {
              logger.error('error adding log record', utils.toJSON(err, { stack: true }))
            }
          })

          // update request statistics for this period. request period are 1 hour.
          starting = new Date(logObject.end)
          starting.setMinutes(0, 0, 0)

          ending = new Date(starting.getTime())
          ending.setMinutes(59, 59, 999)

          api = utils.array(logObject.rte.match(API_REGEX))[1] || ''

          find = {
            org: logObject.org,
            code: consts.stats.sources.request,
            starting: starting,
            ending: ending,
            location: consts.stats.locations.medable,
            client: logObject.cid,
            method: logObject.mtd,
            api: api
          }

          update = {
            $setOnInsert: {
              org: logObject.org,
              starting: starting,
              ending: ending,
              code: consts.stats.sources.request,
              location: consts.stats.locations.medable,
              client: logObject.cid,
              method: logObject.mtd,
              api: api

            },
            $inc: {
              ms: logObject.end - logObject.beg,
              in: logObject.in,
              out: logObject.out,
              count: 1
            }
          }
          if (err) {
            update.$inc.errs = 1
          }

          Stat.collection.updateOne(find, update, { upsert: true }, function(err) {
            if (err) logger.error('failed to update request stat', Object.assign(utils.toJSON(err, { stack: true }), { update }))
          })

        } catch (err) {
          logger.error('request logging failed', utils.toJSON(err, { stack: true }))
        }
      })

      next()

    })

  },

  logApiErr: function(source, err, ac, scriptModel) {
    const Log = this,
          logged = !!(err && err.$__logged) // just in case it has to be converted.
    err = Fault.from(err, null, true)
    if (!logged && !err.$__logged) { // only log errors once.
      err.$__logged = true

      let now = new Date(),
          log = new Log({
            req: ac.reqId,
            org: ac.orgId,
            beg: now,
            end: now,
            src: consts.logs.sources[source] != null ? consts.logs.sources[source] : consts.logs.sources.api,
            in: 0,
            out: 0,
            pid: ac.principalId,
            oid: ac.option('originalPrincipal') || ac.principalId,
            exp: new Date(Date.now() + (86400 * 1000 * 30)),
            lvl: consts.logs.levels.error,
            sid: scriptModel ? scriptModel._id : undefined,
            stp: scriptModel ? scriptModel.type : undefined,
            ops: 0,
            ctt: 0,
            cms: 0
          })

      err = utils.toJSON(err)
      log.sts = err.status
      if (_.isString(err.trace)) {
        log.trc = Log._getTrace(err.trace)
      }
      log.err = err
      log = log.toObject()
      Log.collection.insertOne(log, function(err) {
        if (err) {
          logger.error('error adding log record', utils.toJSON(err, { stack: true }))
        }
      })

    }
  },

  createLogEntry: function(ac, src, err, data, override) {

    let Log = this,
        now = new Date(),
        script = ac.script,
        log = new Log({
          req: ac.reqId,
          pid: ac.principalId,
          oid: ac.option('originalPrincipal') || ac.principalId,
          adr: utils.aton(utils.getClientIp(ac.req)),
          sid: script ? script.configuration._id : undefined,
          stp: script ? script.configuration.type : undefined,
          org: ac.orgId,
          beg: now,
          end: now,
          src: consts.logs.sources[src],
          exp: new Date(Date.now() + (86400 * 1000 * 30)),
          lvl: err ? consts.logs.levels.error : consts.logs.levels.info,
          dat: data
        })

    if (_.isObject(override)) {
      utils.extend(log, override)
    }

    if (err) {
      err = utils.toJSON(err)
      log.sts = err.status
      if (_.isString(err.trace)) {
        log.trc = Log._getTrace(err.trace)
      }
      log.err = err
    } else {
      log.trc = undefined
      log.err = log.err.faults = undefined
    }

    log = log.toObject()

    Log.collection.insertOne(log, function(err) {
      if (err) {
        logger.error('error adding audit record', Object.assign(utils.toJSON(err, { stack: true }), { log }))
      }
    })

  },

  _getTrace: function(trace) {
    if (_.isString(trace)) {
      return trace
        .split('\n')
        .slice(1)
        .map(function(v) {
          v = v.trim().split(' ')
          var fileAndline = utils.rString(v[1], '').split(':')
          if (v[0] && fileAndline[0] && utils.isInteger(fileAndline[1])) {
            return {
              file: fileAndline[0],
              line: fileAndline[1],
              function: v[0]
            }
          }
          return null
        })
        .filter(function(v) {
          return !!v
        })
    }
    return undefined
  }

}

LogDefinition.indexes = [

  [{ org: 1, _id: -1 }, { name: 'idxId' }],

  [{ org: 1, req: 1, _id: -1 }, { name: 'idxReq' }],

  [{ org: 1, src: 1, _id: -1 }, { name: 'idxSrc' }],

  [{ org: 1, lvl: 1, _id: -1 }, { name: 'idxLvl' }],

  [{ org: 1, oid: 1, _id: -1 }, { name: 'idxOid' }],

  [{ exp: 1 }, { expireAfterSeconds: 0, name: 'idxExp' }],

  [{ org: 1, src: 1, op: 1, pid: 1, adr: 1, _id: -1 }, { partialFilterExpression: { src: 4 }, name: 'idxAuditOps' }]

]

module.exports = LogDefinition
