'use strict'

module.exports = {

  main: function() {

    const should = require('should');

    [undefined, null, 123, [], {}, new Date(), function() {}].forEach(function(v) {

      try {
        require(v)
      } catch (err) {
        if (err.message === 'require expects a single string argument') {
          return
        }
        throw err
      }
      throw new Error('Invalid library format should cause an error.')
    });

    (function loadMissingCustomModule() {
      try {
        // noinspection NpmUsedModulesInstalled
        require('c_not_a_module')
      } catch (err) {
        if (err.code === 'kNotFound') {
          return
        }
        throw err
      }
      throw new Error('Missing library should cause an error.')
    }());

    (function loadCustomModule() {
      // noinspection NpmUsedModulesInstalled
      var mod = require('c_scripting_require_test_module')
      should.equal(mod.foo(), 'bar')
    }())

    return true

  },

  before: function(ac, model, callback) {

    // create a library script.
    const Script = model.constructor,
          script = {
            type: 'library',
            label: 'Lib',
            active: true,
            script: 'module.exports = { foo: function() { return "bar"; } };',
            configuration: {
              export: 'c_scripting_require_test_module'
            }
          }
    Script.aclCreate(ac.principal, script, err => {
      callback(err)
    })
  }

}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
