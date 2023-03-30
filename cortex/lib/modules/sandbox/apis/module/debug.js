'use strict'

const config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      enableDebugModule = config('sandbox.debug.enableDebugModule'),
      CharStream = enableDebugModule ? require('../../../../classes/char-stream') : null

module.exports = !enableDebugModule ? undefined : {

  version: '1.0.0',

  log: (function() {
    const fn = function(script, message, payload, callback) {
      console.log.apply(console, payload) // eslint-disable-line no-console
      callback()
    }
    fn.$is_var_args = true
    return fn
  }()),

  echo: function(script, message, value, callback) {
    callback(null, value)
  },

  fault: function(script, message, fault, callback) {
    callback(Fault.from(fault, false, true))
  },

  emit: function(script, message, event, payload, callback) {
    if (config('__is_mocha_test__')) {
      require('../../../../../test/lib/server').events.emit(event, payload)
    }
    callback()
  },

  /**
   * @api sandbox
   * @apiPrivate
   *
   */
  streams: {

    /**
     *
     *
     * @param script
     * @param message
     * @param options
     *  sz
     *  buflen
     *  chars
     *  objectMode
     * @param callback
     */
    random: function(script, message, options, callback) {

      callback(null, new CharStream(options || {}))

    }

  }

}
