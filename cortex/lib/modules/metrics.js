'use strict'

const utils = require('../utils'),
      logger = require('cortex-service/lib/logger'),
      consts = require('../consts'),
      modules = require('../modules'),
      { prometheus } = modules,
      { Codes } = require('../modules/sandbox/messages/message-consts'),
      _ = require('underscore'),
      v8 = require('v8'),
      moment = require('moment'),
      StatsD = require('hot-shots')

class MetricsModule {

  constructor() {

    this._active_jobs = new Map()
    this._active_scripts = new Map()
    this._registered_metrics = {}
    this._registered_keys = []
    this._metricsCache = {}
    // datadog client
    this._dd = new StatsD({
      errorHandler: function(error) {
        logger.warn('DataDog error: ', error)
      }
    })

    modules.services.api.addCommand('metrics.profile.whats', (payload, callback) => {
      callback(null, utils.profile.whats)
    })

    modules.services.api.addCommand('metrics.profile.report', (payload, callback) => {
      callback(null, utils.profile.report())
    })

    modules.services.api.addCommand('metrics.profile.reset', (payload, callback) => {
      callback(null, utils.profile.reset())
    })

  }

  register(name, object) {
    this._registered_metrics[name] = { value: object, callable: _.isFunction(object) }
    this._registered_keys.push(name)
  }

  get numActiveRequests() {
    return modules.runtime.db.count({ type: 'request' })
  }

  get activeRequests() {

    return modules.runtime.db.find({ type: 'request' }).map(({ req }) => ({
      _id: req._id,
      org: req.orgId,
      code: req.orgCode,
      log: req.log.toObject()
    }))

  }

  get numActiveJobs() {
    let count = 0
    this._active_jobs.forEach(set => {
      count += set.size
    })
    return count
  }

  get activeJobs() {
    const jobs = []
    this._active_jobs.forEach(set => {
      set.forEach(message => {
        jobs.push({
          _id: message._id,
          org: message.org,
          name: message.name,
          worker: message.worker,
          started: message.started
        })
      })
    })
    return jobs
  }

  get dd() {
    return this._dd
  }

  addRequest(req) {

    const orgId = (req.orgId || '').toString()
    let set = this._active_requests.get(orgId)
    if (!set) {
      set = new Set()
      this._active_requests.set(orgId, set)
    }
    set.add(req)
  }

  addJob(message) {
    const orgId = message.org.toString()
    let set = this._active_jobs.get(orgId)
    if (!set) {
      set = new Set()
      this._active_jobs.set(orgId, set)
    }
    set.add(message)

  }

  removeJob(message) {
    const orgId = message.org.toString(),
          set = this._active_jobs.get(orgId)

    if (set) {
      set.delete(message)
      if (set.size === 0) {
        this._active_jobs.delete(orgId)
      }
    }

  }

  addScript(script) {
    prometheus.getMetric(consts.prometheus.SANDBOX_CURRENT_EXECUTIONS_TOTAL).inc()
    const orgId = script.ac.orgId.toString()
    let set = this._active_scripts.get(orgId)
    if (!set) {
      set = new Set()
      this._active_scripts.set(orgId, set)
    }
    set.add(script)

  }

  removeScript(script) {
    prometheus.getMetric(consts.prometheus.SANDBOX_CURRENT_EXECUTIONS_TOTAL).dec()
    const orgId = script.ac.orgId.toString(),
          set = this._active_scripts.get(orgId)

    if (set) {
      set.delete(script)
      if (set.size === 0) {
        this._active_scripts.delete(orgId)
      }
    }
  }

