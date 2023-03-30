'use strict'

const EventEmitter = require('events').EventEmitter,
      Messages = require('../messages'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      _ = require('underscore')

class Connection extends EventEmitter {

  open() {
    this.emit('ready')
  }

  send() {}
  listen() {}

  close(err) {
    if (this.closing) return
    this.closing = true
    this._close(err)
    this.emit('close', err)
    this.removeAllListeners()
    this.closing = false
  }

  _close() {}

  _handle(message) {
    setImmediate(() => {
      const type = message.type
      if (type === Messages.Codes.kResult || type === Messages.Codes.kTask) {
        this.emit('message', message)
      } else if (type === Messages.Codes.kInit) {
        this.emit('init', message)
        setImmediate(() => this.send(new Messages.Ready()))
      } else if (type === Messages.Codes.kReady) {
        this.emit('ready', message)
      } else if (type === Messages.Codes.kHeartbeat) {
        this.emit('heartbeat', message)
      } else {
        this.emit('message', message)
      }
    })
  }

  heartbeat(runId, message) {
    this.send(new Messages.Heartbeat(runId, message))
  }

  // simple encode
  static encode(message) {
    message = message.toJSON()
    return utils.serializeObject(message)
  }

  // simple encode
  static decode(data) {

    try {
      if (!(data instanceof Buffer)) {
        if (data && data.type === 'Buffer' && _.isArray(data.data)) {
          data = Buffer.from(data)
        }
      }
      return Messages.parse(utils.deserializeObject(data))
    } catch (err) {
      return new Messages.Error(Fault.create('cortex.error.sandbox', { reason: 'failed to decode sandbox message.' }))
    }
  }

}

module.exports = Connection
