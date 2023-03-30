/* global CortexObject */

const { Emitter } = require('events'),
      { driver: { insertOne } } = require('objects'),
      extend = require('util.deep-extend'),
      { Cursor, ApiCursor, BufferedApiCursor } = require('util.cursor'),
      { OpaqueStream } = require('stream'),
      { isFunction } = require('util.values'),
      { Runtime: EventRuntime } = require('runtime.event'),
      { Runtime: TriggerRuntime } = require('runtime.trigger')

let native = module.exports,
    pExited = Symbol('exited'),
    pResult = Symbol('result'),
    script,
    Undefined

class Script extends Emitter {

  constructor() {
    super()
    this[pExited] = false
    this[pResult] = Undefined
  }

  exit(result = Undefined) {
    if (!this[pExited]) {
      this[pExited] = true
      this[pResult] = result
      this.emit('exit', result)
      result = this[pResult]
      if (result && result instanceof Cursor) {
        if (result instanceof BufferedApiCursor) {
          result.shared()
        }
        result = result.passthru(false)
      } else if (result && result instanceof OpaqueStream) {
        result = result.getOptions()
      }
      this.__exit(result)
    }
  }

  as(principal, options, handler) {

    if (isFunction(options)) {
      handler = options
      options = null
    }

    let result = this.__as(principal, options, handler)

    if (result && !(result instanceof Cursor) && result._id) {
      if (result.object === 'stream') {
        result = new OpaqueStream(result)
      } else if (result.object === 'cursor') {
        result = new ApiCursor(result)
      }
    }

    if (result instanceof Cursor) {
      result = this.__as(principal, options, () => {
        if (result instanceof BufferedApiCursor) {
          result.shared()
        }
        return result.passthru(false)
      })
    }

    return result

  }

  get exited() {
    return this[pExited]
  }

  get result() {
    return this[pResult]
  }

  set result(result) {
    this[pResult] = result
  }

  fire(event, ...params) {

    EventRuntime.fire({ source: 'script', event, params })

  }

  trigger(...params) {

    TriggerRuntime.trigger(...params)

  }

}

script = new Script()

script.fire.async = function(event, ...params) {

  return insertOne('event', {
    object: 'event',
    document: {
      type: 'script',
      event,
      principal: script.principal._id,
      param: params
    },
    skipAcl: true,
    bypassCreateAcl: true,
    grant: 'update'
  })

}

module.exports = extend(script, native, global.env.script)

if (typeof script.principal === 'object' && script.principal.object === 'account') {
  script.principal = CortexObject.from(script.principal)
}

if (typeof script.org === 'object' && script.org.object === 'org') {
  script.org = CortexObject.from(script.org)
}

// the script api is defined in the native module. attach here.
script.__post = function() {

  // attach context api to script context
  const contextApi = this.api && this.api.context

  if (contextApi) {

    const context = this.context || (this.context = {})
    Object.assign(context, contextApi)

    if (this.type === 'trigger' && this.inline && this.arguments.new) {
      Object.assign(this.arguments.new, contextApi)
    }
  }

}
