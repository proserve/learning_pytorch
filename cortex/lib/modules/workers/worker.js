'use strict'

const utils = require('../../utils'),
      _ = require('underscore')

function Worker() {
  this.options = {
  }
}

Worker.prototype.priority = 0

Worker.prototype.init = function(options) {
  this.options = utils.extend(true, this.options, options || {})
}

/**
 * processes some work.
 *
 * @param message a worker message
 * @param payload worker payload
 * @param options worker options
 * @param callback a callback function that is called with err, handled, results
 */
Worker.prototype.process = function(message, payload, options, callback) {

  if (_.isFunction(payload)) {
    callback = payload
    payload = message.payload
    options = message.options
  } else if (_.isFunction(options)) {
    callback = options
    options = message.options
  } else if (arguments.length === 1) {
    callback = utils.nullFunc
    payload = message.payload
    options = message.options
  }

  this._process(message, payload, options, callback)
}

// noinspection JSUnusedLocalSymbols
/**
 * processes some work.
 *
 * @param message a worker message
 * @param payload worker payload
 * @param options worker options
 * @param callback a callback function that is called with err, handled, results
 */
Worker.prototype._process = function(message, payload, options, callback) {

  throw new Error('cortex.error.pureVirtual')

}

module.exports = Worker