  cleanupMetricsCache() {
    const expired = {
      job: 0,
      route: 0,
      trigger: 0,
      library: 0
    }

    for (const runId of Object.keys(this._metricsCache)) {
      if (moment().isAfter(this._metricsCache[runId].expires_at)) {
        expired[this._metricsCache[runId].type] += 1
        delete this._metricsCache[runId]
      }
    }

    // Reset gauges if metrics were deleted
    modules.prometheus.getMetric(consts.prometheus.JOBS_BACKLOG_TOTAL).dec(expired.job)
    modules.prometheus.getMetric(consts.prometheus.ROUTES_BACKLOG_TOTAL).dec(expired.route)
    modules.prometheus.getMetric(consts.prometheus.TRIGGERS_BACKLOG_TOTAL).dec(expired.trigger)
    modules.prometheus.getMetric(consts.prometheus.LIBRARY_BACKLOG_TOTAL).dec(expired.library)
  }

  startTracking(runId, type, filename) {
    this.cleanupMetricsCache()
    if (!runId) {
      return
    }
    this._metricsCache[runId] = {
      type,
      filename,
      created_at: moment(),
      expires_at: moment().add(10, 'seconds') // The default histogram max bucket
    }
  }

  stopTracking(message) {
    const metric = this._metricsCache[message.runId]
    if (!metric) {
      return
    }

    switch (metric.type) {
      case 'job':
        modules.prometheus.getMetric(consts.prometheus.JOBS_EXECUTION_DURATION_SECONDS).labels({ filename: metric.filename }).observe(message.stats.runtimeMs / 1000)
        modules.prometheus.getMetric(consts.prometheus.JOBS_EXECUTION_LATENCY_SECONDS).labels({ filename: metric.filename }).observe(moment().diff(metric.created_at, 'milliseconds') / 1000)
        modules.prometheus.getMetric(consts.prometheus.JOBS_BACKLOG_TOTAL).dec()
        break
      case 'route':
        modules.prometheus.getMetric(consts.prometheus.ROUTES_EXECUTION_DURATION_SECONDS).labels({ filename: metric.filename }).observe(message.stats.runtimeMs / 1000)
        modules.prometheus.getMetric(consts.prometheus.ROUTES_EXECUTION_LATENCY_SECONDS).labels({ filename: metric.filename }).observe(moment().diff(metric.created_at, 'milliseconds') / 1000)
        modules.prometheus.getMetric(consts.prometheus.ROUTES_BACKLOG_TOTAL).dec()
        break
      case 'library':
        modules.prometheus.getMetric(consts.prometheus.LIBRARY_EXECUTION_DURATION_SECONDS).labels({ filename: metric.filename }).observe(message.stats.runtimeMs / 1000)
        modules.prometheus.getMetric(consts.prometheus.LIBRARY_EXECUTION_LATENCY_SECONDS).labels({ filename: metric.filename }).observe(moment().diff(metric.created_at, 'milliseconds') / 1000)
        modules.prometheus.getMetric(consts.prometheus.LIBRARY_BACKLOG_TOTAL).dec()
        break
      case 'trigger':
        modules.prometheus.getMetric(consts.prometheus.TRIGGERS_EXECUTION_DURATION_SECONDS).labels({ filename: metric.filename }).observe(message.stats.runtimeMs / 1000)
        modules.prometheus.getMetric(consts.prometheus.TRIGGERS_EXECUTION_LATENCY_SECONDS).labels({ filename: metric.filename }).observe(moment().diff(metric.created_at, 'milliseconds') / 1000)
        modules.prometheus.getMetric(consts.prometheus.TRIGGERS_BACKLOG_TOTAL).dec()
        break

    }
    delete this._metricsCache[message.runId]
  }

