'use strict'

const Fault = require('cortex-service/lib/fault'),
      { rBool, rString, array: toArray } = require('../../lib/utils'),
      actions = ['throw', 'hide'],
      features = {

      }

module.exports = function(name, opts = {}) {

  features[name] = {
    name,
    action: ((action) => actions.includes(action)
      ? action
      : 'throw'
    )(rString(opts.action, 'throw')),
    active: rBool(opts.active, false), // active by default. overridden by org setting.
    admin: rBool(opts.admin, true), // requires both org level 'active' and admin level 'enabled'.
    description: rString(opts.description, '')
  }

  return function(req, res, next) {

    const { org } = req,
          { configuration } = org || {},
          { admin } = features[name],
          { features: orgFeatures } = configuration || {},
          { active, action, enabled } = toArray(orgFeatures).find(v => v.name === name) || features[name]

    if (active && (!admin || enabled)) {

      return next()

    } else if (action === 'throw') {

      return next(Fault.create('cortex.accessDenied.feature', { path: name }))

    }

    return next('route')
  }

}

module.exports.features = features
