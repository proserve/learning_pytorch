'use strict'

/*
// This helps to detect issues with cyclical modules and syntax hangs.

const Module = require('module');
function hasDuplicates(array) {
    return (new Set(array)).size !== array.length;
}
var path = require('path');
var chain = [];
var _require = Module.prototype.require;
Module.prototype.require = function(file) {

    // const fullpath = path.resolve(path.join(path.dirname(this.filename), file)).replace("/Users/james/Documents/Projects/MedableAPI", "");
    // console.log(`${'\t'.repeat(chain.length)}${this.filename.replace("/Users/james/Documents/Projects/MedableAPI", "")} required ${file}`);
    console.log(file);
    // chain.push(file.replace(file.replace(/[\/\.]/g, '')));
    // chain.push(fullpath);
    // if (hasDuplicates(chain)) {
        // console.log(`CYCLIC DEPENDENCY FOUND IN ${JSON.stringify(chain, null, 4)}`);
    // }
    const module = _require.call(this, file);
    // chain.pop();
    return module;
};
*/

const {
        Service,
        ManagementApi,
        ServiceApi,
        Error,
        config,
        logger
      } = require('cortex-service'),
      { HealthApi } = require('cortex-service/lib/endpoints'),
      utils = require('../utils'),
      Fault = require('cortex-service/lib/fault'),
      fs = require('fs'),
      async = require('async'),
      path = require('path'),
      middleware = require('../middleware'),
      modules = require('../modules'),
      compression = require('compression'),
      methodOverride = require('method-override'),
      { ServerResponse } = require('http'),
      prometheusMiddleware = require('express-prometheus-middleware')

Object.defineProperties(ServerResponse.prototype, {
  addTransform: {
    value: function(transform, { runtimeArguments = {} } = {}) {
      (this.__transforms || (this.__transforms = [])).push({ transform, options: { runtimeArguments } })
    }
  },
  hasTransforms: {
    value: function() {
      return !!this.__transforms
    }
  },
  transformResult: {
    value: async function(err, result) {
      if (this.__transforms) {
        for (const { transform, options } of this.__transforms) {
          try {
            result = await transform.run(err, result, options)
          } catch (e) {
            err = e
          }
        }
      }
      if (err) {
        throw err
      }
      return result
    }
  }
})

class HealthApiClass extends HealthApi {

  _routes(app, service, express) {
    super._routes(app, service, express)
    collectRoutes(`${__dirname}/../routes/health`, express, app, service)
  }

}

// CTXAPI-670 - trace source of warnings.
process.on('warning', w => {
  try {
    logger.warn('[warning] => ', w.toJSON ? w.toJSON({ stack: true }) : w)
  } catch (e) {

  }
})

