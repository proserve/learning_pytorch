'use strict'

const fs = require('fs'),
      path = require('path'),
      _ = require('underscore'),
      utils = require('../../../utils'),
      logger = require('cortex-service/lib/logger'),
      AsyncFunction = Object.getPrototypeOf(async function() {}).constructor,
      local = {
        internal: read('internal'),
        object: read('object'),
        module: read('module')
      },

      remote = {
        object: createRemoteApi(local.object),
        module: createRemoteApi(local.module)
      }

module.exports = { local, remote, createRemoteApi }

// -------------------------------------------------------------------------

function createRemoteApi(ins) {

  return Object.keys(ins || {}).reduce((api, name) => {
    const val = ins[name]
    if (_.isFunction(val)) {
      const expectedLength = val instanceof AsyncFunction
        ? Math.max(0, val.length - 2) // [script], [message], ...
        : val.length - 3 // script, message, ..., callback
      api[name] = {
        $len: val.$is_var_args ? -1 : expectedLength
      }
      if (utils.isSet(val.$trace)) {
        api[name].$trace = utils.rBool(val.$trace, true)
      }
      if (utils.isSet(val.$stats)) {
        api[name].$stats = utils.rBool(val.$stats, true)
      }
    } else if (utils.isPlainObject(val)) {
      const out = createRemoteApi(val)
      if (out) {
        api[name] = out
      }
    } else if (val !== undefined) {
      api[name] = val
    }
    return api
  }, {})
}

function read(type) {
  return fs.readdirSync(path.join(__dirname, type)).reduce(function(exports, file) {
    const parts = file.split('.')
    try {
      let library = parts.slice(0, parts.length - 1).join('.'), filename = path.join(__dirname, type, file)
      if (library === 'should') {
        library = 'should.js'
      }
      const mod = require(filename)
      if (mod) {
        exports[library] = mod
      }

    } catch (err) {
      logger.error('Failed to load script: ' + file, utils.toJSON(err, { stack: true }))
    }
    return exports
  }, {})
}
