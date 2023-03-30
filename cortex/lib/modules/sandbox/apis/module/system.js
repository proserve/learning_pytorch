'use strict'

const ap = require('../../../../access-principal'),
      later = require('later'),
      asyncHooks = require('async_hooks'),
      perfHooks = require('perf_hooks'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      acl = require('../../../../acl'),
      logger = require('cortex-service/lib/logger'),
      { Transform } = require('stream'),
      { writeHeapSnapshot } = require('v8'),
      { createReadStream } = require('fs'),
      { pick, isBoolean } = require('underscore'),
      path = require('path'),
      async = require('async'),
      NativeDocumentCursor = require('../../../db/definitions/classes/native-document-cursor'),
      serviceRoot = require('cortex-service/lib/init-config'),
      pidusage = require('pidusage'),
      modules = require('../../../../modules'),
      {
        services: {
          api: apiService
        },
        db: {
          models,
          connection
        }
      } = modules,
      WritableOutputCursor = require('../../../../classes/writable-output-cursor'),
      {
        equalIds, getIdOrNull, queryLimit, extend, array: toArray, isSet, path: pathTo,
        promised, deserializeObject, rBool, idToTimestamp, rInt, visit, rString
      } = require('../../../../utils'),
      consts = require('../../../../consts'),
      activelyRunningExports = {},
      system = {},
      asyncHooksMap = new Map()

modules.metrics.register('sandbox.system', () => {

  return {
    activelyRunningExports,
    tails: Array.from(system.tails.keys()).map(v => v.toJSON()),
    asyncOperations: Array.from(asyncHooksMap.entries()).reduce((memo, [key, set]) => Object.assign(memo, { [key]: set.size }), {})
  }

})

module.exports = {
  version: '1.0.0'
}

class TimingInstance {

  #timing
  #start
  #end
  constructor(timing, end) {
    this.#timing = timing
    this.#start = process.hrtime()
    this.#end = end
  }
  end() {
    this.#end(this.#start)
  }

}

class Timing {

  #current
  #count = 0
  #max = 0
  #min = Number.MAX_SAFE_INTEGER
  #total = 0
  #avg = 0
  #date
  toJSON() {
    return {
      date: this.#date,
      count: this.#count,
      current: this.#current,
      max: this.#max,
      min: this.#min,
      total: this.#total,
      avg: this.#avg
    }
  }

  begin() {
    return new TimingInstance(this, (start) => {
      let diff = process.hrtime(start),
          ms = ((diff[0] * 1e9 + diff[1]) / 1e6)
      this.#date = new Date()
      this.#current = ms
      this.#count += 1
      this.#total += ms
      this.#max = Math.max(ms, this.#max)
      this.#min = Math.min(ms, this.#min)
      this.#avg = this.#total / this.#count
    })
  }

}

let Undefined, definition = {

  listCommands: {

    description: 'List available system commands.',
    orgs: '*',
    domains: '*',
    hosts: '*',
    envs: '*',
    roles: '*',

    handler: function(script) {

      return Object.keys(definition).sort().map((command) => {

        const {
          description,
          params,
          orgs = ['medable'],
          envs = ['development', 'production'],
          hosts = ['*'],
          domains = [
            'local', // local development
            'medable', // internal (eg. int-dev, qa)
            'market' // public (eg. dev, prod, ap1, ap1-dev)
          ],
          roles = ['administrator']
        } = definition[command]

        try {

          gate(script, { orgs, envs, roles, hosts, domains })

        } catch (err) {
          return null
        }

        return {
          command,
          orgs,
          envs,
          domains,
          roles,
          description,
          params
        }

      }).filter(v => v)
    }

  },

  // system --------------------------------------------------------------------------------

  burst: {
    description: 'force the sandbox to burst',
    params: [
      'count { Number = 1 } num instances',
      'idleRelease { Number = 30000 } release in x ms'
    ],
    handler: function(script, count = 1, idleRelease = 30000, callback) {

      async.times(
        count || 1,
        callback => modules.sandbox._pool.addInstance({ idleRelease }, callback),
        callback
      )
    }
  },
  run: {

    description: 'run a number of scripts on this instance in parallel',
    params: [
      'sources { String[] } array of scripts to run.',
      'options { Object } async=false'
    ],
    handler: async function(script, sources, options) {

      sources = toArray(sources, true).slice()

      const run = (source, index) => {
              return new Promise((resolve, reject) => {
                modules.sandbox.sandboxed(
                  new acl.AccessContext(script.ac.principal),
                  source,
                  {
                    compilerOptions: {
                      label: `script.run(${index})`,
                      type: 'event',
                      language: 'javascript',
                      specification: 'es6'
                    }
                  },
                  {
                    index
                  })((err, result) => {
                  err ? reject(err) : resolve({ result, index })
                })
              })
            },
            results = [],
            promise = new Promise((resolve, reject) => {
              let index = 0,
                  remaining = sources.length
              async.whilst(
                () => index < sources.length,
                callback => {
                  setImmediate(() => {
                    let err
                    run(sources[index], index++)
                      .catch(e => {
                        err = e
                      })
                      .then(({ result, index } = {}) => {
                        if (err) {
                          reject(err)
                        } else {
                          remaining -= 1
                          results[index] = result
                          if (remaining === 0) {
                            resolve(results)
                          }
                        }
                      })
                    callback()
                  })
                }
              )
            })

      if (options && options.async) {
        let err
        promise
          .catch(e => {
            err = e
          })
          .then(results => {
            void err
            void results
          })

        return true
      }
      return promise

    }
  },

  support: {

    description: 'Run a script in another environment as a support login.',
    params: [
      'env {String} environment in which to run the script',
      'account {String|Object} email, service account or account spec',
      'reason {String} reason',
      'args {Object} runtime arguments',
      'code {String}'
    ],
    handler: async function(script, env, account, reason, args, scriptSource) {

      reason = rString(reason, '')
      if (!reason) {
        throw Fault.create('cortex.accessDenied.supportReasonRequired', { reason: 'Support script execution requires a reason.' })
      }

      const { Org } = models,
            org = await Org.loadOrg(env),
            pinnedAccount = rString(pathTo(org, 'support.pinnedAccount'), '').toLowerCase(),
            loginAs = rString(account, '').toLowerCase()

      if (org.state !== 'enabled') {

        throw Fault.create('cortex.invalidArgument.envDisabled')

      } else if (pathTo(org, 'support.disableSupportLogin')) {

        throw Fault.create('cortex.accessDenied.supportDisabled')

      } else if (pinnedAccount && loginAs !== pinnedAccount) {

        throw Fault.create('cortex.accessDenied.supportPinned')

      } else {

        const supportPrincipal = await ap.create(org, account),
              supportAc = new acl.AccessContext(supportPrincipal, null),
              scriptRunner = modules.sandbox.sandboxed(
                supportAc,
                scriptSource,
                {
                  compilerOptions: {
                    type: 'route'
                  }
                },
                args
              ),
              metadata = {
                by: (rString(pathTo(script.ac.principal, 'name.first'), '') + ' ' + rString(pathTo(script.ac.principal, 'name.last'), '')).trim(),
                as: (rString(pathTo(supportPrincipal, 'name.first'), '') + ' ' + rString(pathTo(supportPrincipal, 'name.last'), '')).trim(),
                reason
              }

        let err, result, eventId

        try {
          eventId = await promised(
            modules.audit,
            'recordEvent',
            supportAc,
            'support',
            'script',
            { context: { object: 'account', _id: supportPrincipal._id }, metadata }
          )
        } catch (e) {
          void e
        }

        try {
          result = await promised(null, scriptRunner)
        } catch (e) {
          err = e
        }

        if (err) {
          try {
            await promised(
              modules.audit,
              'updateEvent',
              eventId,
              { err }
            )
          } catch (e) {
            void e
          }
        }

        if (err) {
          throw err
        }
        return result

      }

    }
  },

  findOperations: {

    description: 'Find runtime operations',
    params: [
      'filter {Object}'
    ],
    handler: function(script, filter) {

      return new Promise((resolve, reject) => {

        modules.runtime.clusterFind(
          fixFilter(script, filter),
          (err, result) => {
            err ? reject(err) : resolve(result)
          }
        )
      })

    }

  },

  cancelOperations: {

    description: 'Cancel runtime operations. only on internal domains',
    params: [
      'filter {Object}'
    ],
    handler: function(script, filter) {

      if (config('app.domain') === 'market') {
        throw Fault.create('cortex.accessDenied.unspecified', { reason: 'cannot manipulate operations in the market domain.' })
      }

      return new Promise((resolve, reject) => {

        modules.runtime.clusterCancel(
          fixFilter(script, filter),
          (err, result) => {
            err ? reject(err) : resolve(result)
          }
        )
      })

    }
  },

  isMaster: {

    description: 'Check if current node is the master.',
    handler: function() {

      return apiService.isMaster
    }

  },

  loadOrg: {

    description: 'load org on instance(s).',
    params: [
      'code {String} org code or id.',
      'endpoint {String} optional server endpoint. if blank, calls all endpoints.'
    ],
    handler: function(script, code, endpoint) {

      return new Promise((resolve, reject) => {

        apiService.command('api.debug.loadOrg', { endpoint, body: { code } }, (err, result) => {

          err ? reject(err) : resolve(result)

        })
      })

    }

  },

  getRuntimeSize: {

    description: 'load org on instance(s).',
    params: [
      'code {String} org code or id.',
      'endpoint {String} optional server endpoint. if blank, calls all endpoints.'
    ],
    handler: function(script, code, endpoint) {

      return new Promise((resolve, reject) => {

        apiService.command('api.debug.getRuntimeSize', { endpoint, body: { code } }, (err, result) => {

          err ? reject(err) : resolve(result)

        })
      })

    }

  },

  gc: {

    description: 'force gc on instance(s).',
    params: [
      'endpoint {String} optional server endpoint. if blank, calls all endpoints.'
    ],
    handler: function(script, endpoint) {

      return new Promise((resolve, reject) => {

        apiService.command('api.debug.gc', { endpoint }, (err, result) => {

          err ? reject(err) : resolve(result)

        })
      })

    }

  },

  cpuinfo: {

    description: 'cpu info for node process and sandboxes.',
    params: [
      'usePs {Boolean=false} optional flag. If true, will use ps internally, otherwise it will use stat.'
    ],
    initialize: function() {

      function ps(name, pid, usePs) {

        return pidusage(pid, { usePs })
          .then((stats) =>
            Object.assign({ name }, stats)
          )
      }

      apiService.addCommand('api.debug.cpuinfo', (payload, callback) => {

        let err
        const { usePs } = payload || {}

        Promise
          .all([

            ps('node', process.pid, usePs),

            ...modules.sandbox._pool.hosts
              .map(host => {
                const { id, connection: { process: { pid } = {} } = {} } = host
                if (id && pid) {
                  return { name: `sandbox ${id}`, pid }
                }
              })
              .filter(v => v)
              .map(
                ({ name, pid }) => ps(name, pid, usePs))

          ])

          .catch(e => {
            err = e
          })
          .then(result => {
            callback(err, result)
          })

      })

    },

    handler: function(script, options) {

      const { endpoint, usePs = false } = options || {}

      return new Promise((resolve, reject) => {
        apiService.command('api.debug.cpuinfo', { endpoint, body: { usePs } }, (err, result) => {
          err ? reject(err) : resolve(result)
        })
      })

    }

  },

  perf: {

    description: 'Performance tracking',
    params: [
      'options.monitor {Boolean} start/stop.'
    ],
    initialize: function() {

      const perfData = {
        monitor: null
      }

      apiService.addCommand('api.debug.perf', (payload, callback) => {

        const { monitor } = payload || {}

        function getResult(m) {
          return m && {
            max: m.max / 1e+6,
            min: m.min / 1e+6,
            mean: m.mean / 1e+6,
            percentiles: m.percentiles,
            stddev: m.stddev / 1e+6
          }
        }

        let result = getResult(perfData.monitor)

        if (monitor === true) {
          if (!perfData.monitor) {
            perfData.monitor = perfHooks.monitorEventLoopDelay()
          }
          perfData.monitor.enable()
        } else if (monitor === false) {
          if (perfData.monitor) {
            perfData.monitor.disable()
            perfData.monitor.reset()
          }
        }

        callback(
          null,
          result
        )

      })

    },

    handler: function(script, options) {

      const { endpoint, monitor = null } = options || {}

      return new Promise((resolve, reject) => {

        apiService.command('api.debug.perf', { endpoint, body: { monitor } }, (err, result) => {

          err ? reject(err) : resolve(result)

        })
      })

    }

  },

  lag: {

    description: 'Manage tracking event loop lag',
    params: [
      'options.active {Boolean=null} if set, turns on/off tracking.'
    ],

    initialize: function() {

      let enabled = config('debug.measureEventLoopLapOnStartup'),
          timer,
          timing

      function measureLag() {
        if (!timer) {
          const ticker = timing.begin()
          timer = setTimeout(() => {
            timer = null
            ticker.end()
            if (enabled) {
              measureLag()
            }
          })
          timer.unref()
        }
      }

      if (enabled) {
        timing = new Timing()
        measureLag()
      }

      apiService.addCommand('api.debug.lag', (payload, callback) => {

        const { active } = payload || {}

        if (isBoolean(active)) {
          if (active && !enabled) {
            enabled = true
            timing = new Timing()
            measureLag()
          } else if (!active) {
            enabled = false
          }
        }

        callback(null, timing && timing.toJSON())

      })

    },

    handler: function(script, options) {

      const { endpoint, active = null } = options || {}

      return new Promise((resolve, reject) => {

        apiService.command('api.debug.lag', { endpoint, body: { active } }, (err, result) => {
          err ? reject(err) : resolve(result)

        })
      })

    }

  },

  asyncs: {

    description: 'Manage tracking async operations',
    params: [
      'options.endpoint {String} endpoint name.',
      'options.active {Boolean=null} if set, turns on/off tracking.',
      'options.stacks {Boolean=null} if set, turns on/off stack trace collection (expensive).'
    ],
    initialize: function() {

      let captureStacks = config('debug.asyncTrackingCaptureStackTraces')

      const index = new Map(),
            hook = asyncHooks.createHook({
              init(asyncId, type, triggerAsyncId, resource) {

                if (!asyncHooksMap.has(type)) {
                  asyncHooksMap.set(type, new Map())
                }

                const stack = captureStacks
                  ? new Error().stack.split('\n').map(v => v.trim()).filter(v => v.indexOf('at') === 0).map(v => v.slice(3))
                  : Undefined

                asyncHooksMap.get(type).set(asyncId, { type, stack })
                index.set(asyncId, type)

              },
              destroy(asyncId) {

                const type = index.get(asyncId)

                index.delete(asyncId)
                if (asyncHooksMap.has(type)) {
                  asyncHooksMap.get(type).delete(asyncId)
                }

              },
              promiseResolve(asyncId) {

                const type = index.get(asyncId)

                index.delete(asyncId)
                if (asyncHooksMap.has(type)) {
                  asyncHooksMap.get(type).delete(asyncId)
                }

              }
            })

      if (config('debug.activeAsyncTrackingOnStartup')) {
        hook.enable()
      }

      apiService.addCommand('api.debug.asyncs', (payload, callback) => {

        const { active, stacks, full } = payload || {}

        if (active === false) {
          hook.disable()
          asyncHooksMap.clear()
        } else if (active === true) {
          hook.enable()
          asyncHooksMap.clear()
        }

        if (isBoolean(stacks)) {
          captureStacks = stacks
        }

        callback(
          null,
          Array.from(asyncHooksMap.entries())
            .reduce(
              (memo, [key, map]) => {
                return Object.assign(memo, { [key]: full ? Array.from(map.values()) : map.size })
              },
              {}
            )
        )

      })

    },

    handler: function(script, options) {

      const { endpoint, active = null, full = false } = options || {}

      return new Promise((resolve, reject) => {

        apiService.command('api.debug.asyncs', { endpoint, body: { active, full } }, (err, result) => {

          err ? reject(err) : resolve(result)

        })
      })

    }

  },

  getWorkerQueueOptions: {

    description: 'Get worker queue options',
    params: [
      'endpoint {String} endpoint name.'
    ],
    handler: function(script, endpoint) {

      return new Promise((resolve, reject) => {

        apiService.command('queue.worker.getOptions', { endpoint }, (err, result) => {

          err ? reject(err) : resolve(result)

        })
      })

    }

  },

  setWorkerQueueOptions: {

    description: 'Set worker queue options',
    params: [
      'options {Object} options.',
      'endpoint {String} endpoint name.'
    ],
    handler: function(script, options, endpoint) {

      return new Promise((resolve, reject) => {

        apiService.command('queue.worker.setOptions', { endpoint, body: options }, (err, result) => {

          err ? reject(err) : resolve(result)

        })
      })

    }

  },

  heapSnapshot: {

    description: 'Create a heap snapshot for a specific endpoint',
    params: [
      'endpoint {String} endpoint name.'
    ],
    initialize: function() {

      apiService.addCommand('api.debug.heapSnapshot', (payload, callback) => {

        const filename = path.join(serviceRoot, 'api.heapsnapshot'),
              fileWritten = writeHeapSnapshot(filename)

        callback(null, fileWritten)

      })

    },
    handler: function(script, endpoint) {

      return new Promise((resolve, reject) => {

        apiService.command('api.debug.heapSnapshot', { endpoint }, (err, result) => {

          err ? reject(err) : resolve(result)

        })
      })

    }

  },

  getSnapshot: {

    description: 'Get a heap snapshot for a specific endpoint and remove it once streamed.',
    params: [
      'endpoint {String} endpoint name.'
    ],
    initialize: function() {

      apiService.addCommand('api.debug.getHeapSnapshot', (payload, callback) => {

        const filename = path.join(serviceRoot, 'api.heapsnapshot'),
              stream = createReadStream(filename)

        stream.pause()
        callback(null, stream)

      })

    },
    handler: function(script, endpoint) {

      return new Promise((resolve, reject) => {

        apiService.command('api.debug.getHeapSnapshot', { endpoint, stream: true }, (err, result) => {

          if (result && result.pause) {
            result.pause()
          }
          err ? reject(err) : resolve(result)

        })
      })

    }

  },

  getProviderMemoryUsage: {

    description: 'get apn worker mem usage on instance(s).',
    params: [
      'endpoint {String} optional server endpoint. if blank, calls all endpoints.'
    ],
    handler: function(script, endpoint) {

      return new Promise((resolve, reject) => {

        apiService.command('api.debug.getProviderMemoryUsage', { endpoint }, (err, result) => {

          err ? reject(err) : resolve(result)

        })
      })

    }

  },

  getEndpoints: {

    description: 'List running cluster endpoints.',
    handler: function() {

      const master = apiService.master
      return apiService.endpoints.map(v => {
        if (v.name === master) {
          v.isMaster = true
        }
        return v
      })
    }

  },

  shutdown: {

    description: 'Forcibly shutdown endpoints by name.',
    params: [
      'endpoints {String[]} An array of endpoint names.'
    ],
    initialize: function() {

      apiService.addCommand('sys.shutdown', (payload, callback) => {
        process.kill(process.pid, 'SIGINT')
        callback()
      })

    },
    handler: function(script, endpoints) {

      return promised(
        async,
        'reduce',
        toArray(endpoints, isSet(endpoints)),
        {},
        (memo, endpoint, callback) => {
          apiService.command('sys.shutdown', { endpoint }, err => {
            memo[endpoint] = err ? err.toJSON() : true
            callback(null, memo)
          })

        }
      )
    }

  },

  readOrg: {

    description: 'Get org config.',
    params: [
      'org {ObjectID|String} The org id or code to read. This can read certain things that crossOrg() cannot.',
      'options {Object} {paths, include, expand}'
    ],
    handler: function(script, orgCodeOrId, options) {

      return promised(modules.org, 'readOrg', script.ac, orgCodeOrId, options)
    }

  },

  updateOrg: {

    description: 'Update org config.',
    params: [
      'org {ObjectID|String} The org id or code to update.',
      'payload {Object}'
    ],
    handler: function(script, orgCodeOrId, payload) {

      return promised(modules.org, 'updateOrg', script.ac, orgCodeOrId, payload, {})
    }

  },

  genRsaKeyPair: {
    description: 'Generate an RSA key pair.',
    handler: async function() {

      const { pub, priv } = await promised(modules.authentication, 'genRsaKeypair')
      return { public: pub, private: priv }

    }
  },

  crash: {

    description: 'Crash the current instance.',
    params: [
      'err {Object} the error.',
      'timeout {Number = 1000} time to wait.'
    ],
    handler: async function(script, err, timeout = 1000) {

      setTimeout(() => {
        throw Fault.from(err, false, true)
      }, timeout)

    }

  },

  getMetrics: {
    description: 'Returns service metrics from all cortex instances.',
    handler: function(script, options) {

      return promised(apiService, 'clusterGetMetrics', options)
    }
  },

  getConfig: {
    description: 'Get config item value from cluster.',
    params: [
      'path {String} config property path.'
    ],
    handler: function(script, path) {

      return promised(apiService, 'clusterGetConfig', path)
    }
  },

  setConfig: {
    description: 'Set config item value in cluster.',
    params: [
      'path {String} config property path.',
      'value {*} Config proeprty value.'
    ],
    handler: function(script, path, value) {

      return promised(apiService, 'clusterSetConfig', path, value)
    }
  },

  profile: {
    description: 'report or reset profiler',
    params: [
      'command {String} "reset" to reset profiler'
    ],
    handler: async function(script, what) {

      if (what === 'reset') {
        return promised(apiService, 'command', 'metrics.profile.reset')
      }

      const results = await promised(apiService, 'command', 'metrics.profile.whats')

      return Object.entries(
        Object.entries(results || {}).reduce((report, [host, whats]) => {
          if (!Fault.from(whats)) {
            for (let [name, value] of Object.entries(whats)) {
              if (!report[name]) {
                report[name] = value
              } else {
                for (let [k, v] of Object.entries(value)) {
                  if (report[name][k] === undefined || report[name][k] === null) {
                    report[name][k] = v
                  } else {
                    report[name][k] += v
                  }
                }
              }
            }
          }
          return report
        }, {})
      ).map(([name, value]) => {
        const { count, ms } = value
        return {
          name,
          avg: (ms / count).toFixed(3),
          count,
          ms
        }
      })
        .sort((a, b) => Number(b.avg) - Number(a.avg))
        .map(v => `${v.avg} - ${v.name}. count: ${v.count}, total: ${v.ms.toFixed(3)}`)

    }

  },

  getNodeActivity: {
    description: 'Returns node activity for an org on all running api pods',
    params: [
      'org {String} org code or id'
    ],
    handler: async function(script, orgCodeOrId) {

      const org = await promised(modules.org, 'readOrg', script.ac, orgCodeOrId, { paths: '_id' })
      return promised(apiService, 'clusterGetActivity', org._id)
    }
  },

  closeRequest: {
    description: 'Removes a request from the running list',
    params: [
      'reqId',
      'options {Object} {org, force}'
    ],
    handler: async function(script, reqId, { org, force } = {}) {
      return promised(apiService, 'clusterCloseRequest', reqId, { org, force })
    }
  },

  runNow: {
    description: 'Run a scheduled api job now. careful!!!',
    params: [
      'job (property-reaper storage-calculator daily-logins account-numbers script-transaction-reaper instance-reaper)'
    ],
    handler: function(script, job) {

      return promised(modules.workers, 'runNow', job)
    }

  },

  numQueuedMessages: {
    description: 'Count the number of total queued messages',
    params: [
      'options {Object}',
      'options.grouped {Boolean=false} if true, groups by org, worker, name'
    ],
    handler: function(script, options) {

      return promised(modules.workers.mq, 'count', options)
    }

  },

  cancelWorker: {
    description: 'Cancel an in-flight worker by message name or id. Returns a list of cancelled messages.',
    params: [
      'identifier {String|ObjectID} The job name or message id.'
    ],
    handler: async function(script, identifier) {

      return promised(modules.workers, 'clusterCancelWorker', identifier)

    }

  },

  reconcileStats: {
    description: 'Reconcile stats deltas for an org env on demand.',
    params: [
      'identifier {String|ObjectID} Org env code or id',
      'days {Number=120} the number of days back to search for un-reconciled stats.',
      `force {Boolean=false} for running this even if config('scheduled.storage-calculator.reconcile') is false`
    ],
    handler: async function(script, identifier, days = 120, force = false) {

      if (force || config('scheduled.storage-calculator.reconcile')) {

        const org = await models.Org.loadOrg(identifier)
        return promised(models.Stat, 'reconcile', org._id, { days: rInt(days, 120) })
      }
      return false
    }

  },

  convertStatLogs: {
    description: 'Takes old stats log formatted updates and inserts them as un-reconciled stats. returns the number processed.',
    params: [
      `options {Object} [ force {Boolean} for running this even if config('scheduled.storage-calculator.reconcile') is true]`
    ],
    handler: async function(script, options) {

      options = options || {}

      if (options.force || !config('scheduled.storage-calculator.reconcile')) {

        const { StatsGroup } = models.Stat,
              statsGroup = new StatsGroup(),
              { fileStorage, docStorage } = consts.operations.codes,
              batchSize = 1000,
              docs = await models.StatLog.collection.find({ code: { $in: [fileStorage, docStorage] } }).limit(batchSize).toArray(),
              $in = docs.map(v => v._id)

        for (const doc of docs) {

          const {
                  code,
                  org,
                  was: {
                    size: oldSize = 0
                  } = {},
                  is: {
                    s_source: source,
                    s_object: object,
                    s_type: type,
                    s_property: property,
                    count,
                    size: newSize = 0
                  } = {} } = doc,
                startOfPeriod = idToTimestamp(doc._id)

          // some old logs have bad stats.
          if (org) {
            statsGroup.add(code, org, source, object, type, property, count, newSize - oldSize, startOfPeriod)
          }

        }

        statsGroup.save()

        await models.StatLog.collection.deleteMany({ _id: { $in } })

        return docs.length

      }
      return false
    }
  },

  nativeCursor: {
    description: 'Get a native cursor to an allowed collection.',
    params: [
      'collectionName {String} The collection name.',
      `pipeline {Object[]} pipeline stages`,
      `params {Object} { readPreference, cursor: { batchSize }, explain, allowDiskUse, maxTimeMS }`
    ],
    handler: async function(script, collectionName, pipeline, params) {

      const allowedCollections = ['logs', 'stats', 'statlogs', 'locations'],
            allowedStages = '$collStats $project $match $redact $limit $skip $unwind $group $sample $sort $facet $bucket $bucketAuto $sortByCount $addFields $replaceRoot $count'.split(' ')

      if (allowedCollections.includes(collectionName)) {

        const stages = toArray(pipeline),
              collection = await connection.db.collection(collectionName),
              options = pick((params || {}), 'readPreference', 'cursor', 'explain', 'allowDiskUse', 'maxTimeMS')

        for (const stage of stages) {
          const keys = Object.keys(stage)
          if (keys.length !== 1) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'pipeline stage must have a single key.' })
          } else if (!allowedStages.includes(keys[0])) {
            throw Fault.create('cortex.accessDenied.unspecified', { reason: `${keys[0]} pipeline stage is unsupported.` })
          }
        }

        return new NativeDocumentCursor(collection.aggregate(stages, options))

      }

      throw Fault.create('cortex.accessDenied.unspecified', { reason: 'collection does not exist or is inaccessible.' })

    }

  },

  // user-land -----------------------------------------------------------------------------

  syncEnvironment: {
    description: 'Sync/rebuild the environment runtime.',
    params: [
      'options (Object) throwError=true, logError=false, save=true, synchronizeJobs=true, reparseResources=false'
    ],
    orgs: ['*'],
    roles: config('app.env') === 'production' ? ['administrator'] : ['administrator', 'developer'],
    handler: async function(script, options) {

      options = options || {}

      let ac = script.ac

      if (ac.principal.isSysAdmin() && isSet(options.env)) {
        ac = new acl.AccessContext(
          ap.synthesizeOrgAdmin(
            await promised(models.Org, 'loadOrg', options.env)
          )
        )
      }

      return ac.org.syncEnvironment(ac, {
        throwError: rBool(options.throwError, true),
        logError: rBool(options.logError, false),
        save: rBool(options.save, true),
        reparseResources: rBool(options.reparseResources, false),
        synchronizeJobs: rBool(options.synchronizeJobs, true)
      })
    }
  },

  refreshOrg: {
    description: 'refresh the org.',
    params: [
      'preserve (Array)'
    ],
    orgs: ['*'],
    domains: ['medable', 'local'],
    roles: config('app.env') === 'production' ? ['administrator'] : ['administrator', 'developer'],
    handler: async function(script, preserve) {

      return modules.org.refreshOrg(
        script.ac,
        preserve
      )

    }
  },

  repairUploads: {

    orgs: ['*'],
    roles: config('app.env') === 'production' ? ['administrator'] : ['administrator', 'developer'],
    handler: async function(script, objectName, instanceId, propertyName) {

      const { ac: { reqId, orgId, principal, org } } = script,
            report = [],
            Model = await org.createObject(objectName),
            instance = await promised(Model, 'aclLoad', principal, {
              where: { _id: getIdOrNull(instanceId) },
              include: [propertyName],
              forceSingle: true,
              json: false,
              skipAcl: true,
              grant: acl.AccessLevels.Script
            })

      visit(instance.$raw, {
        fnObj: (obj, currentKey, parentObject, parentIsArray, depth, fullpath) => {
          if (currentKey === 'meta' &&
            Array.isArray(obj) &&
            [consts.media.states.pending, consts.media.states.ready].includes(parentObject.state)
          ) {

            if (parentObject.location === consts.LocationTypes.AwsS3Upload) {

              const awsMeta = obj.find(v => v.name === 'awsId')
              if (awsMeta) {

                const job = {
                  org: orgId,
                  level: 'facet',
                  key: awsMeta.value,
                  size: parentObject.size
                }

                modules.workers.send('uploads', 'media-processor', job, { reqId, orgId })

                report.push({
                  message: `found aws upload`,
                  path: fullpath
                })

              }

            } else if (parentObject.location === consts.LocationTypes.UploadObject) {

              const awsMeta = obj.find(v => v.name === 'awsId')
              if (awsMeta) {

                const job = {
                  org: orgId,
                  level: 'facet',
                  key: awsMeta.value,
                  size: parentObject.size
                }

                modules.workers.send('uploads', 'media-processor', job, { reqId, orgId })

                report.push({
                  message: `found upload object`,
                  path: fullpath
                })

              }

            }

          }
        }
      })

      return report

    }

  },

  runScheduledJob: {
    description: 'Trigger a scheduled job to run as soon as possible.',
    params: [
      'jobName {String} The job resource name from runtime.metadata.resource (eg. example-env.script#type(library).name(c_maintenance).runtime.@job 41:2).'
    ],
    orgs: ['*'],
    roles: config('app.env') === 'production' ? ['administrator'] : ['administrator', 'developer'],
    handler: async function(script, jobName) {

      try {

        const result = modules.workers.runScheduledJob(script.ac.org, jobName),
              value = result && result.value

        return isSet(value)

      } catch (err) {

        return false

      }
    }

  },

  tail: {
    description: 'Create a streaming cursor to the console logger',
    params: [
      'name {String} the log type [console]'
    ],
    orgs: ['*'],
    domains: ['*'],
    environment: ['*'],
    roles: config('app.env') === 'production' ? ['administrator'] : ['administrator', 'developer'],
    initialize: function() {

      system.tails = new Map()

      function cleanup() {
        for (const [cursor, stream] of system.tails) {
          try {
            stream.destroy(err => {
              void err
            })
          } catch (err) {
            void err
          }
          try {
            cursor.end(Fault.create('cortex.error.aborted', { reason: 'Server closed the output stream.' }))
          } catch (err) {
            void err
          }
        }
        system.tails.clear()
      }

      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)

    },
    handler: async function(script, name = 'console', { level = 'silly' } = {}) {

      if (!script.ac.principal.isSysAdmin()) {
        name = 'console'
      }
      if (config('app.env') === 'production' && config('app.domain') === 'market') {
        throw Fault.create('cortex.accessDenied.unspecified', { reason: 'console logging not enabled in production' })
      }

      switch (name) {

        case 'cortex': {

          const cursor = new WritableOutputCursor(),
                stream = new Transform({
                  objectMode: true,
                  transform(chunk, encoding, callback) {
                    this.push(chunk)
                    callback()
                  }
                }),
                transport = new logger.transports.Stream({
                  stream,
                  level
                })

          cursor.on('error', () => {
            logger.remove(transport)
            system.tails.delete(cursor)
          })
          cursor.on('close', () => {
            logger.remove(transport)
            system.tails.delete(cursor)
          })

          cursor.fromStream(stream)
          cursor.flushOnWrite = true

          logger.add(transport)
          system.tails.set(cursor, stream)
          return cursor

        }

        case 'console': {

          const stream = models.Console
                  .find({ org: script.ac.orgId, date: { $gt: new Date() } })
                  .sort({ $natural: 1 })
                  .tailable({ awaitdata: true })
                  .lean()
                  .cursor(),
                cursor = new WritableOutputCursor({ readTransform: document => {
                  return {
                    timestamp: document.date,
                    level: document.level,
                    message: deserializeObject(document.message)
                  }
                } })

          cursor.on('error', () => {
            system.tails.delete(cursor)
            try {
              stream.close((err) => {
                void err
              })
            } catch (err) {
              void err
            }
          })
          cursor.on('close', () => {
            system.tails.delete(cursor)
            try {
              stream.close((err) => {
                void err
              })
            } catch (err) {
              void err
            }
          })

          cursor.fromStream(stream)
          cursor.flushOnWrite = true

          system.tails.set(cursor, stream)
          return cursor

        }

        default:

          throw Fault.create('cortex.notImplemented.unspecified')
      }

    }
  }

  // handler: {
  //   description: '',
  //   params: [
  //   ],
  //   // initialize: () => {
  //   //
  //   // },
  //   // orgs: ['medable'],
  //   // envs: ['development', 'production'],
  //   // domains: ['medable', 'market'],
  //   // roles = ['administrator']
  //   handler: function(script, optionsOrId, callback) {
  //
  //   }
  // }

}

