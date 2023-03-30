'use strict'

/* global org, consts */

const sandboxed = require('../../lib/sandboxed')

describe('CW-T51 - Admin user should be able to edit a script', function() {

  describe('CW-T51 - Edit a Script', function() {

    before(sandboxed(function() {
      org.objects.objects.insertOne({
        label: 'c_cw_t51_edit_script',
        name: 'c_cw_t51_edit_script',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'A', name: 'c_a', type: 'String', indexed: true },
          { label: 'B', name: 'c_b', type: 'String', indexed: true }
        ]
      }).execute()

      org.objects.script.insertOne({
        name: 'c_cw_t51_edit_script',
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
            org.objects.c_cw_t51_edit_script.insertOne({
              c_a: propA,
              c_b: propB
            }).passive().execute()
          }
        `,
        configuration: {
          export: 'c_cw_t51_edit_script'
        }
      }).execute()
    }))

    after(sandboxed(function() {

      const Model = org.objects.c_cw_t51_edit_script
      org.objects.objects.deleteOne({
        name: Model.name
      }).execute()
      org.objects.script.deleteOne({
        name: 'c_cw_t51_edit_script_edited'
      }).grant(consts.accessLevels.script).execute()
    }))

    it('should edit a script', sandboxed(function() {

      org.objects.script.updateOne({ name: 'c_cw_t51_edit_script' }, {
        $set: {
          name: 'c_cw_t51_edit_script_edited',
          label: 'Test Script EDIT',
          configuration: {
            export: 'c_cw_t51_edit_script_edited'
          }
        }
      }).grant(consts.accessLevels.script).execute()

      const should = require('should'),
            testScript = org.objects.script.find({ name: 'c_cw_t51_edit_script_edited' }).grant(consts.accessLevels.script).next(),
            { createInstance } = require('c_cw_t51_edit_script_edited')

      testScript.name.should.equal('c_cw_t51_edit_script_edited')
      testScript.label.should.equal('Test Script EDIT')
      testScript.description.should.equal('Test Script: Creates a custom object instance')
      testScript.type.should.equal('library')

      createInstance('Value for A', 'Value for B')

      should.exist(org.objects.c_cw_t51_edit_script.find({ c_a: 'Value for A', c_b: 'Value for B' }).next())
    }))
  })
})
