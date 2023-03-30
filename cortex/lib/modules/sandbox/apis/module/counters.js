'use strict'

const utils = require('../../../../utils'),
      modules = require('../../../../modules'),
      { isFunction } = require('underscore')

module.exports = {

  version: '1.0.0',

  get: function(script, message, key, callback) {

    modules.counters.get(script.ac.org, utils.rString(key, ''), callback)

  },

  next: function(script, message, key, callback) {

    modules.counters.next(script.ac.org, utils.rString(key, ''), callback)

  },

  has: function(script, message, key, callback) {

    modules.counters.has(script.ac.org, utils.rString(key, ''), callback)

  },

  del: function(script, message, key, callback) {

    modules.counters.del(script.ac.org, utils.rString(key, ''), callback)

  },

  list: function(script, message, search, skip, limit, callback) {

    modules.counters.list(script.ac.org, utils.rString(search, ''), skip, limit, callback)

  },

  count: function(script, message, search, callback) {

    modules.counters.count(script.ac.org, utils.rString(search, ''), callback)

  },

  clear: function(script, message, search, callback) {

    modules.counters.clear(script.ac.org, utils.rString(search, ''), callback)

  }

}

Object.values(module.exports).forEach(fn => {
  if (isFunction(fn)) {
    fn.$trace = fn.$stats = false
  }
})