// --------------------------------------------------------------------------------

addCommand(
  'updateDocumentSizes',
  `Updates document size where updates are required, adding them to the operations log for storage calculation.
        @param org
        @param options            
            limit (10,000): stop after this number of modifications (may be set to false to continue until complete)
            batchSize (10,000): limit to a batch size.                               
            writeConcern ('majority'): the mongodb write concern
            readPreference ('secondary')
            wTimeout (1000): write concern timeout
            journal (true): write concern journal
            continueOnError (false): if true, adds an errors array and tolerates errors. invalid argument errors will still be at the top level.            
    `,
  function(script, org, options, callback) {

    options = options || {}

    models.org.loadOrg(org, function(err, org) {
      if (err) {
        return callback(err)
      }
      modules.storage.updateDocumentSizes(org, options, callback)
    })
  }
)

addCommand(
  'calculateStorage',
  `Recalculate point-in-time storage for the last period. Can mess up new cumulative updates.
        @param org                                                                             
    `,
  function(script, org, options, callback) {

    options = options || {}

    models.org.loadOrg(org, function(err, org) {
      if (err) {
        return callback(err)
      }
      const arr = later.schedule(later.parse.cron(config('scheduled.storage-calculator.cron'))).prev(2),
            starting = arr[1],
            ending = arr[0]

      ending.setMilliseconds(-1)

      modules.storage.recalculateStorage(org, starting, ending, callback)
    })
  }
)

