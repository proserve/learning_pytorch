'use strict'

const server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl'),
      wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  main: function() {

    const views = require('views')

    // custom
    views.run('c_script_view_test', { where: { c_invalid: 'bad path' } }) // "where" is for coverage, and should be ignored since it's an invalid variable.

    // built-in
    views.run('number-of-logins-since', { where: { since: new Date() } })

    return true

  },

  before: function(ac, model, callback) {

    modules.db.models.view.aclCreate(
      server.principals.admin,
      {
        label: 'script_view_test',
        name: 'c_script_view_test',
        sourceObject: 'account',
        acl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
        objectAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier, allow: acl.AccessLevels.Connected }]
      },
      err => {
        callback(err)
      }
    )
  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
