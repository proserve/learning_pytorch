'use strict'

const modules = require('../../lib/modules')

module.exports = function() {

  return function(req, res, next) {
    req.locale = modules.locale.discern(req, { ensure: true })
    next()
  }

}
