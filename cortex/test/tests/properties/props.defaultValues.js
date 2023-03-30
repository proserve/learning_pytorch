'use strict'

/* global org, consts */

const sandboxed = require('../../lib/sandboxed')

describe('Properties', function() {

  describe('Properties - Default Values', function() {

    it('create object with defaults', sandboxed(function() {

      org.objects.object.insertOne({
        label: 'c_default_values_test',
        name: 'c_default_values_test',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [

          { label: 'Prop', name: 'c_static_string', indexed: true, type: 'String', defaultValue: { type: 'static', value: 'ok!' } },
          { label: 'Prop', name: 'c_static_boolean', type: 'String', defaultValue: { type: 'static', value: true } },
          { label: 'Prop', name: 'c_static_number', type: 'String', defaultValue: { type: 'static', value: 123 } },
          { label: 'Prop', name: 'c_static_date', type: 'String', defaultValue: { type: 'static', value: new Date() } },
          { label: 'Prop', name: 'c_boolean_true', type: 'Boolean', defaultValue: { type: 'env', value: 'true' } },
          { label: 'Prop', name: 'c_boolean_false', type: 'Boolean', defaultValue: { type: 'env', value: 'false' } },
          { label: 'Prop', name: 'c_date_now', type: 'Date', defaultValue: { type: 'env', value: 'now' } },
          { label: 'Prop', name: 'c_number_increment', type: 'Number', writable: false, defaultValue: { type: 'env', value: 'increment' } },
          { label: 'Prop', name: 'c_string_ip', type: 'String', writable: false, defaultValue: { type: 'env', value: 'req.ip' } },
          { label: 'Prop', name: 'c_string_ipv4', type: 'String', writable: false, defaultValue: { type: 'env', value: 'req.ipv4' } },
          { label: 'Prop', name: 'c_string_client_key', type: 'String', writable: false, defaultValue: { type: 'env', value: 'req.client.key' } },
          { label: 'Prop', name: 'c_string_user_agent', type: 'String', writable: false, defaultValue: { type: 'env', value: 'req.headers.user-agent' } },
          { label: 'Prop', name: 'c_objectid_principal', type: 'ObjectId', writable: false, defaultValue: { type: 'env', value: 'ac.principal' } },
          { label: 'Prop', name: 'c_objectid_originalPrincipal', type: 'ObjectId', writable: false, defaultValue: { type: 'env', value: 'ac.originalPrincipal' } },
          { label: 'Prop', name: 'c_objectid_req_id', type: 'ObjectId', writable: false, defaultValue: { type: 'env', value: 'req._id' } },
          { label: 'Prop', name: 'c_objectid_client_id', type: 'ObjectId', writable: false, defaultValue: { type: 'env', value: 'req.client._id' } },
          { label: 'Prop', name: 'c_objectid_script_id', type: 'ObjectId', writable: false, defaultValue: { type: 'env', value: 'script._id' } },
          { label: 'Prop', name: 'c_objectid_auto', type: 'ObjectId', writable: false, defaultValue: { type: 'env', value: 'auto' } },
          {
            label: 'DocArray',
            name: 'c_doc_array',
            array: true,
            type: 'Document',
            properties: [
              { label: 'Prop', name: 'c_static_string', type: 'String', defaultValue: { type: 'static', value: 'doc array string' } }
            ]
          },
          {
            label: 'Doc',
            name: 'c_sub_doc',
            array: false,
            type: 'Document',
            properties: [
              { label: 'Prop', name: 'c_static_string', type: 'String', defaultValue: { type: 'static', value: 'sub doc string' } }
            ]
          }
        ],
        objectTypes: [
          { label: 'One',
            name: 'c_one',
            properties: []
          },
          { label: 'Two',
            name: 'c_two',
            properties: [
              {
                label: 'Prop',
                name: 'c_inc',
                type: 'Number',
                defaultValue: {
                  type: 'env',
                  value: 'increment'
                } }
            ]
          }
        ]
      }).lean(false).execute()

    }))

    it('insert a doc with default values.', sandboxed(function() {

      /* global org */

      require('should')

      const doc = org.objects.c_default_values_test.insertOne({
        type: 'c_two',
        c_doc_array: [{}]
      }).lean(false).execute()

      doc.c_boolean_false.should.equal(false)
      doc.c_boolean_true.should.equal(true)
      doc.c_date_now.should.be.instanceOf(Date)
      doc.c_doc_array[0].c_static_string.should.equal('doc array string')
      doc.c_inc.should.equal(1)
      doc.c_number_increment.should.equal(1)

    }))

  })

})
