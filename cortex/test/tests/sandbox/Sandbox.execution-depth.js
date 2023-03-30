'use strict'

const server = require('../../lib/server'),
      should = require('should'),
      async = require('async'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl'),
      wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  main: function() {

    const objects = require('objects')
    objects.create('c_script_depth_before_triggers')

  },

  skip: true,

  before: function(ac, model, callback) {

    // install a trigger and a custom object to test subject updates.
    async.series([

      // create a custom object to receiver the trigger
      callback => {

        modules.db.models.object.aclCreate(
          server.principals.admin,
          {
            label: 'Execution Depth Test Trigger',
            name: 'c_script_depth_before_trigger',
            createAcl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole }],
            defaultAcl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Delete }]
          },
          err => {
            callback(err)
          }
        )
      },

      // install a before create trigger to handle depth trigger
      callback => {

        const Script = modules.db.models.getModelForType('script', 'trigger'),
              script = new Script(model.toObject())

        script.type = 'trigger'

        let modelAc = new acl.AccessContext(ac.principal, script, { method: 'put' })
        script.aclWrite(modelAc, { configuration: {
          inline: true,
          object: 'c_script_depth_before_trigger',
          event: 'create.before'
        } }, err => {
          if (err) {
            callback(err)
          } else {
            modelAc.save(err => {
              callback(err)
            })
          }
        })
      },

      // fire the trigger.
      callback => {

        ac.org.createObject('c_script_depth_before_trigger', (err, model) => {
          if (err) {
            return callback(err)
          }
          model.aclCreate(ac.principal, {}, err => {
            should.exist(err)
            err.errCode.should.equal('script.invalidArgument.executionDepthExceeded')
            callback()
          })
        })
      }

    ], callback)

  }

}

describe('Sandbox', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