addCommand(
  'rebuildObjectSlots',
  'Rebuilds all index slots for an org object. rebuildObjectIndexes should be call afterwords (options{org: org, object: object})',
  function(script, options, callback) {

    options = options || {}

    models.org.createObject(options.object, options.org, function(err, { model, org }) {

      if (err) {
        return callback(err)
      }

      models.object.findOne({ org: org._id, name: model.objectName, reap: false }).exec(function(err, doc) {

        if (err || !doc) {
          return callback(err)
        }

        const updated = [],
              ac = new acl.AccessContext(ap.synthesizeOrgAdmin(org), doc)
        doc.schema.node.walkDocument(doc, function(parentDocument, node) {
          if (node.name === 'indexed') {
            node._registerIndexUpdate(ac, parentDocument)
            updated.push(`${node.parent.fqpp} (${modules.db.definitions.getInstancePath(parentDocument, node)})`)
          }
        })
        doc.markModified('slots')
        ac.markSafeToUpdate(doc.schema.node.properties.slots)
        ac.save((err, modified) => {
          callback(err, (!err && modified.length) ? updated : [])
        })

      })

    })

  }
)

addCommand(
  'checkIndexes',
  `Gathers a report that outlines any changed required based on differences between the api index specifications and actual database indexes.`,
  function(script, callback) {
    modules.db.definitions.ensureIndexes(true, callback)
  }
)

