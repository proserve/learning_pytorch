'use strict'

/* global org, consts */

const sandboxed = require('../../lib/sandboxed')

describe('CW-T52 - Admin user should be able to delete a script', function() {

  describe('CW-T52 - Delete a Script', function() {

    before(sandboxed(function() {
      org.objects.objects.insertOne({
        label: 'c_cw_t52_delete_script',
        name: 'c_cw_t52_delete_script',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'A', name: 'c_a', type: 'String', indexed: true },
          { label: 'B', name: 'c_b', type: 'String', indexed: true }
        ]
      }).execute()

      org.objects.script.insertOne({
        name: 'c_cw_t52_delete_script',
        label: 'Test Script',
        description: 'Test Script: Creates a custom object instance',
        type: 'library',
        script: `
          module.exports = {
            createInstance(propA, propB) {
              createInstanceFunc(propA, propB)
            }
          }

          function createInstanceFunc(propA, propB) {
            org.objects.c_cw_t52_delete_script.insertOne({
              c_a: propA,
              c_b: propB
            }).passive().execute()
          }
        `,
        configuration: {
          export: 'c_cw_t52_delete_script'
        }
      }).execute()
    }))

    after(sandboxed(function() {

      const Model = org.objects.c_cw_t52_delete_script
      org.objects.objects.deleteOne({
        name: Model.name
      }).execute()
    }))

    it('should delete a script', sandboxed(function() {
      require('should')

      org.objects.script.deleteOne({ name: 'c_cw_t52_delete_script' }).grant(consts.accessLevels.script).execute()

      let testScript = org.objects.script.find({ name: 'c_cw_t52_delete_script' }).grant(consts.accessLevels.script).toArray()
      testScript.length.should.equal(0)
    }))
  })
})
