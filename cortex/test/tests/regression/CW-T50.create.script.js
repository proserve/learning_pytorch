'use strict'

/* global org, consts */

const sandboxed = require('../../lib/sandboxed')

describe('CW-T50 - Admin user should be able to create a script', function() {

  describe('CW-T50 - Create a Script', function() {

    before(sandboxed(function() {
      org.objects.objects.insertOne({
        label: 'c_cw_t50_create_script',
        name: 'c_cw_t50_create_script',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'A', name: 'c_a', type: 'String', indexed: true },
          { label: 'B', name: 'c_b', type: 'String', indexed: true }
        ]
      }).execute()
    }))

    after(sandboxed(function() {

      const Model = org.objects.c_cw_t50_create_script
      org.objects.objects.deleteOne({
        name: Model.name
      }).execute()

      org.objects.script.deleteOne({
        name: 'c_cw_t50_create_script'
      }).grant(consts.accessLevels.script).execute()
    }))

    it('should create a script', sandboxed(function() {

      org.objects.script.insertOne({
        name: 'c_cw_t50_create_script',
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
            org.objects.c_cw_t50_create_script.insertOne({
              c_a: propA,
              c_b: propB
            }).passive().execute()
          }
        `,
        configuration: {
          export: 'c_cw_t50_create_script'
        }
      }).execute()

      const should = require('should'),
            testScript = org.objects.script.find({ name: 'c_cw_t50_create_script' }).grant(consts.accessLevels.script).next(),
            { createInstance } = require('c_cw_t50_create_script')

      testScript.name.should.equal('c_cw_t50_create_script')
      testScript.label.should.equal('Test Script')
      testScript.description.should.equal('Test Script: Creates a custom object instance')
      testScript.type.should.equal('library')

      createInstance('Value for A', 'Value for B')

      should.exist(org.objects.c_cw_t50_create_script.find({ c_a: 'Value for A', c_b: 'Value for B' }).next())

    }))

  })

})
