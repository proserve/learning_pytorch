'use strict'

const server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl'),
      wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  main: function() {

    require('should')

    const name = 'c_script_modules_transfer_tests',
          objects = require('objects'),
          consts = require('consts'),
          script = require('script')

    // create
    let instance = objects.create(name, {});

    (instance.owner._id + '').should.equal(script.principal._id + '')

    // already owner
    objects.transfer(name, instance._id, script.principal._id).should.equal(false)

    // new owner
    objects.transfer(name, instance._id, script.__mocha_principals__.provider._id).should.equal(true);

    // ensure it stuck.
    (objects.read(name, instance._id, { skipAcl: true, grant: consts.accessLevels.read }).owner._id + '').should.equal(script.__mocha_principals__.provider._id + '');

    // call built-in object
    (function builtIn() {
      try {
        objects.transfer('accounts', script.principal._id, script.__mocha_principals__.provider._id)
      } catch (err) {
        if (err.reason === 'A transfer cannot occur in objects without owners.') {
          return
        }
        throw err
      }
      throw new Error('A builtIn name should cause an error')
    }());

    // call built-in account
    (function builtIn() {
      try {
        objects.transfer(name, instance._id, consts.principals.anonymous)
      } catch (err) {
        if (err.reason === 'Built-in accounts cannot own object instances.') {
          return
        }
        throw err
      }
      throw new Error('A builtIn account should cause an error')
    }())

    return true
  },

  before: function(ac, model, callback) {

    // create a custom object to test.
    modules.db.models.object.aclCreate(server.principals.admin, {
      name: 'c_script_modules_transfer_test',
      label: 'Test',
      defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }],
      createAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }]
    }, callback)
  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
