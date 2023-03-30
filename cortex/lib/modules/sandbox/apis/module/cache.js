'use strict'

const { rString } = require('../../../../utils'),
      { isFunction } = require('underscore'),
      modules = require('../../../../modules')

module.exports = {

  version: '1.0.0',

  get: function(script, message, key, callback) {

    modules.cache.get(script.ac.org, rString(key, ''), callback)

  },

  has: function(script, message, key, callback) {

    modules.cache.has(script.ac.org, rString(key, ''), callback)

  },

  set: function(script, message, key, val, ttl, callback) {

    modules.cache.set(script.ac.org, rString(key, ''), val, ttl, callback)

  },

  counter: function(script, message, key, ttl, callback) {

    modules.cache.counter(script.ac.org, rString(key, ''), ttl, callback)

  },

  cas: function(script, message, key, chk, val, ttl, callback) {

    modules.cache.cas(script.ac.org, rString(key, ''), chk, val, ttl, callback)

  },

  del: function(script, message, key, callback) {

    modules.cache.del(script.ac.org, rString(key, ''), callback)

  },

  find: function(script, message, search, skip, limit, callback) {

    modules.cache.find(script.ac.org, rString(search, ''), skip, limit, callback)

  },

  list: function(script, message, search, skip, limit, callback) {

    modules.cache.list(script.ac.org, rString(search, ''), skip, limit, callback)

  },

  count: function(script, message, search, callback) {

    modules.cache.count(script.ac.org, rString(search, ''), callback)

  },

  clear: function(script, message, search, callback) {

    modules.cache.clear(script.ac.org, rString(search, ''), callback)

  }

}

Object.values(module.exports).forEach(fn => {
  if (isFunction(fn)) {
    fn.$trace = fn.$stats = false
  }
})
