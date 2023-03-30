'use strict'

var fs = require('fs'),
    path = require('path')

module.exports = fs.readdirSync(__dirname).reduce(function(exports, file) {
  if (!~['index.js', 'base.js'].indexOf(file)) {
    var Cls = require('./' + file)
    exports[path.basename(file, '.js')] = new Cls()
  }
  return exports
}, {})