addCommand(
  'resetContextIndexes',
  `Rebuild context indexes for a named collection. DO NOT run on real servers.
  @param collectionName
  @param options
    modelName      - name of a built-in model. defaults to null.
    selectIndexes  - only create selected indexes
    dropIndexes    - drops all current indexes. default false
    dryRun         - only gets selected indexes. does not run. default true
  `,
  function(script, collectionName, options, callback) {
    modules.db.connection.db.collection(collectionName, { strict: true }, (err, collection) => {
      if (err || collection.collectionName === 'contexts') { // just in case!
        return callback(err, err || Fault.create('cortex.accessDenied.unspecified', { reason: 'you cannot act on the contexts collection.' }))
      }
      modules.db.definitions.resetContextIndexes(collection, options, callback)
    })
  }
)

addCommand(
  'ensureObjectIndexes',
  `Ensure contexts for object instance are built.
    @param options
      
      drop existing indexes first.
  `,
  function(script, org, object, options, callback) {

    models.org.createObject(object, org, function(err, { model, org }) {
      if (err) {
        return callback(err)
      }
      model.schema.node.ensureIndexes(options, callback)
    })

  }
)

// in non-critical environments, allow updating.
if (!(config('server.apiHost') === 'api.medable.com' || config('server.apiHost') === 'api.dev.medable.com')) {
  addCommand(
    'ensureIndexes',
    `Ensures indexes are up to date. This only runs in non-production environments.`,
    function(script, callback) {
      modules.db.definitions.ensureIndexes(false, callback)
    }
  )
}

