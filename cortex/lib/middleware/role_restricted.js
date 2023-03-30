'use strict'

const utils = require('../utils'),
      Fault = require('cortex-service/lib/fault'),
      consts = require('../consts'),
      defaults = {
        require: []
      }

/**
 * role-based authentication for api routes.
 */
exports = module.exports = function(opts) {

  const options = utils.extend({}, defaults, opts)
  options.require = utils.array(options.require, !!options.require)

  return function(req, res, next) {

    if (!req.principal) {
      return next(Fault.create('cortex.accessDenied.role'))
    }
    for (let i = 0, j = options.require.length; i < j; i++) {
      let role = options.require[i]
      if (role === 'sysAdmin') {
        if (req.principal.isSysAdmin()) {
          return next()
        }
      } else if (req.principal.hasRole(role)) {
        return next()
      }
    }
    next(Fault.create('cortex.accessDenied.role'))

  }

}

exports.developer_and_support_only = exports({ require: [consts.roles.developer, consts.roles.support] })
exports.developer_only = exports({ require: consts.roles.developer })
exports.support_only = exports({ require: consts.roles.support })
exports.org_admin_only = exports({ require: [consts.roles.admin] })
exports.medable_admin_only = exports({ require: 'sysAdmin' })
