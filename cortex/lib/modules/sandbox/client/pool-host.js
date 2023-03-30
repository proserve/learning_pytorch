'use strict'

const _ = require('underscore'),
      tracer = require('dd-trace'),
      logger = require('cortex-service/lib/logger'),
      Messages = require('../messages'),
      config = require('cortex-service/lib/config'),
      { promised, createId, path: pathTo, extend, isInteger,
        pathParts, array: toArray, OutputCursor, rString, profile,
        isSet
      } = require('../../../utils'),
      apis = require('../apis'),
      { Stream } = require('stream'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../../index'),
      AsyncFunction = Object.getPrototypeOf(async function() {}).constructor,
      ConnectionClasses = {
        WorkerHost: require('../connections/worker-host')
      }

let _nextHostId = createId().toString()
function nextHostId() {
  const ret = _nextHostId
  _nextHostId = createId().toString()
  return ret
}

/**
 * runs scripts on connections. managed by the script pool.
 */
class PoolHost {

  #inFlight = null

  constructor(pool, options) {

    options = options || {}

    PoolHost._register(this)

    this.id = nextHostId()

    this.pool = pool

    this.connection = null
    this.heartbeatInterval = config('sandbox.heartbeatIntervalMs')
    this.heartbeatTimeout = config('sandbox.heartbeatTimeoutMs')
    this.disposeOnFailedHeartbeat = config('sandbox.disposeOnFailedHeartbeat')
    this.startupTimeout = config('sandbox.startupTimeoutMs')

    this.idleTimeoutId = null
    this.idleRelease = options.idleRelease

    this.connectionClass = ConnectionClasses[config('sandbox.connectionClass')]
    this.sandboxOptions = {
      processMemoryLimitMB: config('sandbox.limits.processMemoryLimitMB')
    }
    this.connection_ready = false

    this.tasks = new Map()

    this._rssSize = 0 // reported by sandboxes with stats.

  }

  runScript(poolScript) {

    const maxExecutionDepth = poolScript.ac.org.configuration.scripting.maxExecutionDepth || config('sandbox.limits.maxExecutionDepth')
    if (poolScript.scriptExecutionDepth > maxExecutionDepth) {
      return setImmediate(() => {
        poolScript.fnExit(Fault.create('script.invalidArgument.executionDepthExceeded'), null, poolScript)
      })
    }

    this.pool.setRunning(poolScript, true)
    this._clearIdleReleaseTimer()
    this.#inFlight = poolScript

    poolScript.fnStart(poolScript, err => {
      if (!err && !this.connection_ready) {
        err = Fault.create('script.error.connectionNotReady')
      }
      if (err) {
        return this._scriptExit(poolScript, err)
      }
      poolScript.markStarted()
      const sbMessage = poolScript.compile
        ? new Messages.Compile(
          poolScript.runId,
          {
            scriptType: poolScript.configuration.type,
            source: poolScript.source,
            filename: poolScript.configuration.filename
          })
        : new Messages.Script(
          poolScript.runId,
          {
            source: poolScript.source,
            format: poolScript.format,
            configuration: poolScript.configuration,
            environment: poolScript.environment
          })
      sbMessage.send(this.connection)
      poolScript.startChildSpan(sbMessage, true)

    })
  }

  _scriptExit(poolScript, err, result, runStats) {

    if (this.#inFlight === poolScript) {
      this.#inFlight = null
      const end = new Date()
      if (!runStats) runStats = {}
      runStats.begin = poolScript.start_time || end
      runStats.end = end

      // http stop-gap module (merge local stats).
      runStats = extend({}, runStats, poolScript.stats)

      this.pool.setRunning(poolScript, false)
      if (this.rssSize > this.sandboxOptions.processMemoryLimitMB * (1024 * 1024)) {
        this.disposeHost('sandbox exceeded memory ceiling (' + this.rssSize + ')')
      } else if (config('sandbox.debug.alwaysDisposeHost')) {
        this.disposeHost('debug dispose')
      } else {
        this._startIdleReleaseTimer()
      }

      this.connection_ready = false

      poolScript.fnExit(err, result, poolScript, runStats)

    } else {
      logger.warn(`_scriptExit() missed script ${poolScript.runId}`)
    }

  }

  _scriptTask(poolScript, message) {

    if (!this.connection_ready) {
      return this._scriptExit(poolScript, Fault.create('script.error.connectionNotReady'))
    }

    const messageKindApi = message.kind === 'context' ? poolScript.api : apis.local[message.kind]

    if (messageKindApi) {

      const parts = pathParts(message.command)

      let handlerObj, handlerName, handlerFunction

      handlerObj = parts[1] ? pathTo(messageKindApi, parts[0]) : messageKindApi
      handlerName = rString(parts[1] || parts[0], '')
      handlerFunction = pathTo(handlerObj, handlerName)

      if (handlerFunction) {

        message.payload = toArray(message.payload)

        const isAsync = handlerFunction instanceof AsyncFunction,
              expectedLength = isAsync ? Math.max(0, handlerFunction.length - 2) : handlerFunction.length - 3,
              payloadArguments = handlerFunction.$is_var_args ? [message.payload] : message.payload,
              currentScript = poolScript.ac.script,
              callback = profile.fn(_.once(async(err, result, resultOptions) => {

                const cursor = (result && (result instanceof OutputCursor)) ? result : null,
                      stream = (result && (result instanceof Stream)) ? result : null,
                      pointer = (!err && modules.storage.isPointer(result)) ? result : null,
                      canReply = this.connection_ready && this.#inFlight === poolScript

                if (cursor) {

                  if (!err) {
                    try {
                      const scriptCursor = poolScript.registerCursor(cursor)
                      result = {
                        _id: scriptCursor._id,
                        object: 'cursor'
                      }
                    } catch (e) {
                      err = e
                    }
                  }

                  if (err || !canReply) {
                    try {
                      cursor.close(() => {})
                    } catch (err) {
                      void err
                    }
                    result = null
                  }

                } else if (pointer) {

                  try {
                    result = await promised(modules.streams, 'getPointerUrl', poolScript.ac, result)
                  } catch (e) {
                    err = e
                    result = null
                  }

                } else if (stream) {

                  if (!err) {
                    try {
                      const scriptStream = poolScript.registerStream(stream)
                      result = scriptStream.toJSON()
                    } catch (e) {
                      err = e
                    }
                  }
                  if (err || !canReply) {
                    try {
                      stream.destroy(err)
                    } catch (err) {
                      void err
                    }
                    result = null
                  }

                }

                poolScript.ac.script = currentScript

                if (canReply) {
                  const sbMessage = message.kind === 'internal' && message.command === 'require'
                    ? new Messages.RequireResult(poolScript.runId, {
                      taskId: message.taskId,
                      err: err,
                      source: (result && result.source) || '',
                      format: (result && result.format) || ''
                    })
                    : new Messages.TaskResult(poolScript.runId, {
                      taskId: message.taskId,
                      kind: message.kind,
                      command: message.command,
                      err: err,
                      result: result,
                      raw: resultOptions && resultOptions.raw
                    })
                  sbMessage.send(this.connection)
                  poolScript.startChildSpan(sbMessage, true)
                }
              }), `sandbox.${message.command}`)

        if (!handlerFunction.$is_var_args) {
          payloadArguments.length = expectedLength // script, message, ..., callback
        }

        if (message.command !== 'script.unas' && !poolScript.allowCommand(message.command)) {
          return callback(Fault.create('script.accessDenied.command', { path: parts[0] }))
        }

        try {

          poolScript.ac.script = poolScript

          if (isAsync) {
            handlerFunction.call(handlerObj, poolScript, message, ...payloadArguments)
              .then(result => {
                callback(null, result)
              })
              .catch(callback)
          } else {
            handlerFunction.call(handlerObj, poolScript, message, ...payloadArguments, callback)
          }

        } catch (err) {
          callback(err)
        }

        return

      }

    }

    let taskResult = new Messages.TaskResult(poolScript.runId, { taskId: message.taskId, kind: message.kind, command: message.command, err: Fault.create('script.invalidArgument.unknownCommand', { path: `${message.kind}#${message.command}` }) })
    taskResult.send(this.connection)
    poolScript.startChildSpan(taskResult, true)

  }

  _taskReply(message) {
    const callback = this.tasks.get(message.taskId)
    if (callback) {
      this.tasks.delete(message.taskId)
      try {
        callback(message.err, message.result)
      } catch (err) {}
    }
  }

  init(callback) {

    callback = _.once(callback)

    const _config = config('sandbox'),
          connection = this.connection = new this.connectionClass(this.sandboxOptions),
          dispose = _.once((err) => {
            this.disposeHost(err ? err.reason || err.message : null)
          }),
          startupTimeoutId = setTimeout(() => {
            dispose(Fault.create('script.timeout.sandboxStartup'))
          }, this.startupTimeout)

    if (config('mocha')) {
      _config.mocha = config('mocha')
    }
    _config.apis = apis.remote

    connection.open()
    connection.send(new Messages.Init(_config))

    connection.once('close', err => {
      connection.removeAllListeners()
      dispose(err)
      callback(err)
    })

    connection.once('ready', (message) => {

      clearTimeout(startupTimeoutId)
      this.connection_ready = true

      modules.sandbox.version = message.version

      connection.on('ready', message => {
        if (!this.disposing) {
          this.connection_ready = true
        }
      })

      connection.on('message', message => {

        if (message && message.stats && isInteger(message.stats.rss)) {
          this._rssSize = message.stats.rss
        }

        const type = message.type,
              poolScript = this.#inFlight && this.#inFlight.runId === message.runId && this.#inFlight

        if (poolScript) {
          poolScript.startChildSpan(message)
          // In order to attach all subsequent spans to the current span, we need activate the current child span
          tracer.scope().activate(poolScript.ac?.req?._ddSpan, () => {
            if (message.trace) {
              poolScript.lastTrace = message.trace
            }
            if (type === Messages.Codes.kResult) {
              if (message.err && !message.err.trace && poolScript.lastTrace) {
                message.err.trace = poolScript.lastTrace
              }
              this._scriptExit(poolScript, message.err, message.result, message.stats)
            } else if (type === Messages.Codes.kTask) {
              this._scriptTask(poolScript, message)
            }
          })
        } else if (type === Messages.Codes.kTaskResult) {
          this._taskReply(message)
        }
      })

      connection.on('heartbeat', message => {
        if (this.heartbeatScriptId === message.runId) {
          this.heartbeatScriptId = null
          this.lastHeartbeat = Date.now()
        }
      })

      this._startIdleReleaseTimer()
      if (!config('sandbox.debug.disableHeartbeat')) {
        this.startHeartbeat()
      }

      callback()

    })

  }

  _startIdleReleaseTimer() {
    if (isSet(this.idleRelease)) {
      this._clearIdleReleaseTimer()
      if (!this.#inFlight) {
        this.idleTimeoutId = setTimeout(() => {
          if (!this.#inFlight) {
            this.disposeHost('idle release')
          }
        }, this.idleRelease)
      }
    }
  }

  _clearIdleReleaseTimer() {
    if (this.idleTimeoutId) {
      clearTimeout(this.idleTimeoutId)
      this.idleTimeoutId = null
    }
  }

  disposeHost(reason, doNotReplenish) {
    if (this.disposing) {
      return
    }
    this.disposing = true
    const connection = this.connection
    if (connection) {
      this.connection_ready = false
      this.stopHeartbeat()
      this.connection = null
      if (connection) {
        connection.close()
      }
      this.cancelScripts()
      this.pool.removeHost(this, !doNotReplenish, reason)
      PoolHost._unregister(this)
    }
  }

  cancelScripts() {
    if (this.#inFlight) {
      const poolScript = this.#inFlight
      this.#inFlight = null
      this._scriptExit(poolScript, Fault.create('script.error.cancelled'))
    }
  }

  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatId = setInterval(
      () => {
        if (!this.heartbeatScriptId) { // <-- only send beat when there's not a beat already out there.
          this.heartbeatScriptId = createId().toString()
          this.connection.heartbeat(this.heartbeatScriptId)
        }
        if ((Date.now() - this.lastHeartbeat) > this.heartbeatTimeout) {
          if (this.disposeOnFailedHeartbeat) {
            this.disposeHost('heartbeat timeout')
          }
        }
      },
      this.heartbeatInterval
    )
    this.lastHeartbeat = Date.now()
  }

  stopHeartbeat() {
    if (this.heartbeatId) {
      clearInterval(this.heartbeatId)
      this.heartbeatScriptId = this.heartbeatId = null
    }
  }

  get rssSize() {
    return this._rssSize
  }

  get ready() {
    return this.connection_ready && !this.isRunning
  }

  get isRunning() {
    return !!this.#inFlight
  }

  get index() {
    return this.pool ? this.pool.hosts.indexOf(this) : -1
  }

  get name() {
    return 'host' + this.index
  }

  static _register(host) {
    if (!PoolHost._hosts) {
      PoolHost._hosts = new Set()
    }
    PoolHost._hosts.add(host)
  }

  static _unregister(host) {
    if (PoolHost._hosts) {
      PoolHost._hosts.delete(host)
    }
  }

  static get nextTaskId() {
    this._nextTaskId = ((this._nextTaskId || 0) + 1)
    return this._nextTaskId
  }

}

module.exports = PoolHost