/**
 * @param options
 *  org - org
 *  object - object name
 *  lastId - _id of the last processed document.
 *  limit - 1000
 *  batchLimit - 50
 *  sequenceRetries - 10
 *  dryRun - false
 *  ids: false
 * @param callback -> err, {count: (Number), modified: (Number), lastId: (ObjectId), done: (Boolean), faults: []}
 */
addCommand(
  'rebuildObjectIndexes',
  'Incrementally rebuilds indexes for an org object. ( options{org, object, lastId: _id of the last processed document, limit: 1000, batchLimit: 50, sequenceRetries: 10, dryRun: false, ids: false. true to get a list of updated ids back.} )',
  function(script, options, callback) {

    options = options || {}

    models.org.createObject(options.object, options.org, function(err, { model, org }) {

      if (err) {
        return callback(err)
      }

      const limit = queryLimit(options.limit, false, 1000, 1000),
            batchLimit = queryLimit(options.batchLimit, false, 50, 100),
            sequenceRetries = queryLimit(options.sequenceRetries, false, 10, 100),
            principal = ap.synthesizeOrgAdmin(org),
            lastId = getIdOrNull(options.lastId),
            find = { org: org._id, object: model.objectName, reap: false },
            propertyPaths = [],
            properties = [],
            root = model.schema.node,
            slots = root.slots

      let select, len = slots.length
      while (len--) {
        let slot = slots[len], property = root.findNodeById(slot._id)
        if (property) {
          propertyPaths.push(property.fullpath)
          properties.push(property)
        }
      }
      select = root.selectPaths(principal, { paths: propertyPaths.concat('idx') })

      if (lastId) {
        find._id = { $gt: lastId }
      }

      model.find(find).select('_id').sort({ _id: 1 }).limit(limit).lean().exec((err, docs) => {

        if (err) {
          return callback(err)
        }

        const result = {
          count: docs.length,
          modified: 0,
          lastId: docs.length > 0 ? docs[docs.length - 1]._id : null,
          done: docs.length === 0,
          faults: []
        }
        if (options.dryRun) {
          result.not_modified = 0
          delete result.modified
        }
        if (options.ids) {
          result.ids = []
        }

        async.eachLimit(docs, batchLimit, (doc, callback) => {

          modules.db.sequencedFunction(function(callback) {

            const find = { _id: doc._id, reap: false },
                  ac = new acl.AccessContext(principal)

            model.findOne(find).select(select).exec(function(err, doc) {

              if (err || !doc) {
                return callback(err)
              }

              modules.db.definitions.prepIndex(doc)

              properties.forEach(function(property) {
                try {
                  property._rebuildPropertyIndex(doc)
                } catch (err) {
                  result.faults.push(extend(err.toJSON(), { _id: doc._id }))
                }
              })

              if (!doc.isModified()) {
                return callback()
              }
              if (options.ids) {
                result.ids.push(doc._id)
              }
              if (options.dryRun) {
                result.not_modified++
                return callback()
              }
              ac.lowLevelUpdate({ subject: doc }, err => {
                if (!err) {
                  result.modified++
                }
                callback(err)
              })

            })

          }, sequenceRetries, function(err) {
            if (err) {
              result.faults.push(extend(err.toJSON(), { _id: doc._id }))
            }
            callback()
          })
        }, function(err) {
          callback(err, result)
        })

      })

    })
  }
)

