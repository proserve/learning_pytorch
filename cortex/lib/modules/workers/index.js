'use strict'

const {
        array: toArray, path: pathTo, resolveOptionsCallback, toJSON, profile, equalIds, isInteger,
        getIdOrNull, rInt, promised, serializeObject, rString, rBool
      } = require('../../utils'),
      Startable = require('cortex-service/lib/startable'),
      modules = require('../../modules'),
      _ = require('underscore'),
      logger = require('cortex-service/lib/logger'),
      acl = require('../../acl'),
      consts = require('../../consts'),
      ap = require('../../access-principal'),
      async = require('async'),
      path = require('path'),
      fs = require('fs'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      later = require('later'),
      uuid = require('uuid'),
      WorkerQueue = require('./worker-queue'),
      SqsQueue = require('./sqs-queue')

let Undefined

class WorkersModule extends Startable {

  constructor(options) {

    super('workers', options)

    /**
         * The available worker prototypes and their default options.
         */
    this.workerProtos = {}

    /**
         * The worker instances.
         */
    this.workers = {}

    this._queueOptions = _.extend(
      {
        priority: 0,
        timeout: 120000,
        maxTries: 3,
        writeConcern: 'majority',
        readPreference: 'primary',
        recurPriority: 1
      },
      config('messages.sendQ')
    )

    this.mq = new WorkerQueue(config('messages.workerQ'))
    this.sqsPump = new SqsQueue()
    this._isMaster = false
    this._numProcessed = 0

    this._boundAWSHandler = this._handleAWS.bind(this)
    this._boundMessageHandler = this._handleMessage.bind(this)
    this._boundErrorHandler = this._handleError.bind(this)

    modules.services.api.addCommand('queue.worker.poll', (payload, callback) => {
      this.mq.poll().catch(e => { void e })
      return callback(null, true)
    })

    modules.services.api.addCommand('queue.worker.cancel', (payload, callback) => {
      this.cancelWorker(payload && payload.identifier, callback)
    })

    modules.services.api.addCommand('queue.worker.setOptions', (payload, callback) => {
      this.mq.setOptions(payload)
      callback(null, this.mq.getOptions())
    })

    modules.services.api.addCommand('queue.worker.getOptions', (payload, callback) => {
      callback(null, this.mq.getOptions())
    })

    modules.services.api.addCommand('queue.snapshot', (payload, callback) => {

      return callback(null, {
        running: modules.metrics.numActiveJobs,
        workers: modules.metrics.activeJobs,
        master: module.exports.isMaster,
        processed: module.exports.numProcessed,
        dispatched: module.exports.numDispatched,
        pumped: module.exports.sqsPump.numProcessed,
        workerQ: this.mq && this.mq.metrics
      })
    })

    // CTXAPI-799. each shard always polls.
    // when the master changes, start/stop dispatching
    modules.services.api.on('cluster.master', () => {
      this._isMaster = modules.services.api.isMaster
      logger.info(`cluster.master changed to ${modules.services.api.master}. i am ${this._isMaster ? '' : 'not '} master. state: ${this.state}`)
    //   if (this.state === 'started') {
    //     if (this._isMaster) {
    //       this.mq.start(() => {
    //         this.mq.poll().catch(e => { void e })
    //       })
    //     } else {
    //       this.mq.stop(() => {})
    //     }
    //   }
    //
    })

  }

  clusterCancelWorker(identifier, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    identifier = getIdOrNull(identifier) || rString(identifier, '').substr(0, 1024)

    modules.services.api.command('queue.worker.cancel', { body: { identifier } }, (err, results) => {
      callback(
        err,
        Object.entries(results)
          .reduce((messages, [host, result]) => {
            if (Array.isArray(result)) {
              return messages.concat(result)
            }
            return messages

          }, [])
      )
    })

  }

  cancelWorker(identifier, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    identifier = getIdOrNull(identifier) || rString(identifier, '')

    const messages = this.mq.findMessages(identifier)
    for (const message of messages) {
      try {
        message.cancel()
      } catch (err) {
      }
    }
    callback(null, messages.map(m => m._id))

  }

  get isMaster() {
    return this._isMaster
  }

  get numProcessed() {
    return this._numProcessed
  }

  get collection() {
    return this._collection || (this._collection = modules.db.models.Message.collection)
  }

  _waitStart(callback) {

    const scheduledConfig = config('scheduled'),
          scheduled = []

    this.loadWorkers()

    // init scheduled tasks.
    async.each(Object.keys(scheduledConfig || {}), (jobName, callback) => {

      const job = scheduledConfig[jobName]

      // allow configuration to explicitly remove a job by setting its property value to false
      if (job === false || (job && job.disabled)) {

        this.unschedule(jobName, err => {
          if (err) logger.error('error un-scheduling job ' + jobName, toJSON(err, { stack: true }))
          else logger.info('unscheduled ' + jobName)
          callback()
        })

      } else {

        if (!job.worker) {
          job.worker = jobName
        }

        // because the available scheduled workers have been loaded, test to ensure the configuration item has a matching worker.
        // if not, un-clutter the queue by un-scheduling the errant job.
        if ((!job.queue || job.queue === 'scheduled') && !this.isWorkerRegistered(job.worker)) {
          logger.error('missing worker "' + job.worker + '" for scheduled job "' + jobName + '". un-scheduling')
          this.unschedule(jobName, err => {
            if (err) logger.error('error un-scheduling job ' + jobName, toJSON(err, { stack: true }))
            callback()
          })
        } else {
          this.schedule(jobName, job, err => {
            if (err) logger.error('error scheduling job ' + jobName, toJSON(err, { stack: true }))
            else scheduled.push(jobName)
            callback()
          })
        }
      }

    }, () => {

      logger.info(`scheduled jobs (${scheduled.sort().join(', ')})`)

      // fire up the listeners
      this.sqsPump.on('message', this._boundAWSHandler)
      this.mq.on('message', this._boundMessageHandler)
      this.sqsPump.on('error', this._boundErrorHandler)
      this.mq.on('error', this._boundErrorHandler)

      // listen.
      const queues = config('queues')
      Object.keys(queues).forEach(name => {

        const entry = queues[name]

        if (entry.sqs) {
          this.sqsPump.listen(name, entry.sqs)
        }

        if (entry.mq) {
          this.mq.listen(name, entry.mq)
        }

      })

      this.sqsPump.start(err => {
        if (err) {
          return callback(err)
        }
        // CTXAPI-799. always start
        return this.mq.start(callback)
        // if (modules.services.api.isMaster) {
        //   return this.mq.start(callback)
        // }
        // callback()
      })

    })

  }

  _waitStop(callback) {

    logger.info('stopping queue, halting listeners, and signalling jobs...')

    async.parallel([

      callback => modules.db.models.WorkerLock.signalAll(consts.Transactions.Signals.Shutdown, () => callback()),
      callback => this.mq.stop(() => callback()),
      callback => this.sqsPump.stop(() => callback())

    ], () => {

      if (this._boundAWSHandler) this.sqsPump.removeListener('message', this._boundAWSHandler)
      if (this._boundMessageHandler) this.mq.removeListener('message', this._boundMessageHandler)
      if (this._boundErrorHandler) this.sqsPump.removeListener('error', this._boundErrorHandler)
      if (this._boundErrorHandler) this.mq.removeListener('error', this._boundErrorHandler)

      modules.db.models.WorkerLock.signalAll(consts.Transactions.Signals.Shutdown, () => {
        logger.info('queue stopped.')
        callback()
      })

    })

  }

  loadWorkers() {

    const workersPath = path.join(__dirname, 'workers'),
          workerFiles = fs.readdirSync(workersPath),
          loaded = []

    workerFiles.forEach(workerFile => {
      const workerName = path.basename(workerFile, '.js').toLowerCase()
      if (workerName[0] !== '.') {
        const workerFullPath = path.join(workersPath, workerFile)
        if (this.addWorker(workerName, workerFullPath)) {
          loaded.push(workerName)
        }
      }
    })

    logger.info(`loaded workers (${loaded.sort().join(', ')})`)

  }

  addWorker(name, fullPath) {
    try {
      if (fs.statSync(fullPath).isFile()) {
        this.workerProtos[name] = require(fullPath)
      } else {
        logger.error('Worker not found (' + fullPath + ')')
        return false
      }
    } catch (e) {
      logger.error('Failed to load worker (' + fullPath + ') ', toJSON(e, { stack: true }))
      return false
    }
    return true
  }

  createWorker(name, options) {

    const Cls = this.workerProtos[(name || '').toLowerCase()]
    if (Cls) {
      const worker = new Cls()
      worker.init(options)
      return worker
    }
    return null

  }

  isWorkerRegistered(name) {
    return !!this.workerProtos[name]
  }

  send(queueName, worker, payload, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    if (config('queues.blockSendQ')) {
      if (_.isFunction(callback)) {
        callback(Fault.create('cortex.invalidArgument.inactive', { path: 'worker.queue' }))
      }
      logger.info(`SendQ ${queueName} blocked ${worker} worker`)
      return
    }

    this._queueMessage(
      queueName,
      {
        worker: worker,
        payload: payload
      },
      options,
      (err, { sendId, inserts } = {}) => {
        if (!err) {
          const endpoint = modules.services.api.shardKeyToEndpoint(inserts[0].target, modules.services.api.endpoints.length)
          modules.services.api.command('queue.worker.poll', { endpoint }) // bump the endpoint responsible
        }
        callback(err)
      }
    )

  }

  _handleAWS(message) {

    // requeue the message on internal queue.
    // @todo: ensure we don't have duplicates. store event id somewhere and let it expire?

    // find the worker and use its priority.
    const worker = this.getWorker(message.worker),
          priority = rInt(worker && worker.priority, null)

    if (!worker) {
      return
    }

    this.send(
      'work',
      message.worker,
      Object.assign({ medable: { messageSource: 'sqs' } }, message.payload),
      {
        orgId: message.org,
        priority
      },
      err => {
        message.done(err)
      }
    )

  }

  getWorker(name) {
    let worker = this.workers[name]
    if (!worker) {
      worker = this.createWorker(name)
      if (worker) {
        this.workers[name] = worker
      }
    }
    return worker
  }

  _handleMessage(message) {

    // find an existing worker.
    const worker = this.getWorker(message.worker),
          tasks = [],
          orgId = message.org ? message.org.toString() : null

    if (!worker) {
      message.done()
    }

    if (orgId) {

      if (config('queues.swallowNonMedableJobs') && !equalIds(acl.BaseOrg, orgId)) {
        logger.info('Just swallowed a job from ' + orgId)
        return message.done()
      }

      // defer jobs while deploying (not a guarantee!).
      if (!message.force) {
        tasks.push(callback => {
          modules.db.models.Org.findOne({ _id: getIdOrNull(orgId) }).select('deployment.inProgress').lean().exec((err, doc) => {
            if (!err && pathTo(doc, 'deployment.inProgress')) {
              err = Fault.create('cortex.accessDenied.maintenance')
            }
            callback(err)
          })
        })
      }
    } else {
      message.org = acl.BaseOrg
    }

    async.series(tasks, (err) => {

      if (err && !message.handled) {
        message.done(err)
      }
      if (message.handled) {
        return
      }

      logger.debug(`[worker] starting worker: ${message.name || message.worker}`, { name: message.name, worker: message.worker, org: message.org.toString() })

      modules.metrics.addJob(message)

      // ensure the worker does not timeout while it is still running.
      const start = profile.start(),
            messageVisibilitySeconds = 60,
            messageTimer = setInterval(function() {
              message.changeMessageVisibility(messageVisibilitySeconds, (err, doc) => {
                if (!err && !doc) {
                  logger.error('changeMessageVisibility failed. job no longer exists in the queue here but is still running', message._doc)
                  message.cancel()
                  clearInterval(messageTimer)
                }
              })
            }, 15000)

      worker.process(message, (err, result) => {

        this._numProcessed++

        clearInterval(messageTimer)

        // log medable jobs
        profile.end(start, `worker.process.${message.worker}`)
        if (!orgId && err) {
          modules.db.models.Org.loadOrg('medable', (e, medable) => {
            if (medable) {
              const logged = Fault.from(err, null, true)
              logged.trace = err.stack
              modules.db.models.Log.logApiErr(
                'api',
                logged,
                new acl.AccessContext(ap.synthesizeAnonymous(medable), null, { req: message.req }),
                null,
                {
                  worker: message.worker
                }
              )
            }
          })
        }

        modules.metrics.removeJob(message)
        if (!message.handled) {
          message.done(err, result)
        }
      })

    })

  }

  _handleError(err, message) {

    logger.error('queue message error', Object.assign(toJSON(err, { stack: true }), { message: message.name }))

  }

  /**
   * Schedule/update a job. running jobs are not updated. nor is the trigger for an existing job modified.
   *
   * @param name the job name. job names are unique, even across queues.
   * @param options
   *      queue: 'scheduled'. defaults to the cron queue.
   *      org: the org id, if any.
   *      cron: null. required. a cron schedule string.
   *      worker: the worker to fire.
   *      payload: default is null worker payload
   *      options: default is null worker options
   *      resetTrigger: false
   *      priority: default is 1.
   *      target: default is random shard key.
   *
   * @param callback err, db findOneAndUpdate result
   */
  schedule(name, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    options.queue = 'scheduled'

    // parse and validate the schedule.
    let cron = String(options.cron),
        parts,
        parsed,
        schedule

    if (cron) {
      parts = String(cron).split(' ')
      if (parts.length !== 5 || parts.length !== 6) {
        try {
          parsed = later.parse.cron(cron, parts.length === 6)
          schedule = later.schedule(parsed)
        } catch (e) {}
      }
    }
    if (!_.isString(name) || !name) {
      if (_.isFunction(callback)) {
        // noinspection JSUnresolvedFunction
        setImmediate(function() {
          callback(Fault.create('cortex.invalidArgument.unspecified', { path: 'name' }))
        })
      }
      return
    }
    if (!schedule || !schedule.isValid()) {
      if (_.isFunction(callback)) {
        // noinspection JSUnresolvedFunction
        setImmediate(function() {
          callback(Fault.create('cortex.invalidArgument.unspecified', { path: 'schedule' }))
        })
      }
      return
    }

    const queue = String(options.queue),
          worker = String(options.worker),
          priority = isInteger(options.priority) ? parseInt(options.priority) : this._queueOptions.recurPriority,
          trigger = schedule.next().getTime(),
          org = getIdOrNull(options.org),
          target = options.target !== Undefined ? options.target : modules.services.api.generateShardKey(),
          message = {
            $set: {
              queue: queue,
              priority: priority,
              target: target,
              schedule: cron,
              worker: worker,
              org: org
            },
            $setOnInsert: {
              state: consts.messages.states.scheduled,
              name: name
            }
          }

    if (options.resetTrigger) {
      message.$set.trigger = trigger
    } else {
      message.$setOnInsert.trigger = trigger
    }
    if (options.payload !== undefined) {
      message.$set.payload = serializeObject(options.payload, true)
    }
    if (options.options !== undefined) {
      message.$set.opts = options.options
    } else {
      message.$unset = { opts: 1 }
    }
    this.collection.findOneAndUpdate({ name: name }, message, { upsert: true, returnDocument: 'after' }, function(err, result) {
      const doc = pathTo(result, 'value')
      if (_.isFunction(callback)) {
        callback(err, doc)
      }
    })

  }
  /**
   *
   * @param name
   * @param callback -> err, db findOneAndDelete result
   */
  unschedule(name, callback) {
    logger.silly('unscheduling job:', { name })
    this.collection.findOneAndDelete({ name }, function(err, result) {
      if (_.isFunction(callback)) {
        callback(err, result)
      }
    })

  }

  /**
   *
   * @param org
   * @param name
   * @param db findOneAndUpdate result
   */
  async scheduleJob(org, name, options) {

    options = options || {}

    options.queue = 'scheduled'
    options.worker = 'job-script-runner'
    options.org = org._id

    return promised(this, 'schedule', name, options)

  }

  /**
   * sets a scheduled job to run immediately.
   *
   * @param name the unique job name.
   *
   */
  runNow(name, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    this.collection.findOneAndUpdate({ name: name }, { $set: { trigger: 0 } }, function(err, result) {

      const doc = pathTo(result, 'value')

      if (doc) {
        const endpoint = modules.services.api.shardKeyToEndpoint(doc.target, modules.services.api.endpoints.length)
        modules.services.api.command('queue.worker.poll', { endpoint }) // bump the endpoint responsible
      }

      if (_.isFunction(callback)) {
        callback(err, !!doc)
      }
    })

  }

  /**
   *
   * @param org
   * @param name
   */
  async runScheduledJob(org, name) {

    return this.collection.findOneAndUpdate({ name, worker: 'job-script-runner', state: consts.messages.states.scheduled, org: org ? org._id : null, queue: 'scheduled' }, { $set: { trigger: 0 } }, { upsert: false })

  }

  /**
   *
   * @param org
   * @param name
   * @return {Promise<*>}
   */
  async unscheduleJob(org, name) {
    return this.collection.deleteMany({ name, worker: 'job-script-runner', state: consts.messages.states.scheduled, org: org ? org._id : null, queue: 'scheduled' }, {})
  }

  async unscheduleAllJobs(org) {
    return this.collection.deleteMany({ worker: 'job-script-runner', state: consts.messages.states.scheduled, org: org ? org._id : null, queue: 'scheduled' }, {})
  }

  async getScheduledJobs(org) {
    return this.collection.find({ worker: 'job-script-runner', state: consts.messages.states.scheduled, org: org ? org._id : null, queue: 'scheduled' }).toArray()
  }

  /**
   * queues one or more messages.
   *
   * @param queue
   * @param messages a message or array of messages to send. messages MUST include a worker and an optional payload.
   * @param options
   *  {
   *      orgId: the org id.
   *      reqId: the original requestId (or http.IncomingMessage). the id can be used to tie audits to the original request across workers.
   *      timeout: 10000 (timeout in ms. this is the timeout per try. a valid reply may return a result long after the timeout has expired (timeout * maxTries + send latency + processing latency + reply latency)),
   *      maxTries: 3,
   *      priority: 0,
   *      parent: parent message options, used internally for schedules messages.
   *      options: null, worker options
   *      trigger: 0 (Date or Integer in milliseconds since unix epoch) the message won't be processed until the specified date. if 0, the message is processed asap.
   *  }
   * @param callback -> err, sendId
   */
  _queueMessage(queue, messages, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    let requestId = getIdOrNull(pathTo(options, 'reqId._id') || options.reqId),
        timeout = Math.max(0, options.timeout || this._queueOptions.timeout),
        maxTries = Math.max(1, options.maxTries || this._queueOptions.maxTries),
        force = rBool(options.force, false),
        priority = options.priority == null ? this._queueOptions.priority : options.priority,
        trigger = _.isDate(options.trigger) ? options.trigger.getTime() : (isInteger(options.trigger) ? parseInt(options.trigger) : new Date().getTime()),
        expires = new Date(Math.max(trigger, Date.now()) + ((config('messages.ttlSeconds') || 86400) * 1000)), // ensure the message expires and is removed from the queue if stale (from the trigger date)
        sendId = uuid.v1()

    // prepare the messages
    const inserts = toArray(messages, messages).map(entry => {

      const message = {
        queue,
        trigger,
        priority,
        force,
        state: consts.messages.states.pending,
        triesLeft: maxTries,
        timeout,
        target: modules.services.api.generateShardKey(),
        expires,
        worker: entry.worker,
        org: getIdOrNull(options.orgId)
      }

      let parent = options.parent
      if (config('__is_mocha_test__')) {
        const server = require('../../../test/lib/server')
        parent = parent || {}
        parent.__mocha_test_uuid__ = server.__mocha_test_uuid__
        parent.mochaCurrentTestUuid = server.mochaCurrentTestUuid
      }
      if (parent) message.parent = parent

      if (requestId) message.reqId = requestId
      if (entry.payload !== undefined) message.payload = serializeObject(entry.payload, true)
      if (options.options !== undefined) message.opts = options.options

      return message
    })

    this.collection.insertMany(inserts, { writeConcern: { w: this._queueOptions.writeConcern } }, err => {
      if (err) {
        logger.error('failed to queue messages!', toJSON(err, { stack: true }))
        err = Fault.create('cortex.error.messageQueueFailed')
      }
      callback(err, { sendId, inserts })
    })

  }

}

module.exports = new WorkersModule()

modules.metrics.register('workers', () => ({
  running: modules.metrics.numActiveJobs,
  workers: modules.metrics.activeJobs,
  master: module.exports.isMaster,
  processed: module.exports.numProcessed,
  dispatched: module.exports.numDispatched,
  pumped: module.exports.sqsPump.numProcessed
}))
