'use strict'

const utils = require('../utils'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      defaults = {
        env: [],
        reason: 'Service is restricted'
      }

module.exports = function(opts) {

  const options = utils.extend({}, defaults, opts)
  options.env = utils.array(options.env, !!options.env)

  return function(req, res, next) {

    if (options.env.length) {
      for (let i = 0, j = options.env.length; i < j; i++) {
        let env = options.env[i]
        if (config('app.env') === env) {
          return next()
        }
      }
      next(Fault.create('cortex.accessDenied.unspecified', { reason: `Service is restricted to [${options.env}] env(s)`, path: req.route.path }))
    }

    next(Fault.create('cortex.accessDenied.unspecified', { reason: 'The service is inaccessible is in this environment', path: req.route.path }))

  }

}

module.exports.development = module.exports({ env: 'development' })
module.exports.production = module.exports({ env: 'production' })