addCommand(
  'provisionOrg',
  'Provision an org. pass org, account, options {validateOrgCode: null, maxApps: 2, validateOnly: false, minPasswordScore: 2, accountPassword: null}',
  function(script, orgInput, accountInput, options, callback) {

    modules.org.provision(orgInput, accountInput, options, callback)

  }

)

addCommand(
  'startExport',
  'Start an export sans worker, directly.',
  function(script, orgId, exportId, callback) {

    if (activelyRunningExports[exportId]) {
      return callback()
    }
    activelyRunningExports[exportId] = 1

    const ExportInstance = require('../../../workers/workers/exporter').ExportInstance

    async.waterfall([

      callback => {
        models.org.loadOrg(orgId, function(err, org) {
          callback(err, org)
        })
      },
      (org, callback) => {
        models.export.findOne({ org: org._id, _id: getIdOrNull(exportId) }, function(err, exp) {
          if (!err && !exp) {
            err = Fault.create('cortex.notFound.unspecified', { reason: 'Export object ' + getIdOrNull(exportId) + ' does not exist' })
          }
          callback(err, org, exp)
        })
      },
      (org, exp, callback) => {
        modules.aws.getLocation(org, consts.LocationTypes.AwsS3, exp.location, (err, location) => {
          callback(err, org, exp, location)
        })
      },
      (org, exp, location, callback) => {
        ap.create(org, getIdOrNull(exp.creator._id), { type: acl.AccessTargets.Account }, (err, principal) => {
          void err
          principal = principal || ap.synthesizeAnonymous(org)
          const instance = new ExportInstance({ req: script.ac.reqId }, principal, exp, location)
          instance.process(callback)
        })
      }

    ], (err, result) => {

      delete activelyRunningExports[exportId]

      callback(err, result)

    })

  }
)

