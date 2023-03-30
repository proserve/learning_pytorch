'use strict'

const qs = require('querystring')

module.exports = {

  parse: function(script, message, value, sep, eq, callback) {
    callback(null, qs.parse(value, sep, eq))
  },

  stringify: function(script, message, value, sep, eq, callback) {
    callback(null, qs.stringify(value, sep, eq))
  },

  escape: function(script, message, value, callback) {
    callback(null, qs.escape(value))
  },

  unescape: function(script, message, value, callback) {
    callback(null, qs.unescape(value))
  }

}