module.exports = class extends Service {

  _startService(callback) {

    require('../faults') // load fault codes and converters.

    async.series([
      callback => modules.db.start(callback),
      callback => modules.workers.start(callback),
      callback => modules.runtime.start(callback),
      callback => modules.db.bootstrap(callback),
      callback => modules.sandbox.start(callback),
      callback => modules.services.start(callback),
      callback => modules.events.start(callback)
    ], err => {

      modules.metrics.register('modules', () =>
        ['db', 'workers', 'runtime', 'sandbox', 'events'].reduce((memo, name) => Object.assign(memo, { [name]: modules[name].toJSON() }), {})
      )

      callback(err)
    })

    this._health = new HealthApiClass(this)
  }

  _stopService(callback) {
    async.series([
      callback => modules.events.stop(callback),
      callback => modules.runtime.stop(callback),
      callback => modules.workers.stop(callback),
      callback => modules.sandbox.stop(callback),
      callback => modules.services.stop(callback),
      callback => modules.db.stop(callback)
    ], err => {
      logger.info('api-service stopped')
      callback(err)
    })
  }

  _stopEndpoints(callback) {

    async.series([

      // wait until we're no longer an available endpoint.
      callback => {

        if (!modules.services.lb) {
          return callback()
        }

        const ip = utils.localIp()

        async.during(

          callback => {

            modules.services.lb.get('/endpoints/cortex-api-service', (err, results) => {
              if (err) {
                logger.error(`${ip} got error calling lb service endpoints. trying again.`, utils.toJSON(err, { stack: true }))
                return callback(null, true)
              }
              for (let [name, result] of Object.entries(results)) {
                if (result && result.object === 'list' && Array.isArray(result.data) && result.data.find(endpoint => endpoint.ip === ip)) {
                  logger.info(`${ip} still part of the load balancer ${name}`)
                  return callback(null, true)
                } else if (result instanceof Error) {
                  logger.info(`${ip} got lb error result. trying again.`, result.toJSON())
                  return callback(null, true)
                }
              }
              callback(null, false)
            })

          },

          callback => {
            setTimeout(callback, 250)
          },

          err => {
            void err
            setTimeout(callback, 250)
          }
        )

      },

      // shut http down deps in runtime operations.
      callback => {

        modules.runtime.preStop(() =>
          callback()
        )

      },

      callback => {

        super._stopEndpoints(callback)

      }

    ], callback)

  }

  metrics(callback) {

    super.metrics((err, metrics) => {
      modules.metrics.get().then((result) => {
        callback(err, utils.extend(metrics, result))
      })
    })

  }

  static get ManagementApiClass() {

    return class extends ManagementApi {

      _routes(app, service, express) {

        super._routes(app, service, express)

        collectRoutes(`${__dirname}/../routes/management`, express, app, service)

      }

      _handleWsConnection(spark) {

        spark.on('command', (args, callback = () => {}) => {
          modules.services.api.handleCommand(args.command, utils.deserializeObject(utils.path(args.payload, 'serialized')), (err, result) => {
            callback(err, { serialized: utils.serializeObject(result) })
          })
        })

        spark.on('command-list', (args, callback = () => {}) => {
          modules.services.api.listCommands((err, result) => {
            callback(err, { serialized: utils.serializeObject(result) })
          })
        })

      }

      _handleWsDisconnection(spark) {
        void 0
      }

    }

  }

  static get ServiceApiClass() {

    return class extends ServiceApi {

      _routes(app, service, express) {

        app.disable('x-powered-by')
        app.enable('trust proxy')

        app.use(function(req, res, next) {
          res.header('Medable-Request-Id', req._id)
          next()
        })

        // immediately move allowed medable query values into the header.
        // we do not want this in the query log.
        app.use(function(req, res, next) {
          middleware.client_detection.adjust_headers(req)
          next()
        })

        // init org-level request logging.
        modules.db.models.log.initLogging(app)

        super._routes(app, service, express)

        if (config('debug.logRequestHeaders')) {
          app.use(function(req, res, next) {
            logger.silly('request headers', { headers: req.headers })
            next()
          })
        }

        if (config('server.forceHostRedirect')) {
          app.use(function(req, res, next) {
            const host = utils.rString(req.header('host'), '')
            if (host !== config('server.apiHost')) {
              const isApi = host.indexOf('api.') === 0,
                    isDomain = host.indexOf('.' + config('server.domain'), host.length - (String(config('server.domain')).length + 1)) !== -1

              if (!config('server.allowVariantHosts') || !isDomain || !isApi) {
                return res.redirect(301, `http${config('server.https') ? 's' : ''}://${config('server.apiHost')}${req.path}`)
              }
            }
            next()
          })
        }

        app.use(middleware.cors.preFlight) // early pre-flight permissive cors

        app.use((req, res, next) => {
          res.setHeader('Surrogate-Control', 'no-store')
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
          res.setHeader('Pragma', 'no-cache')
          res.setHeader('Expires', '0')
          next()
        })

        app.use(methodOverride())
        app.use(compression({ threshold: 1024 }))

        // @defines req.locale
        app.use(middleware.locale())

        // @defines req.org req.orgId req.orgCode
        app.use(middleware.org())

        // determine the api version. for now, hard code api version here. we are at version 2.
        // this is for local build only. the container checks and remove the version.
        if (config('server.matchApiVersion')) {

          const versionRegExp = /^\/v([0-9]{1,})(\/?|(?:\/.*))$/

          app.use(function(req, res, next) {

            const matches = req.url.match(versionRegExp)
            if (matches) {
              req.apiVersion = parseInt(matches[1])
              req.log.url = req.url = matches[2] || '/'
            } else {
              req.apiVersion = 2
            }
            if (req.apiVersion !== 2) {
              next(Fault.create('cortex.invalidArgument.invalidApiVersion'))
            }
            next()
          })
        }

        collectRoutes(`${__dirname}/../routes/application`, express, app, service)

        // ensure output is json, handling not found and other errors.
        app.use((err, req, res, next) => {
          utils.outputResults(res, err)
        })
        app.use((req, res) => {
          utils.outputResults(res, Fault.create('cortex.notFound.unspecified', { reason: `'${req.originalUrl || req.url}' was not found on this server.`, status: '404' }))
        })

      }

      metrics(callback) {

        const metrics = {
          requests: modules.metrics.activeRequests
        }
        callback(null, metrics)

      }

    }

  }

}

function collectRoutes(dir, express, router, service) {
  fs.readdirSync(dir).sort(utils.naturalCmp).forEach(file => {
    if (file[0] !== '.' && file[0] !== '$') {
      const fullp = `${dir}/${file}`, stats = fs.statSync(fullp)
      if ((stats.isFile() && path.extname(file) === '.js')) {
        router = require(fullp)(express, router, service) || router // use the router returned by the last file in the chain (or the same if none)
      } else if (stats.isDirectory()) {
        collectRoutes(fullp, express, router, service)
      }
    }
  })
}
