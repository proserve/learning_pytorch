'use strict'

/* global org, consts */

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('XXX - Write defaults only once.', function() {

    it('create supporting object and trigger', sandboxed(function() {

      org.objects.Object.insertOne({
        label: 'XXX - Write defaults only once',
        name: 'c_xxx_write_defaults_only_once',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          {
            label: 'c_other',
            name: 'c_property',
            type: 'String',
            defaultValue: {
              type: 'static',
              value: 'foo'
            }
          },
          {
            label: 'c_other',
            name: 'c_other',
            type: 'String'
          }
        ]
      }).execute()

      org.objects.script.insertOne({
        label: 'Script',
        type: 'trigger',
        script: `
          script.context.update('c_property', 'bar')
          script.context.update('c_other', 'foo')
        `,
        configuration: {
          object: 'c_xxx_write_defaults_only_once',
          event: 'create.before'
        }
      }).execute()

    }))

    it('insert an instance and ensure defaults were not overwritten by trigger updates.', sandboxed(function() {

      require('should')

      const doc = org.objects.c_xxx_write_defaults_only_once.insertOne({}).lean(false).execute()

      doc.c_property.should.equal('bar')
      doc.c_other.should.equal('foo')

    }))

  })

})
