'use strict'

const async = require('async'),
      logger = require('cortex-service/lib/logger'),
      LinkedList = require('cortex-service/lib/linked-list'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      utils = require('../../../utils'),
      { rInt } = utils,
      PoolScript = require('./pool-script'),
      PoolHost = require('./pool-host'),
      modules = require('../../index')

// @todo queue should warm up more resources if it predicts more scripts that the current pool can handle
// @todo max queue size and rejection cases under heavy load.
// @todo when replenishing fails, error out or at least set a timeout. limit retries!

class ScriptQueue {

  constructor(pool) {

    this._q = new LinkedList()
    this._p = pool

    this.minQueueExpiryCheckInterval = config('sandbox.pool.minQueueExpiryCheckInterval')
    this.nextExpiryCheck = Date.now() + this.minQueueExpiryCheckInterval
    this.maxQueuedRoutes = config('sandbox.pool.maxQueuedRoutes')
    this.queuedRoutes = 0

  }

  /**
   * may throw if we can't queue any more scripts.
   */
  add(poolScript) {

    const { type } = poolScript.configuration,
          node = new LinkedList.Node(poolScript)

    if (type === 'route') {
      this.queuedRoutes++
    }

    node._q_expires = Date.now() + poolScript.queueTimeout

    if (poolScript.mustRunNext) {
      return this._q.unshift(node)
    }

    if (type === 'route') {
      if (this.queuedRoutes >= this.maxQueuedRoutes) {
        this.queuedRoutes--
        return poolScript.fnExit(Fault.create('cortex.tooBusy.sandbox'), null, poolScript)
      }
    }

    for (let n of this._q) {
      if (poolScript.queuePriority < n.value.queuePriority) {
        return this._q.insertBefore(n, node)
      }
    }
    this._q.push(node)
  }

  mustRunNext() {

    const node = this._q.first
    if (node) {
      return node.value.mustRunNext || node.value.queuePriority < 0
    }
    return false
  }

  checkExpire() {

    const now = Date.now()
    if (now >= this.nextExpiryCheck) {
      for (let node of this._q) {
        if (now >= node._q_expires) {
          if (node.value.configuration.type === 'route') {
            this.queuedRoutes--
          }
          this._q.remove(node)
          try {
            node.value.fnExit(Fault.create('script.timeout.execution', { path: 'pool.expiry' }), null, node.value)
          } catch (err) {
            logger.error('caught error removing expired q script.')
          }
        }
      }
      this.nextExpiryCheck = Date.now() + this.minQueueExpiryCheckInterval
    }

  }

  /**
   * get the next available scheduled script that can be started, and removes it from the queue.
   * at this point, the returned script must be run.
   */
  next() {

    const potential = this._p.numPotential,
          pct = this._p.maxOrgSaturationScalar

    for (let node of this._q) {
      const ps = node.value,
            running = this._p.getRunningFor(ps.ac.org._id),
            allowed = (running + potential) * pct
      if (ps.mustRunNext || running < allowed || pct === 1.0) {
        if (ps.configuration.type === 'route') {
          this.queuedRoutes--
        }
        this._q.remove(node)
        return ps
      }
    }
    return null
  }

  get length() {
    return this._q.length
  }

  clear() {

    let len = this.length
    if (len) {
      logger.info('cancelling ' + len + ' queued scripts')
    }
    for (let node of this._q) {
      node.value.fnExit(Fault.create('script.error.cancelled'), null, node.value)
      this._q.remove(node)
    }
    this._q.empty()

  }

}

/**
 * a pool of hosts. hosts are added or removed based on need. any host that dies
 */
class HostPool {

  #consumeImmediate = null
  #numExecuted = 0

  static create() {

    return new HostPool(config('sandbox.pool'))

  }

  constructor(options) {

    this.initialInstances = Math.max(options.initialInstances, 1) // number of hosts at idle
    this.burstRate = Math.max(1, rInt(options.burstRate, 1)) // parallel burst rate.
    this.burstInstances = Math.max(options.burstInstances, this.initialInstances) // maximum number of hosts under load

    this.idleRelease = Math.max(options.idleRelease, 0) // how many milliseconds before the pool can relieve burst hosts
    this.queueDipTimeout = Math.max(options.queueDipTimeout, 1) // how long to wait until checking for an available slot.
    this.maxOrgSaturationScalar = Math.min(Math.max(options.maxOrgSaturationScalar, 0.01), 1.0) // max percentage of total available pool an org can saturate.

    this.org_counts = {} // scripts currently running in orgs.
    this.hosts = [] // script hosts.
    this.runQueue = new ScriptQueue(this) //
    this.stopping = false // if stopping, nothing new can happen, and queued scripts are all cancelled.
    this.bursting = false

  }

  /**
     * fire up the pool with initial resources
     */
  init(callback) {

    async.whilst(
      () => this.hosts.length < this.initialInstances,
      callback => this.addInstance(callback),
      err => {
        if (!err) {
          logger.debug('sandbox instances initialized')
        }
        callback(err)
      }
    )

  }

  metrics() {

    return {
      queued: this.runQueue.length,
      sandboxes: this.hosts.length,
      running: this.numRunning,
      initial: this.initialInstances,
      burst: this.burstInstances,
      executed: this.numExecuted,
      scripts: this.hosts.map(host => host.inFlight).filter(v => v).map(poolScript => ({
        _id: poolScript.runId,
        org: poolScript.ac.org.code,
        depth: poolScript.scriptExecutionDepth,
        timeLeft: poolScript.timeLeft,
        name: poolScript.configuration.filename
      }))
    }

  }

  shutdown(callback) {

    if (!this.stopping) {

      this.stopping = true

      if (this.tryShutdownHosts()) {
        logger.info('no scripts running.')
        callback()
      } else {
        logger.info(`waiting for ${this.numRunning} running script(s) and ${this.runQueue.length} queued script(s) to finish on ${this.hosts.length} host(s)`)
        this._stop_hook = () => {
          callback()
        }
      }

    }

  }

  tryShutdownHosts() {

    if (this.runQueue.length > 0) {
      return false
    }

    // stop all hosts not running scripts.
    this.hosts.slice().forEach(host => {
      if (!host.isRunning) {
        host.disposeHost('shutting down', false)
      }
    })
    return this.hosts.length === 0
  }

  /**
     * schedules a script to run and return a pool script instance. the instance is an event emitter
     *
     * @param ac
     * @param parentScript
     * @param scriptOptions
     * @param fnStart called when the script has been scheduled and will for sure run on a connection. runs async and must callback with a response.
     * @param fnExit called on script exit, for whatever reason.
     *
     *
     */
  schedule(ac, parentScript, scriptOptions, fnStart, fnExit) {

    let poolScript

    try {

      poolScript = new PoolScript(ac, parentScript, scriptOptions, fnStart, fnExit)

      this.runQueue.add(poolScript)

    } catch (err) {

      return fnExit(err, null, poolScript)

    }

    this._queueConsume()

  }

  firstFreeHost() {
    for (let host of this.hosts) {
      if (host.ready) {
        return host
      }
    }
    return null
  }

  getRunningFor(id) {
    id = utils.getIdOrNull(id)
    return !id ? 0 : utils.rInt(this.org_counts[id.toString()], 0)
  }

  setRunning(poolScript, running) {

    const id = poolScript.ac.org._id.toString()
    this.org_counts[id] = (this.org_counts[id] || 0) + (running ? 1 : -1)
    if (this.org_counts[id] <= 0) {
      delete this.org_counts[id]
    }

    if (running) {
      modules.metrics.addScript(poolScript)
    } else {
      modules.metrics.removeScript(poolScript)
    }

    if (!running && this.stopping && this.tryShutdownHosts() && this._stop_hook) {
      logger.info('all scripts complete. pool shut down cleanly.')
      this._stop_hook()
      this._stop_hook = null
    }

  }

  get numPotential() {

    return this.burstInstances - this.hosts.reduce((count, host) => count + (host.isRunning ? 1 : 0), 0)

  }

  get numRunning() {

    return Object.keys(this.org_counts).reduce((running, key) => running + utils.rInt(this.org_counts[key], 0), 0)

  }

  get numExecuted() {

    return this.#numExecuted
  }

  _queueConsume() {

    if (this.#consumeImmediate) {
      return
    }
    this.#consumeImmediate = setImmediate(() => {
      this.#consumeImmediate = null
      this._consume()
    })
    this.#consumeImmediate.unref()
  }

  _consume() {

    if (this.runQueue.length > 0) {

      // expire queued
      this.runQueue.checkExpire()

      const host = this.firstFreeHost()

      // need a host?
      if (!host) {

        const burstAvailable = Math.max(0, this.burstInstances - this.hosts.length)
        if (!this.bursting && (burstAvailable > 0 || this.runQueue.mustRunNext())) {

          // burst at least one if we must, but no more than the burst rate normally allows.
          // if bursting beyond max, release the sandbox after a much shorter idle period.
          this.bursting = true
          const count = Math.max(1, Math.min(this.burstRate, burstAvailable))
          logger.debug(`[sandbox] bursting ${count}`)
          async.times(
            count,
            (n, callback) => {
              this.addInstance(
                { idleRelease: burstAvailable > 0 ? this.idleRelease : 1000 },
                () => callback() // void err
              )
            },
            () => { // void err
              this.bursting = false
              this._queueConsume()
            }
          )

        }

        return this._queueConsume()
      }

      // host and script?
      if (host) {
        const queuedScript = this.runQueue.next()
        if (queuedScript) {
          host.runScript(queuedScript)
          this.#numExecuted++
          return this._queueConsume()
        }
      }

      if (this.queueDipTimeout) {
        setTimeout(() => this._queueConsume(), this.queueDipTimeout)
      } else {
        this._queueConsume()
      }

    }
  }

  addInstance(options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    if (this.stopping) {
      logger.debug('sandbox is stopping.')
      return setTimeout(() => callback(), 50) // <-- don't swallow the callback
    }

    const host = new PoolHost(this, { idleRelease: options.idleRelease })
    this.hosts.push(host)
    host.init((err) => {
      if (err) {
        logger.error('sandbox failed to initialize. retrying in 1s', err.toJSON())
        return setTimeout(() => {
          callback()
        }, 1000)
      } else {
        callback()
      }

    })
  }

  removeHost(host, replenish, reason) {
    const pos = this.hosts.indexOf(host)
    if (~pos) {
      this.hosts.splice(pos, 1)
    }

    if (reason) logger.info('sandbox host ' + pos + ' closed: ' + reason)

    if (replenish && !this.stopping && this.hosts.length < this.initialInstances) {
      async.whilst(
        () => this.hosts.length < this.initialInstances,
        callback => this.addInstance(callback),
        () => {
          logger.debug('sandbox instances replenished')
        }
      )
    }

    if (!replenish && this.stopping && this.tryShutdownHosts() && this._stop_hook) {
      logger.info('all scripts complete. pool shut down cleanly.')
      this._stop_hook()
      this._stop_hook = null
    }

  }

}

// ------------------------

module.exports = HostPool