  ipcAddMessage(message) {
    try {
      // Keep track of all messages exchanged
      const codeString = Object.keys(Codes).find(key => Codes[key] === message.type)
      modules.prometheus.getMetric(consts.prometheus.SANDBOX_IPC_MESSAGES_TOTAL, { code: codeString }).inc()

      if (message.type === Codes.kScript) {

        const { type, filename } = message.configuration
        prometheus.getMetric(consts.prometheus.SANDBOX_EXECUTIONS_TOTAL).inc({ type: type })
        switch (type) {
          case 'job':
            prometheus.getMetric(consts.prometheus.JOBS_EXECUTION_TOTAL).labels({ filename: filename }).inc()
            prometheus.getMetric(consts.prometheus.JOBS_BACKLOG_TOTAL).inc()
            this.startTracking(message.runId, type, filename)
            break
          case 'route':
            prometheus.getMetric(consts.prometheus.ROUTES_EXECUTION_TOTAL).labels({ filename: filename }).inc()
            prometheus.getMetric(consts.prometheus.ROUTES_BACKLOG_TOTAL).inc()
            this.startTracking(message.runId, type, filename)
            break
          case 'library':
            prometheus.getMetric(consts.prometheus.LIBRARY_EXECUTION_TOTAL).labels({ filename: filename }).inc()
            prometheus.getMetric(consts.prometheus.LIBRARY_BACKLOG_TOTAL).inc()
            this.startTracking(message.runId, type, filename)
            break
          case 'trigger':
            prometheus.getMetric(consts.prometheus.TRIGGERS_EXECUTION_TOTAL).labels({ filename: filename }).inc()
            prometheus.getMetric(consts.prometheus.TRIGGERS_BACKLOG_TOTAL).inc()
            this.startTracking(message.runId, type, filename)
            break

        }
      }

      // If this is the result let's pull out the execution duration
      if (message.type === Codes.kResult) {
        if (!message.err) {
          modules.prometheus.getMetric(consts.prometheus.SANDBOX_EXECUTIONS_DURATION_SECONDS).observe(message.stats.runtimeMs / 1000)
          this.stopTracking(message)
          return
        }

        // If there is an error let's count it and keep track of timeouts
        const { errCode, statusCode } = message.err
        if (errCode === 'script.timeout.execution') {
          modules.prometheus.getMetric(consts.prometheus.SANDBOX_EXECUTIONS_TIMEOUTS_TOTAL).inc()
        }
        modules.prometheus.getMetric(consts.prometheus.SANDBOX_EXECUTION_ERRORS_TOTAL, { 'statusCode': statusCode }).inc()
        this.stopTracking(message)
      }

    } catch (e) {
      logger.warn(`Could not apply prometheus metrics on sandbox message: ${e.message}`)
    }
  }

  orgRequestCount(id) {

    const envId = (utils.getIdOrNull(id) || '').toString()
    return modules.runtime.db.count({ envId, type: 'request' })
  }

  orgJobCount(id) {

    const orgId = (utils.getIdOrNull(id) || '').toString(),
          set = this._active_jobs.get(orgId)

    if (set) {
      return set.size
    }
    return 0

  }

  orgActivity(orgId, options = {}) {

    const envId = (utils.getIdOrNull(orgId) || '').toString()

    if (!options.verbose) {
      return {
        requests: this.orgRequestCount(orgId),
        workers: this.orgJobCount(orgId),
        scripts: modules.sandbox.countRunningFor(orgId)
      }
    }

    return {

      requests: modules.runtime.db.find({ envId, type: 'request' }).map(op => op.export()),

      workers: Array.from(this._active_jobs.get(orgId) || []).map(job => {

        let out

        if (job.worker === 'job-script-runner') {
          out = {
            _id: job._id,
            name: 'job',
            script: utils.createId(String(job.name).split('_')[1])
          }
        } else {
          out = {
            _id: job._id,
            name: job.worker
          }
        }

        return Object.assign(out, {
          runtimeMs: Date.now() - job.started
        })

      }),

      scripts: Array.from(this._active_scripts.get(orgId) || []).map(script => {
        return Object.assign(
          {
            req: script.ac.reqId,
            stats: Object.assign(
              {
                timeLeft: script.timeLeft
              },
              script.stats
            )
          },
          script.environment.script,
          {
            org: undefined,
            arguments: null
          }
        )
      })
    }

  }

  async get() {
    const metrics = {}
    for (const name of this._registered_keys) {
      const entry = this._registered_metrics[name]
      metrics[name] = entry.callable ? await entry.value() : entry.value
    }
    return metrics
  }

}

module.exports = new MetricsModule()

module.exports.register('v8', function() {

  return v8.getHeapStatistics()

})