addCommand(
  'q',
  'q a test message',
  function(script, payload, withCallback, callback) {

    modules.workers.send(
      'work',
      'test',
      payload,
      {
        reqId: script.ac.reqId,
        orgId: script.ac.org._id
      }
    )
    callback()

  }
)

addCommand(
  'resurrectRefresh',
  `Bring back a broken org refresh using an org Id
        @param orgId (String)        
    `,
  function(script, orgId, callback) {

    orgId = getIdOrNull(orgId)

    async.waterfall([

      callback => {
        models.blob.findOne({ org: orgId, label: 'Refresh Data' }, (err, blob) => {
          if (!err && !blob) {
            err = Fault.create('cortex.notFound.unspecified', { reason: 'Refresh blob not found.' })
          }
          callback(err, blob)
        })
      },

      (blob, callback) => {
        modules.deployment.unzipPayload(blob.data.toString(), (err, refreshData) => {
          callback(err, refreshData)
        })
      },

      (refreshData, callback) => {

        async.parallel([
          callback => {
            models.org.collection.insertOne(refreshData.org, (err, result) => callback(null, (err && err.toJSON()) || result))
          },
          callback => {
            if (!refreshData.accounts) {
              return callback()
            }
            models.account.collection.insertMany(refreshData.accounts, (err, result) => callback(null, (err && err.toJSON()) || result))
          }
        ], callback)

      }

    ], callback)

  }
)

