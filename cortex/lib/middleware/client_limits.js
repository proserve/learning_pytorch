'use strict'

const utils = require('../../lib/utils'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      _ = require('underscore')

exports = module.exports = function(options) {

  options = utils.extend({
    includeOrgs: [],
    excludeOrgs: [],
    allowSessions: true,
    allowSigned: true,
    allowUnsigned: false,
    whitelist: [],
    blacklist: []
  }, options)

  if (!_.isArray(options.includeOrgs)) options.includeOrgs = (options.includeOrgs == null ? [] : [options.includeOrgs])
  if (!_.isArray(options.excludeOrgs)) options.excludeOrgs = (options.excludeOrgs == null ? [] : [options.excludeOrgs]);

  [options.includeOrgs, options.excludeOrgs].forEach(function(arr) {
    arr.forEach(function(item, i, a) {
      a[i] = utils.getIdOrNull(item) || String(item)
    })
  })

  options.whitelist = utils.array(options.whitelist, !!options.whitelist)
  options.blacklist = utils.array(options.blacklist, !!options.blacklist);

  [options.whitelist, options.blacklist].forEach(arr =>
    arr.forEach(v => {
      if (!(utils.is_cidr(v) || utils.is_ipv4(v))) {
        throw new Error('client limits whitelist/blacklist must consist of valid ipv4 addresses and/or cidr ranges.')
      }
    })
  )

  return function(req, res, next) {

    const client = req.orgClient,
          clientIp = utils.getClientIp(req)

    if (client.key === config('webApp.apiKey')) {

      if (!options.allowSessions) {
        return next(Fault.create('cortex.accessDenied.app', { reason: 'App does not allow sessions.' }))
      }

    } else {

      // detect session/signed denial
      if ((!options.allowSessions && client.sessions) || (!options.allowSigned && !client.sessions)) {
        return next(Fault.create('cortex.accessDenied.app'))
      }

      // detect unsigned signing key
      if (!client.sessions && !options.allowUnsigned && !req.signature) {
        return next(Fault.create('cortex.accessDenied.app', { reason: 'Unsigned request api access denied.' }))
      }

    }

    // include/exclude orgs
    function match(v) {
      return (_.isString(v) && v === req.orgCode) || utils.equalIds(v, req.orgId)
    }

    if ((options.includeOrgs.length > 0 && !_.some(options.includeOrgs, match)) || (options.excludeOrgs.length > 0 && _.some(options.excludeOrgs, match))) {
      return next(Fault.create('cortex.accessDenied.app', { reason: 'Org api access denied.' }))
    }

    // match whitelist/blacklist
    if (options.whitelist.length > 0 && !utils.contains_ip(options.whitelist, clientIp)) {
      return next(Fault.create('cortex.accessDenied.app', { reason: clientIp + ' is not whitelisted.' }))
    } else if (options.blacklist.length > 0 && utils.contains_ip(options.blacklist, clientIp)) {
      return next(Fault.create('cortex.accessDenied.app', { reason: clientIp + ' is blacklisted.' }))
    }

    next()

  }

}
