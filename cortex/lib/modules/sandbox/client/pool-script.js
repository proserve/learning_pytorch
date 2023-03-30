'use strict'

const _ = require('underscore'),
      { Readable, Stream } = require('stream'),
      tracer = require('dd-trace'),
      { IncomingMessage } = require('http'),
      { EventEmitter } = require('events'),
      { OutputCursor, createId, rBool, rInt, array: toArray, getIdOrNull, isNumeric } = require('../../../utils'),
      ap = require('../../../access-principal'),
      { ArrayOutputCursor } = require('cortex-service/lib/utils/output'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      logger = require('cortex-service/lib/logger'),
      modules = require('../../../modules'),
      maxScriptCursors = 10,
      maxScriptStreams = 10

let Undefined

class BlankReadableStream extends Readable {

  _read() {
    this.push(null)
  }

}

class ScriptStream {

  constructor(stream, { script } = {}) {

    this._id = createId()
    this._script = script
    this._stream = stream
    this._metadata = this.generateMetadata()
    if (script) {
      script._streams[this._id] = this
    }

    this._streamError = null

    stream.removeAllListeners('data')
    stream.unpipe()
    stream.pause()

    this._streamHandlers = {
      on: stream.on,
      addEventListener: stream.addEventListener,
      resume: stream.resume,
      pipe: stream.pipe
    }

    stream.on = stream.addEventListener = (event, fn) => {
      if (event === 'data') {
        logger.warn(new Error('script stream source tried to listen to onData event'))
        return
      }
      this._streamHandlers.on.call(this, event, fn)
    }

    stream.resume = () => {
      logger.warn(new Error('script stream source tried to resume()'))
    }

    stream.pipe = () => {
      logger.warn(new Error('script stream source tried to pipe()'))
    }

    this._streamListeners = {
      error: (err) => {
        this.setError(err)
      }
    }

    // hook up events.
    Object.keys(this._streamListeners).forEach(event => stream.on(event, this._streamListeners[event]))

  }

  toJSON() {

    return {
      ...(this._metadata || {}),
      _id: this._id,
      object: 'stream'
    }

  }

  generateMetadata() {

    if (this._stream && this._stream instanceof IncomingMessage) {

      return {
        headers: this._stream.headers || {}
      }

    }

    return {}

  }

  detach() {

    const { _stream: stream, _script: script } = this
    if (stream) {

      Object.keys(this._streamListeners).forEach(event => {
        stream.removeListener(event, this._streamListeners[event])
      })
      Object.keys(this._streamHandlers).forEach(fn => {
        stream[fn] = this._streamHandlers[fn]
      })

      if (script) {
        delete script._streams[this._id]
        delete this._script
      }

      delete this._stream

    }
    return stream
  }

  destroy(err) {
    this.setError(err)
    const stream = this.detach()
    if (stream) {
      try {
        if (err) {
          stream.once('error', err => {
            void err // prevent unhandled exception while allowing other listeners to catch the error on the stream.
          })
        }
        stream.destroy(err)
      } catch (err) {
        void err
      }
    }
  }

  getError() {
    return this._streamError
  }

  setError(err, force = false) {
    if (!this._streamError || force) {
      this._streamError = Fault.from(err)
    }
  }

}

class ScriptCursor extends OutputCursor {

  constructor(script, cursor) {
    super()
    this._script = script
    this._cursor = cursor
    this._script._cursors[this._id] = this

    this._errorListener = () => { }
    cursor.addListener('error', this._errorListener)
    this.addListener('error', this._errorListener)
  }

  toJSON() {

    return {
      ...super.toJSON(),
      type: 'script',
      script: this._script && this._script._id,
      cursor: this._cursor && this._cursor.toJSON()
    }
  }

  detach() {
    const cursor = this._cursor
    if (cursor) {
      cursor.removeListener('error', this._errorListener)
      delete this._script._cursors[this._id]
      delete this._script
      delete this._cursor
    }
    return cursor
  }

  close(callback) {
    const cursor = this.detach()
    if (cursor) {
      cursor.close(() => {
        super.close(callback)
      })
    } else {
      super.close(callback)
    }
  }

  isClosed() {
    const cursor = this._cursor
    return !cursor || cursor.isClosed()
  }

  hasMore() {
    const cursor = this._cursor
    if (cursor) {
      return cursor.hasMore()
    } else {
      return false
    }
  }

  next(callback) {
    const cursor = this._cursor
    if (cursor) {
      cursor.next((err, next) => {
        this._replyNext(err, next, callback)
      })
    } else {
      this._replyNext(null, Undefined, callback)
    }
  }

  hasNext(callback) {
    const cursor = this._cursor
    if (cursor) {
      cursor.hasNext((err, has) => {
        this._replyHasNext(err, has, callback)
      })
    } else {
      this._replyHasNext(null, false, callback)
    }
  }

  abort(callback) {
    const cursor = this._cursor
    if (cursor) {
      cursor.abort(() => {
        super.abort(callback)
      })
    } else {
      super.abort(callback)
    }
  }

  destroy(err, callback) {
    const cursor = this._cursor
    if (cursor) {
      cursor.destroy(err, () => {
        super.destroy(err, callback)
      })
    } else {
      super.destroy(err, callback)
    }
  }

  fetch(batchSize, callback) {
    const cursor = this._cursor
    if (cursor) {
      cursor.fetch(batchSize, callback)
    } else {
      setImmediate(callback, null, { buffer: [], hasMore: false })
    }
  }

}

class PoolScript extends EventEmitter {

  /**
     *
     * @param ac
     * @param parentScript
     * @param options { stealthy, api, configuration, environment, source, attachedSubject, mustRunNext, queuePriority, closeAllResourcesOnExit, routeQueueTimeout, queueTimeout, as: {principal, modules, acl}}
     * @param fnStart
     * @param fnExit
     * @param options { principal, modules, options }
     */
  constructor(ac, parentScript, options, fnStart, fnExit) {

    super()

    this.ac = ac
    this.parent = parentScript
    this.runId = createId().toString()
    this.compile = options.compile
    this.configuration = options.configuration || {}
    this.api = options.api
    this.stealthy = options.stealthy
    this.environment = options.environment || {}
    this.source = options.source || ''
    this.format = options.format || 'source'
    this.attachedSubject = options.attachedSubject || null // the attached subject. used for realtime updating of contexts from scripts.
    this._responseHasEnded = false
    this._closeAllResourcesOnExit = rBool(options.closeAllResourcesOnExit, false)
    this._cursors = {}
    this._streams = {}
    this._connections = {} // sftp, etc.
    this._principals = []
    this._pushPrincipal(ac.principal, options.as || { modules: { safe: false }, acl: { safe: false } })

    this.mustRunNext = rBool(options.mustRunNext, false)

    let priority = Number.MAX_SAFE_INTEGER

    if (this.mustRunNext) {
      priority = -1
    } else if (isNumeric(options.queuePriority)) {
      priority = parseFloat(options.queuePriority)
    } else if (this.configuration.isInline) {
      priority = -1
    } else if (this.configuration.type === 'job' || this.configuration.type === 'event') {
      priority = 0
    } else if (this.configuration.type === 'route') {
      priority = 1
    } else if (this.configuration.type !== 'trigger') {
      priority = 2
    }
    this.queuePriority = priority

    this._queueTimeout =
            this.configuration.type === 'route'
              ? rInt(options.routeQueueTimeout, (config('sandbox.pool.routeQueueTimeout')))
              : rInt(options.queueTimeout, (config('sandbox.pool.queueTimeout')))

    this.fnStart = fnStart
    this.fnExit = async(err, result, poolScript, stats) => {

      for (let _id of Object.keys(this._connections)) {
        this.connectionClose(_id, () => {})
      }

      // only stream cursors when the response is available.
      if (!err && !this.closeAllResourcesOnExit && !this.hasResponded && result && result.object === 'cursor') {
        const cursor = this.getCursor(result._id)
        if (cursor) {
          result = cursor.detach()
        } else {
          result = new ArrayOutputCursor([])
        }
      }
      for (let _id of Object.keys(this._cursors)) {
        this._cursors[_id].close(() => {})
      }

      if (!err && !this.closeAllResourcesOnExit && !this.responseHasEnded && result && result.object === 'stream') {

        const scriptStream = this.getStream(result._id),
              realStream = scriptStream && scriptStream.detach()

        if (realStream) {
          result = realStream || new BlankReadableStream()
        }

      }
      for (let _id of Object.keys(this._streams)) {
        try {
          this._streams[_id].destroy(err)
        } catch (err) {
          void err
        }
      }

      this.emit('exit', (err, result))

      fnExit(err, result, poolScript, stats)
    }

    this.stats = {
      bytesIn: 0,
      bytesOut: 0,
      callouts: 0,
      calloutsMs: 0
    }
  }

  updateOrg(org) {
    this._principals.forEach(p => p.principal.updateOrg(org))
    this.ac.updateOrg(org)
    if (this.parent) {
      this.parent.updateOrg(org)
    }
  }

  pushPrincipal(principal, options, callback) {

    ap.create(this.ac.org, principal, (err, principal) => {
      if (!err) {
        try {
          this._pushPrincipal(principal, options)
        } catch (e) {
          err = e
        }
        if (!err) {
          this.ac.principal = principal
        }
      }
      callback(err, principal)
    })
  }

  popPrincipal() {
    if (this._principals.length > 1) {
      this._principals.pop()
      this.ac.principal = this._principals[this._principals.length - 1].principal
    }
  }

  /**
     *
     * @param principal
     * @param options { principal, modules, acl, safe }
     * @private
     */
  _pushPrincipal(principal, options = {}) {

    options = options || {}

    let tmp, aclOptions, moduleOptions

    const safe = rBool(options.safe, true)

    tmp = options.acl || {}
    aclOptions = {
      safe: rBool(tmp.safe, safe),
      blacklist: toArray(tmp.blacklist, tmp.blacklist)
    }
    if (aclOptions.safe) {
      aclOptions.blacklist = aclOptions.blacklist.concat(['skipAcl', 'grant', 'roles', 'bypassCreateAcl'])
    }
    aclOptions.blacklist = _.uniq(aclOptions.blacklist
      .map(v => _.isString(v) ? v.trim() : null)
      .filter(v => v)
      .concat(this._principals.length ? this._principals[this._principals.length - 1].acl.blacklist : []))

    // -------------

    principal.merge(this.ac, options.principal || {})

    // -------------

    function fix(list) {
      return toArray(list, list).map(v => _.isString(v) ? v.toLowerCase().trim().split('.') : []).filter(v => v.length)
    }

    tmp = options.modules || {}
    moduleOptions = {
      safe: rBool(tmp.safe, safe),
      whitelist: toArray(tmp.whitelist, tmp.whitelist),
      blacklist: toArray(tmp.blacklist, tmp.blacklist)
    }
    if (moduleOptions.safe) {
      moduleOptions.blacklist = moduleOptions.blacklist.concat([
        'api',
        'cache',
        'connections',
        'console',
        'debug',
        'http',
        'logger',
        'notifications',
        'objects.transfer',
        'response',
        'script',
        'session',
        'system'
      ])
    }
    moduleOptions.whitelist = fix(moduleOptions.whitelist)
    moduleOptions.blacklist = fix(moduleOptions.blacklist)

    this._principals.push({ principal, modules: moduleOptions, acl: aclOptions })
  }

  allowedOptions(optionsObject, ...filteredOptions) {

    const p = this._principals, b = p.length && p[p.length - 1].acl.blacklist

    filteredOptions = (b && b.length) ? filteredOptions.filter(v => !b.includes(v)) : filteredOptions

    return _.pick(optionsObject || {}, filteredOptions)

  }

  allowCommand(command) {

    command = String(command).toLowerCase().trim().split('.')
    function matchCommand(listed) {

      const to = Math.min(command.length, listed.length)
      for (let i = 0; i < to; i++) {

        if (listed[i] === '*' || listed[i] === command[i]) {
          if (i === to - 1) {
            return true
          }
        } else {
          return false
        }
      }
      return true
    }

    const p = this._principals
    for (let i = 0; i < p.length; i++) {
      const whitelist = p[i].modules.whitelist
      if (whitelist.length) {
        if (!whitelist.find(matchCommand)) {
          return false
        }
      }
    }

    for (let i = 0; i < p.length; i++) {
      const blacklist = p[i].modules.blacklist
      if (blacklist.find(matchCommand)) {
        return false
      }
    }

    return true

  }

  get root() {
    let root = this
    while (root.parent) {
      root = root.parent
    }
    return root
  }

  get numCursors() {
    return Object.keys(this._cursors).length
  }

  get numStreams() {
    return Object.keys(this._streams).length
  }

  get queueTimeout() {
    return this.parent ? Math.min(this._queueTimeout, Math.max(0, this.timeLeft)) : this._queueTimeout
  }

  get timeLeft() {
    const elapsed = this.start_time ? new Date() - this.start_time : 0
    return Math.max(0, this.configuration.timeoutMs - elapsed)
  }

  get locale() {
    return this.configuration.locale
  }

  set locale(locale) {

    locale = modules.locale.getCaseMatch(locale)
    if (locale) {
      this.$__fixed_locale = locale
      this.ac.setLocale(locale)
      this.configuration.locale = this.ac.getLocale()
    }

  }

  get fixedLocale() {
    return this.$__fixed_locale
  }

  markStarted() {

    this.start_time = new Date()
  }

  getCursor(from) {
    return this._cursors[getIdOrNull(from, true)]
  }

  registerCursor(cursor) {

    if (!(cursor instanceof OutputCursor)) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'input cursor expected.' })
    } else if (cursor instanceof ScriptCursor) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'cursor is already registered to a script.' })
    } else if (this.numCursors >= maxScriptCursors) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'too many open cursors.' })
    }
    return new ScriptCursor(this, cursor)
  }

  getStream(from) {
    return this._streams[getIdOrNull(from, true)]
  }

  registerStream(stream) {

    if (!(stream instanceof Stream)) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'input stream expected.' })
    } if (this.numStreams >= maxScriptStreams) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'too many open streams.' })
    }
    return new ScriptStream(stream, { script: this })
  }

  get numConnections() {
    return Object.keys(this._connections).length
  }

  registerConnection(connection) {
    this._connections[connection._id] = connection
    return connection
  }

  get connections() {
    return Object.values(this._connections)
  }

  getConnection(_id) {
    return this._connections[_id]
  }

  connectionClose(_id, callback) {
    const connection = this._connections[_id]
    if (connection) {
      delete this._connections[_id]
      connection.close(err => {
        callback(err)
      })
      return
    }
    setImmediate(callback)
  }

  get scriptExecutionDepth() {
    let d = 1, script = this
    while (script.parent) {
      d++
      script = script.parent
    }
    return d
  }

  get hasResponded() {

    const req = this.ac.req,
          res = req ? req.res : null

    if (res && res.headersSent) {
      return true
    }

    return this.responseHasEnded
  }

  get closeAllResourcesOnExit() {
    return this._closeAllResourcesOnExit
  }

  set closeAllResourcesOnExit(close) {
    this._closeAllResourcesOnExit = !!close
  }

  get responseHasEnded() {
    return this._responseHasEnded
  }

  get lastTrace() {
    return this._last_trace || null
  }

  set lastTrace(trace) {
    this._last_trace = trace
  }

  endResponse(value = null, encoding) {
    if (this.responseHasEnded) {
      return false
    }
    if (value !== null) {
      this.writeToResponseBuffer(value, encoding)
    }
    this._responseHasEnded = true
    const req = this.ac.req,
          res = req ? req.res : null
    if (res && _.isFunction(res.end)) {
      res.end()
    }
  }

  writeToResponseBuffer(value, encoding) {

    if (this.responseHasEnded) {
      throw Fault.create('script.error.headersWritten')
    }

    const req = this.ac.req,
          res = req ? req.res : null
    if (res && _.isFunction(res.write)) {
      if (!_.isString(value) && !(value instanceof Buffer)) {
        value = String(value)
      }
      if (value.length) {
        res.write(value, encoding)
      }
      return true
    }
    return false
  };

  // TODO: to avoid any vendor locking, this datadog impl can be replaced with opentelemetry
  startChildSpan(message = {}, isSandbox = false) {
    try {
      if (this.isTracingEnabled() && this.ac?.req?.res) {
        if (!this.ac.req._datadog) {
          // before going to the sandbox for the first time, we should encapsulate the root span information to restore to add more spans to it
          const span = tracer.scope().active()
          this.ac.req._datadog = {}
          tracer.inject(span, 'http_headers', this.ac.req._datadog)
          // Last Result message should be finished after the express request is done
          this.ac.req.res.on('finish', () => {
            if (this.ac.req._ddSpan) this.ac.req._ddSpan.finish()
          })
        }
        // restoring the root span
        const childOf = tracer.extract('http_headers', this.ac.req._datadog),
              tags = {
                org: this.ac.org.code,
                runId: message.runId,
                code: message.source,
                taskId: message.taskId,
                kind: message.kind,
                command: message.command,
                'service.kind': 'message'
              }

        if (config('instrumentation.datadog.dd-trace.level') === 'sensitive') {
          tags.payload = JSON.stringify(message.payload)
          tags.result = JSON.stringify(message.result)
          tags.environment = message.environment
          tags.configuration = message.configuration
        }
        if (isSandbox) tags['service.name'] = 'cortex-sandbox'
        let options = { tags }
        if (childOf) {
          options.childOf = childOf
          // if Previous child span is still active, we stop it here
          if (this.ac.req?._ddSpan) {
            this.ac.req._ddSpan.finish()
          }
          this.ac.req._ddSpan = tracer.startSpan(message.constructor.name, options)
        }
      }
    } catch (err) {
      logger.warn('[dd-tracer] error', err.toJSON({ stack: true }))
    }
  }

  isTracingEnabled() {
    return config('instrumentation.enabled') && config('instrumentation.datadog.dd-trace.enabled') && ['sensitive', 'basic'].includes(config('instrumentation.datadog.dd-trace.level'))
  }

}

module.exports = PoolScript