function gate(script, { orgs, envs, roles, hosts, domains } = {}) {

  const { ac: { org: { code, roles: orgRoles }, principal } } = script

  if (!config('sandbox.debug.enableSysModule')) {
    throw Fault.create('cortex.accessDenied.unspecified', { path: 'sys' })
  }

  (orgs => {
    if (['*', code].filter(value => orgs.includes(value)).length === 0) {
      throw Fault.create('cortex.accessDenied.unspecified', { path: 'org' })
    }
  })(toArray(orgs, isSet(orgs)))

  ;(hosts => {
    if (['*', config('server.apiHost')].filter(value => hosts.includes(value)).length === 0) {
      throw Fault.create('cortex.accessDenied.unspecified', { path: 'hosts' })
    }
  })(toArray(hosts, isSet(hosts)))

  ;(domains => {
    if (['*', config('app.domain')].filter(value => domains.includes(value)).length === 0) {
      throw Fault.create('cortex.accessDenied.unspecified', { path: 'domains' })
    }
  })(toArray(domains, isSet(domains)))

  ;(envs => {
    if (['*', config('app.env')].filter(value => envs.includes(value)).length === 0) {
      throw Fault.create('cortex.accessDenied.unspecified', { path: 'env' })
    }
  })(toArray(envs, isSet(envs)))

  ;(roles => {

    if (!roles.find((role) => {

      if (role === '*') {
        return true
      }

      const orgRole = orgRoles.find(valid => valid.code === role || equalIds(valid._id, role))
      return orgRole && principal.hasRole(orgRole._id)

    })) {
      throw Fault.create('cortex.accessDenied.unspecified', { path: 'role' })
    }

  })(toArray(roles, isSet(roles)))

}

function addCommand(name, description, handler) {

  // old style command use callbacks.
  const wrapper = function(script, ...args) {
    return new Promise((resolve, reject) => {
      try {
        args.length = handler.length - 2
        handler(script, ...args, (err, result) => {
          err ? reject(err) : resolve(result)
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  definition[name] = {
    description,
    handler: wrapper
  }

}

if (config('debug.dangerous')) {

  Object.assign(definition, {

    native: {
      description: 'run native code',
      hosts: ['api.qa.medable.com', 'api.edge.medable.com', 'api.local.medable.com', 'api.sas.medable.com'],
      params: [
        'code {String} code to run as "async function(require, script, modules, config){ ... }"'
      ],
      handler: function(script, code) {

        // eslint-disable-next-line no-new-func
        const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor
        return new AsyncFunction('require, script, modules, config', 'callback', code)(require, script, modules, config)

      }
    },

    in: {
      description: 'Run a script in another environment.',
      params: [
        'env {String} environment in which to run the script',
        'account {String|Object} email, service account or account spec',
        'code {String}',
        'args {Object} runtime arguments'
      ],
      orgs: ['*'],
      envs: ['development'],
      domains: ['local'],
      handler: async function(script, env, account, code, args) {

        const { Org } = models,
              org = await Org.loadOrg(env),
              principal = await ap.create(org, account),
              scriptAc = new acl.AccessContext(principal, null),
              scriptRunner = modules.sandbox.sandboxed(
                scriptAc,
                code,
                {
                  compilerOptions: {
                    type: 'route'
                  }
                },
                args
              ),
              result = await promised(null, scriptRunner),
              callingOrg = await Org.loadOrg(script.ac.orgId, { cache: false })

        script.ac.updateOrg(callingOrg)

        return result

      }
    }

  })
}

Object.keys(definition).forEach((name) => {

  const {
          handler,
          initialize,
          orgs = ['medable'],
          hosts = ['*'],
          envs = ['development', 'production'],
          domains = ['local', 'market', 'medable'],
          roles = ['administrator']
        } = definition[name],

        exp = async function(script, message, args) {
          gate(script, { orgs, envs, roles, hosts, domains })
          return handler.call(module.exports, script, ...args)
        }

  if (initialize) {
    initialize()
  }

  exp.$is_var_args = true
  module.exports[name] = exp

})

function fixFilter(script, filter) {

  filter = filter || {}

  visit(filter, {
    fnObj: (obj, currentKey, parentObject, parentIsArray, depth, fullpath) => {},
    fnVal: (obj, currentKey) => {
      if (currentKey.trim().indexOf('$operation') === 0) {
        throw Fault.create('cortex.invalidArgument.query')
      }
    }
  })

  return filter

}
