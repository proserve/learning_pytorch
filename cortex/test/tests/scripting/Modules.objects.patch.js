'use strict'

const server = require('../../lib/server'),
      acl = require('../../../lib/acl'),
      modules = require('../../../lib/modules'),
      wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  main: function() {

    /* global ObjectID */

    require('should')

    const name = 'c_script_mods_obj_patch_tests',
          objects = require('objects')

    // create
    let instance = objects.create(name, {
      c_string: ['a', 'b', 'c', 'd', 'e'],
      c_doc_arr: [{
        c_string: 'a'
      }, {
        c_string: 'b'
      }, {
        c_string: 'c'
      }, {
        c_string: 'd'
      }, {
        c_string: 'e'
      }]
    })

    // patch
    instance = objects.patch(name, instance._id, [{
      op: 'remove',
      path: 'c_string',
      value: 'd'
    }, {
      op: 'push',
      path: 'c_string',
      value: ['d']
    }, {
      op: 'set',
      path: 'c_doc_arr.' + instance.c_doc_arr[0]._id,
      value: { c_string: 'aa' }
    }, {
      op: 'remove',
      path: 'c_string',
      value: ['a', 'b']
    }])

    instance.c_string[2].should.equal('d')
    instance.c_doc_arr[0].c_string.should.equal('aa');

    (function() {
      try {
        objects.patch('invalid object', new ObjectID())
      } catch (err) {
        if (err.errCode === 'cortex.invalidArgument.object') {
          return
        }
        throw err
      }
      throw new Error('patching invalid object should fail.')
    }());

    (function() {
      try {
        objects.patch(name, instance._id, [{
          op: 'remove',
          path: 'c_string',
          value: 'd'
        }, {
          op: 'push',
          path: 'c_string',
          value: ['d']
        }, {
          op: 'set',
          path: 'c_not_a_path.' + instance.c_doc_arr[0]._id,
          value: { c_string: 'aa' }
        }, {
          op: 'remove',
          path: 'c_string',
          value: ['a', 'b']
        }], { grant: 1000 })

      } catch (err) {
        if (err.code === 'kNotFound' && err.path === 'c_not_a_path') {
          return
        }
        throw err
      }
      throw new Error('patching invalid path should fail.')
    }())

    return true
  },

  before: function(ac, model, callback) {

    // create a custom object to test push and pull.
    modules.db.models.object.aclCreate(server.principals.admin, {
      name: 'c_script_mods_obj_patch_test',
      label: 'Test',
      defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }],
      createAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
      properties: [
        {
          array: true,
          indexed: true,
          label: 'string',
          name: 'c_string',
          type: 'String',
          writable: true,
          canPush: true,
          canPull: true
        }, {
          array: true,
          label: 'Doc Array',
          name: 'c_doc_arr',
          type: 'Document',
          writable: true,
          canPush: true,
          canPull: true,
          properties: [{
            label: 'string',
            name: 'c_string',
            type: 'String',
            writable: true,
            canPush: true,
            canPull: true
          }]
        }]
    }, callback)
  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
