'use strict'

const modules = require('../../../../modules'),
      { isFunction } = require('underscore')

let Undefined

function enforceNonNull(key = null) {
  return (key === null || key === Undefined) ? '' : String(key)
}

module.exports = {

  keys: function(script, message, options, callback) {

    options = options || {}
    modules.config.keys(script.ac.org, { extended: options.extended, publicOnly: options.publicOnly, values: options.values }, callback)
  },

  get: function(script, message, key, options, callback) {
    options = options || {}
    modules.config.get(script.ac.org, enforceNonNull(key), { extended: options.extended, publicOnly: options.publicOnly }, callback)
  },

  set: function(script, message, key, val, options, callback) {

    options = options || {}
    modules.config.set(script.ac.org, enforceNonNull(key), val, { isPublic: options.isPublic }, callback)
  }

}

Object.values(module.exports).forEach(fn => {
  if (isFunction(fn)) {
    fn.$trace = fn.$stats = false
  }
})
