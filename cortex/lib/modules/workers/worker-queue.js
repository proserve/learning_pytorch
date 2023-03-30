'use strict'

/*!

Pulls messages off the queue and farms them out to listeners

@todo tail the optlog to detect changes
@todo add a "started" field to aid in mitigating clock drift.
*/

const Queue = require('./queue'),
      _ = require('underscore'),
      consts = require('../../consts'),
      QueueMessage = require('./queue-message'),
      logger = require('cortex-service/lib/logger'),
      { toJSON, equalIds, rInt, deserializeObject, isInt, resolveOptionsCallback, clamp, isSet, createId } = require('../../utils'),
      modules = require('../../modules'),
      later = require('later'),
      clone = require('clone'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      async = require('async'),
      acl = require('../../acl'),
      ap = require('../../access-principal'),
      defaults = {
        minPoll: 0,
        maxPoll: 10000,
        maxConcurrentMessages: 50, // max local inflight.
        writeConcern: 'majority',
        readPreference: 'primary',
        shardPendingTolerance: 30000, // run anything on any shard if it's over X milliseconds old.
        messagePerLookup: 20 // process X at once.
      },
      lookupStates = config('queues.ignoreScheduledJobs')
        ? [consts.messages.states.pending, consts.messages.states.processing]
        : [consts.messages.states.pending, consts.messages.states.processing, consts.messages.states.scheduled]

function nextCron(cron, num) {
  let schedule
  if (cron) {
    const parts = String(cron).split(' ')
    if (parts.length !== 5 || parts.length !== 6) {
      try {
        const parsed = later.parse.cron(cron, parts.length === 6)
        schedule = later.schedule(parsed)
      } catch (e) {}
    }
  }
  if (schedule && schedule.isValid()) {
    return schedule.next(num || 1)
  }
  return []
}

// ----------------------------------------------------------------------------------

class WorkerQueue extends Queue {

  constructor(options) {
    super('Worker queue')
    this.setOptions(options)
    this.queues = []
    this.polling = false
    this.poller = this.poll.bind(this)
    this.timer = null
    this.curPoll = this.options.minPoll
  }

  get metrics() {
    return {
      polling: this.polling,
      state: this.state,
      curPoll: this.curPoll,
      pollTimerActive: this.timer !== null,
      lastDoc: this.lastDoc,
      inflight: this.inflight(),
      options: this.getOptions()
    }
  }

  get collection() {
    return this._collection || (this._collection = modules.db.models.Message.collection)
  }

  setOptions(input) {

    input = input || {}

    if (!this.options) {
      this.options = clone(defaults)
    }

    // min polling schedule.
    if (isSet(input.minPoll)) {
      this.options.minPoll = clamp(input.minPoll, 0, 10000)
    }

    // max polling schedule
    if (isSet(input.maxPoll)) {
      this.options.maxPoll = clamp(this.options.maxPoll, 0, 10000)
    }

    // max number of concurrent jobs thew server wants to handle. this is memory bound by the number of envs in memory at once.
    if (isSet(input.maxConcurrentMessages)) {
      this.options.maxConcurrentMessages = clamp(input.maxConcurrentMessages, 1, 1000)
    }

    // max number of messages to get from the db at once. the higher the number the less dips but the greater the chance for collisions.
    if (isSet(input.messagePerLookup)) {
      this.options.messagePerLookup = clamp(input.messagePerLookup, 1, this.options.maxConcurrentMessages)
    }

    // the threshold where other nodes will start to read messages meant for a shard that is too busy, not performing, has too many long running jobs,
    // too many high cpu jobs, a problem with stuck jobs, etc.
    if (isSet(input.shardPendingTolerance)) {
      this.options.shardPendingTolerance = clamp(input.shardPendingTolerance, 1000, 60000)
    }

    // the write concern. don't support too many options but support local development.
    if ([1, '1', 'majority'].includes(input.writeConcern)) {
      this.options.writeConcern = input.writeConcern
    }

    // the read preference. for now, only support reading from the primary.
    if (['primary'].includes(input.readPreference)) {
      this.options.readPreference = input.readPreference
    }

  }

  getOptions() {

    return clone(this.options)

  }

  _listen(queue, queueOptions) {
    void queueOptions
    if (!_.isArray(queue)) queue = [queue]
    this.queues = _.union(this.queues, queue)
  }

  _waitStart(callback) {
    super._waitStart(err => {
      if (!err) {
        this.once('started', () => {
          this.curPoll = this.options.minPoll
          this.poll().catch(e => { void e })
        })
      }
      callback(err)
    })
  }

  _waitStop(callback) {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    super._waitStop(callback)
  }

  /**
   *
   * @param options
   *  grouped (Boolean=false)
   * @param callback
   */
  count(options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    if (options.grouped) {

      this.collection.aggregate([{
        $match: {
          queue: { $in: this.queues },
          state: { $in: lookupStates },
          target: {
            $gte: modules.services.api.lowerBoundShardKey,
            $lte: modules.services.api.upperBoundShardKey
          },
          trigger: { $lte: Date.now() }
        }
      }, {
        $group: {
          _id: {
            org: '$org',
            worker: '$worker',
            name: '$name'
          },
          org: { $first: '$org' },
          worker: { $first: '$worker' },
          name: { $first: '$name' },
          count: {
            $sum: 1
          }
        }
      }, {
        $project: {
          _id: 0,
          org: 1,
          worker: 1,
          name: 1,
          count: 1
        }
      }],
      {
        readPreference: this.options.readPreference,
        cursor: {}
      })
        .toArray(callback)

    } else {

      this.collection.countDocuments({
        queue: { $in: this.queues },
        state: { $in: lookupStates },
        target: {
          $gte: modules.services.api.lowerBoundShardKey,
          $lte: modules.services.api.upperBoundShardKey
        },
        trigger: { $lte: Date.now() }
      },
      {
        readPreference: this.options.readPreference
      },
      callback
      )

    }
  }

  async poll() {

    if (this.polling) {
      return
    }
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.state !== 'started') {
      return
    }
    this.polling = true

    // logger.silly('WorkerQueue.poll(). frequency: '+this.curPoll+'ms');

    const numCanProcess = Math.max(0, this.options.maxConcurrentMessages - this.inflight()),
          numToFetch = Math.min(numCanProcess, this.options.messagePerLookup)

    let messagesProcessed = 0,
        docs = []

    // get some messages from the queue. ----------------------------------------
    if (numCanProcess === 0) {

      this.curPoll = Math.min(this.options.maxPoll, Math.max(1, this.curPoll) * 1.5)

    } else {

      try {
        docs = await this._getNext(numToFetch)
        if (docs.length === 0) {
          // didn't find anything. things are slow so decrease the poll frequency
          // this.curPoll = Math.min(this.options.maxPoll, Math.max(1, this.curPoll)*1.5);
          // set to maxPoll and allow broadcasts to kick start
          this.curPoll = this.options.maxPoll
        } else {
          // chances are there may be more documents coming.
          // we got some documents but didn't fill up the list. recheck right away.
          this.curPoll = this.options.minPoll
        }
      } catch (err) {

        // there was an error. this is most probably a database error, jump to max poll.
        logger.error('reading queue', toJSON(err, { stack: true }))
        this.curPoll = this.options.maxPoll
      }
    }

    for (let doc of docs) {

      if (!doc || this.state !== 'started') {
        continue
      } else if (doc.target !== null && !(doc.target >= modules.services.api.lowerBoundShardKey && doc.target <= modules.services.api.upperBoundShardKey)) {
        logger.info('[worker queue] processing non-local target message', _.pick(doc, 'org', 'worker', 'name', 'trigger', 'target'))
      }

      this.lastDoc = doc

      if (doc.schedule) {

        try {
          if (await this._processScheduled(doc)) {
            messagesProcessed++
          }
        } catch (err) {
          logger.error('failed to run scheduled task!', Object.assign(toJSON(err, { stack: true }), { doc }))
        }

      } else {
        try {
          if (await this._processMessage(doc)) {
            messagesProcessed++
          }
        } catch (err) {
          logger.error('queue processing error', toJSON(err, { stack: true }))
        }
      }

    }

    // check next loop ---------------------------------------
    this.polling = false
    if (this.state === 'started') {
      if (this.curPoll === 0) {
        // we could be here if we could not a grab lock on any of the messages, so back off.
        if (messagesProcessed === 0) {
          this.curPoll = Math.min(this.options.maxPoll, Math.max(1, this.curPoll) * 1.5)
        }
        setImmediate(this.poller)
      } else {
        this.timer = setTimeout(this.poller, this.curPoll)
      }
    }

  }

  async _getNext(numToFetch) {

    const now = Date.now()

    return this.collection.find({
      queue: { $in: this.queues },
      state: { $in: lookupStates },
      $or: [
        {
          // find things to trigger on this node that are due.
          // some jobs may still have null targets. tolerate this and attempt to process those as well.
          $or: [
            {
              target: null
            },
            {
              target: {
                $gte: modules.services.api.lowerBoundShardKey,
                $lte: modules.services.api.upperBoundShardKey
              }
            }
          ],
          trigger: { $lte: now }
        },

        // find things that are late in triggering, on any node. this picks up the slack for nodes that are too busy.
        {
          trigger: { $lte: now - this.options.shardPendingTolerance }
        }
      ]
    },
    {
      limit: numToFetch,
      sort: {
        priority: -1, // favor higher priority messages
        trigger: 1, // messages that should have run earlier
        // target: -1, // favor messages meant for this node (null values forced to the back) <-- these are now random shard keys
        _id: 1, // favor older messages
        state: 1 // favor new messages over retries
      },
      readPreference: this.options.readPreference
    }
    ).project(
      // only get the fields we absolutely need to pre-process. get the payload and others when we lock for update.
      {
        _id: 1,
        state: 1,
        trigger: 1,
        triesLeft: 1,
        timeout: 1,
        name: 1,
        schedule: 1,
        started: 1,
        sequence: 1,
        queue: 1,
        worker: 1,
        org: 1,
        target: 1
      }
    ).toArray()

  }

  async _processScheduled(input) {

    let doc = input,
        result,
        trigger

    // update next scheduled time.

    if (doc.schedule === '* * * * * *') {
      trigger = Date.now() + 1000
    } else if (doc.schedule === '* * * * *') {
      trigger = Date.now() + 60000
    } else {
      // make sure to space out the triggers by at least 1 second.
      const next = nextCron(doc.schedule, 2),
            min = Date.now() + 1000
      if (next[0] && (trigger = next[0].getTime()) < min) {
        if (next[1] && (trigger = next[1].getTime()) < min) {
          trigger = min
        }
      }
    }

    const worker = modules.workers.getWorker(doc.worker),
          firstRun = !isInt(doc.sequence),
          find = { _id: doc._id, sequence: firstRun ? { $exists: false } : doc.sequence },
          update = {
            $set: {
              target: modules.services.api.generateShardKey(),
              trigger,
              started: Date.now()
            }
          }
    if (firstRun) {
      update.$set.sequence = 1
    } else {
      update.$inc = { sequence: 1 }
    }

    result = await this.collection.findOneAndUpdate(find, update, { returnDocument: 'after', writeConcern: { w: this.options.writeConcern } })
    doc = result && result.value

    if (doc) {

      if (doc && doc.payload !== undefined) {
        try {
          doc.payload = deserializeObject(doc.payload, true)
        } catch (e) {
        }
      }

      if (worker && worker.maxQueued > 0) {
        const pending = await modules.db.models.message.collection.aggregate([{
          $match: {
            queue: 'work',
            state: consts.messages.states.pending,
            worker: doc.worker
          }
        }, {
          $group: {
            _id: '$org',
            count: { $sum: 1 }
          }
        }], { cursor: {} }).toArray()

        if (pending.reduce((total, v) => total + v.count, 0) >= worker.maxQueued) {
          logger.silly(`[worker] already queued maximum for worker ${doc.worker} in ${doc.org}. message id: ${doc._id}`)
          doc = null // skip processing
        }

      }

    }

    if (doc) {

      const hasActiveJobs = await modules.db.models.message.collection.find({
        org: doc.org,
        queue: 'work',
        state: { $in: [consts.messages.states.pending, consts.messages.states.processing] },
        worker: doc.worker,
        'parent.name': doc.name
      }).limit(1).hasNext()

      if (hasActiveJobs) {
        logger.info(`[worker] skipping already running job ${doc.name}`)
        try {
          if (doc.org) {
            const org = await modules.db.models.Org.loadOrg(doc.org)
            modules.db.models.Log.createLogEntry(
              new acl.AccessContext(ap.synthesizeAnonymous(org), null, { req: doc.reqId || createId() }),
              'api',
              null,
              { message: `skipping already running job ${doc.name}` }
            )
          }
        } catch (err) {
          void err
          logger.error(`error loading org ${doc.org} for activeJob warning.`)
        }
        doc = null
      }

      if (doc) {
        modules.workers.send(
          'work',
          doc.worker,
          doc.payload,
          {
            parent: _.pick(doc, '_id', 'name', 'queue', 'priority', 'target', 'schedule', 'org', 'sequence'),
            priority: doc.priority,
            target: doc.target,
            reqId: doc.reqId,
            orgId: doc.org
          },
          err => {
            if (err) {
              logger.error('failed to run scheduled task!', Object.assign(toJSON(err, { stack: true }), { doc }))
            }
          }
        )
      }

    }

  }

  async _processMessage(input) {

    let doc = input,
        result

    const find = { _id: doc._id, state: doc.state, trigger: doc.trigger, triesLeft: doc.triesLeft },
          worker = modules.workers.getWorker(doc.worker),
          update = {
            trigger: Date.now() + doc.timeout,
            triesLeft: doc.triesLeft - 1,
            state: consts.messages.states.processing
          }

    if (doc.triesLeft <= 0) {

      let err = Fault.create('cortex.timeout.queueMessage')
      try {
        const result = await this.collection.findOneAndDelete(find, { writeConcern: { w: this.options.writeConcern } })
        doc = result && result.value
      } catch (e) {
        err = e
      }
      this._error(err, new QueueMessage(this, doc)) // handle timeout fault through events.
      return doc

    }

    // ----------------

    if (doc.queue === 'work') {

      if (worker && (worker.maxConcurrent > 0 || worker.maxConcurrentPerOrg > 0)) {
        const running = await modules.db.models.message.collection.aggregate([{
          $match: {
            queue: 'work',
            state: consts.messages.states.processing,
            worker: doc.worker
          }
        }, {
          $group: {
            _id: '$org',
            count: { $sum: 1 }
          }
        }], { cursor: {} }).toArray()
        if (
          (worker.maxConcurrent > 0 && running.reduce((total, v) => total + v.count, 0) >= worker.maxConcurrent) ||
          (worker.maxConcurrentPerOrg > 0 && running.filter(v => equalIds(v._id, doc.org) || doc.org === v._id).reduce((total, v) => total + v.count, 0) >= worker.maxConcurrentPerOrg)
        ) {
          logger.silly(`[worker] deferring worker ${doc.worker} in ${doc.org}. message id: ${doc._id}`)
          update.trigger = Date.now() + Math.max(rInt(worker.deferMs, 1000), 1)
          update.triesLeft = doc.triesLeft
          update.state = doc.state
        }
      }
    }

    update.expires = new Date(update.trigger + ((config('messages.ttlSeconds') || 86400) * 1000))
    if (update.state === consts.messages.states.processing) {
      update.started = Date.now()
    }

    result = await this.collection.findOneAndUpdate(find, { $set: update }, { returnDocument: 'after', writeConcern: { w: this.options.writeConcern } })
    doc = result && result.value

    if (doc?.state === consts.messages.states.pending) {

      doc = null

    } else if (doc) {

      if (doc.payload !== undefined) {
        try {
          doc.payload = deserializeObject(doc.payload, true)
        } catch (e) {}
      }
      logger.silly(`processing ${doc.worker} message ${doc._id}`)

      // CTXAPI-799 - sharded worker scheme means we are processing messages locally.
      this._emitMessage(new QueueMessage(this, doc))
    }

    return doc
  }

  /**
 *
 * @param message
 * @param timeout in seconds
 * @param callback
 */
  changeMessageVisibility(message, timeout, callback) {

    // cannot be done for scheduled items.
    if (message.scheduled) {
      if (_.isFunction(callback)) {
        callback()
      }
      return
    }

    const find = {
            _id: message._id,
            state: consts.messages.states.processing
          },
          update = {
            $inc: {
              trigger: (rInt(timeout, 0) * 1000)
            }
          }

    this.collection.findOneAndUpdate(find, update, { returnDocument: 'after' }, (err, result) => {

      const doc = result && result.value
      if (!err && doc) {
        message._doc.trigger = doc.trigger
      }
      callback(err, doc)
    })

  }

  _processed(message, err, result, callback) {

    async.series([

      callback => {
        callback(message ? null : Fault.create('cortex.notFound.missingQueueMessage'))
      },

      callback => {

        if (message.scheduled) {

          callback()

        } else {

          const find = { _id: message._id, state: message.state, trigger: message.trigger, triesLeft: message.triesLeft }

          this.collection.findOneAndDelete(find, { writeConcern: { w: this.options.writeConcern } }, (err, result) => {
            const doc = result && result.value
            if (!err && !doc) {
              logger.silly('q._processed could not lock for update/remove ' + message._id)
              err = Fault.create('cortex.error.queueCantLockMessage')
            }
            callback(err)
          })

        }
      }

    ], err => {

      if (err && err.errCode !== 'cortex.error.queueCantLockMessage') {
        logger.error('q._processed error', Object.assign(toJSON(err, { stack: true }), { worker: message.worker, org: message.org.toString() }))
        err = Fault.create('cortex.error.queueProcessError')
      }
      if (err) {
        this._error(err, message, callback)
      } else if (_.isFunction(callback)) {
        callback(null)
      }
      if (!err) logger.silly(`processed ${message.worker} message ${message._id} ${message.name}`)

    })

  }

}

module.exports = WorkerQueue
