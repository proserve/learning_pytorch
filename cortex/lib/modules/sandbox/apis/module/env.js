'use strict'

const _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../../../../modules'),
      acl = require('../../../../acl'),
      ap = require('../../../../access-principal'),
      { promised, createId } = require('../../../../utils'),
      consts = require('../../../../consts')

async function loadToken(token) {

  const baseOrg = await promised(modules.db.models.Org, 'loadOrg', acl.BaseOrg),
        ac = new acl.AccessContext(ap.synthesizeOrgAdmin(baseOrg, acl.SystemAdmin), null, { req: createId() })

  return promised(modules.authentication, 'authenticateToken', ac, token, { checkPolicy: true })
}

module.exports = {

  version: '1.0.0',

  createProvisioningToken: async function(script, message, apiKey, serviceAccountName, options) {

    if (!script.ac.principal.isSysAdmin()) {
      throw Fault.create('cortex.accessDenied.role', { reason: 'You are not a sys admin' })
    }

    options = _.pick(options, 'skipAcl', 'bypassCreateAcl', 'grant', 'permanent', 'activatesIn', 'validAt', 'expiresIn', 'isSupportLogin', 'maxUses')

    const opts = Object.assign({}, options, {
            scope: 'admin',
            includeEmail: true,
            policy: [
              { method: 'POST', path: '/sys/env' },
              { method: 'DELETE', route: '/sys/env/(.*)' }
            ]
          }),
          serviceAccount = await promised(ap, 'createServiceAccount', script.ac.org, serviceAccountName)

    if (!serviceAccount.isServiceAccount()) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Service account does not exists' })
    } else if (!serviceAccount.hasRole(consts.roles.admin)) {
      throw Fault.create('cortex.accessDenied.role', { reason: 'Service account must have admin role' })
    }

    return (await promised(
      modules.authentication,
      'createToken',
      script.ac,
      serviceAccount._id,
      apiKey,
      opts
    )).token

  },

  provision: async function(script, message, payload, options) {

    let authToken

    options = _.pick(options, 'token')
    options = Object.assign({}, options, { req: script.ac.req })

    if (options.token) {
      try {
        authToken = await loadToken(options.token)
        delete options.token
      } catch (e) {
        // do nothing
        authToken = null
      }
    }

    if (!((authToken && authToken.principal.isSysAdmin()) || script.ac.principal.isSysAdmin())) {
      throw Fault.create('cortex.accessDenied.role', { reason: 'You are not a sys admin' })
    }

    return modules.hub.provisionEnv(payload, options)

  },

  teardown: async function(script, message, code, options) {

    let authToken

    options = _.pick(options, 'token')
    options = Object.assign(options, { req: script.ac.req })

    if (options.token) {
      try {
        authToken = await loadToken(options.token)
        delete options.token
      } catch (e) {
        // do nothing
        authToken = null
      }
    }

    if (!((authToken && authToken.principal.isSysAdmin()) || script.ac.principal.isSysAdmin())) {
      throw Fault.create('cortex.accessDenied.role', { reason: 'You are not a sys admin' })
    }

    return modules.hub.teardownEnv(code, options)

  }

}
