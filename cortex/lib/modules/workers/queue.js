'use strict'

const Startable = require('cortex-service/lib/startable'),
      _ = require('underscore'),
      async = require('async'),
      logger = require('cortex-service/lib/logger'),
      Fault = require('cortex-service/lib/fault'),
      { equalIds } = require('cortex-service/lib/utils/ids')

class Queue extends Startable {

  constructor(name, options) {
    super(name, options)
    this._inflight = new Set()
  }

  listen(queue, options) {
    return this._listen(queue, options)
  }

  inflight() {
    return this._inflight.size
  }

  processed(message, err, result, callback) {
    this._processed(message, err, result, err => {
      this._inflight.delete(message)
      if (_.isFunction(callback)) {
        try {
          callback(err)
        } catch (e) {
          logger.verbose('unhandled Queue processed callback exception', Fault.from(e).toJSON({ stack: true }))
        }
      }
    })
  }

  _listen(queue, options) {
    throw Fault.create('cortex.notImplemented.unspecified')
  }

  _emitMessage(message) {
    this._inflight.add(message)
    this.emit('message', message)
  }

  findMessages(identifier) {

    const messages = []
    for (const message of this._inflight) {
      if (equalIds(message._id, identifier) || message.worker === identifier) {
        messages.push(message)
      }
    }
    return messages
  }

  _emitError(err, message) {
    this.emit('error', err, message)
  }

  _error(err, message, callback) {

    try {
      this._emitError(err, message)
    } catch (e) {
      logger.verbose('emitted error but no one was listening', err.toJSON({ stack: true }))
    }
    if (_.isFunction(callback)) {
      try {
        callback(err)
      } catch (e) {
        logger.verbose('unhandled Queue callback exception', Fault.from(e).toJSON({ stack: true }))
      }
    }
  }

  _processed(message, err, result, callback) {
    throw Fault.create('cortex.error.pureVirtual')
  }

  _waitStart(callback) {
    callback()
  }

  _waitStop(callback) {

    let current
    async.whilst(() => {
      const inflight = this.inflight()
      if (inflight > 0 && inflight !== current) {
        current = inflight
        logger.info('waiting for ' + current + ' inflight messages to complete.')
      }
      return inflight > 0
    }, function(callback) {
      setTimeout(callback, 100)
    }, function() {
      setImmediate(callback)
    })

  }

}

module.exports = Queue
