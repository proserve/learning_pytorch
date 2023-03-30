'use strict'

const consts = require('../../../lib/consts'),
      sandboxed = require('../../lib/sandboxed')

describe('Acl', function() {

  describe('Instance Roles', function() {

    it('should create a parent/child object pair with a share acl on the parent', sandboxed(function() {

      /* global CortexObject, org, script */

      const cache = require('cache'),
            Model = CortexObject.as('Object'),
            inheritMeRoleId = org.push('roles', { name: 'InheritMe' }).pop()._id

      cache.set('inheritMeRoleId', inheritMeRoleId)

      Model.insertOne({
        name: 'c_rbac_child_test',
        label: 'RBAC Test',
        hasETag: true,
        defaultAcl: [{
          type: consts.accessPrincipals.owner,
          allow: consts.accessLevels.delete
        }, {
          type: consts.accessTargets.role,
          target: inheritMeRoleId,
          allow: consts.accessLevels.update
        }],
        createAcl: [],
        properties: [{
          label: 'Foo',
          name: 'c_foo',
          type: 'String'
        }]
      }).execute()

      Model.insertOne({
        name: 'c_rbac_parent_test',
        label: 'RBAC Test',
        hasETag: true,
        shareAcl: [{
          type: consts.accessPrincipals.owner,
          allow: inheritMeRoleId
        }],
        defaultAcl: [{
          type: consts.accessPrincipals.owner,
          allow: consts.accessLevels.delete
        }, {
          type: consts.accessTargets.role,
          target: inheritMeRoleId,
          allow: consts.accessLevels.read
        }],
        createAcl: [{
          type: consts.accessTargets.account, // anyone can create
          target: consts.principals.public
        }],
        properties: [{
          label: 'Foo',
          name: 'c_foo',
          type: 'String'
        }]
      }).execute()

      Model.updateOne({
        name: 'c_rbac_child_test'
      }, {
        $push: {
          properties: [{
            label: 'Parent',
            name: 'c_parent',
            type: 'Reference',
            sourceObject: 'c_rbac_parent_test',
            indexed: true,
            writable: false,
            cascadeDelete: true,
            validators: [{
              name: 'required'
            }]
          }]
        }
      }).execute()

      Model.updateOne({
        name: 'c_rbac_parent_test'
      }, {
        $push: {
          properties: [{
            label: 'Children',
            name: 'c_children',
            type: 'List',
            sourceObject: 'c_rbac_child_test',
            linkedProperty: 'c_parent',
            createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
            readThrough: true,
            writeThrough: true,
            updateOnWriteThrough: true,
            inheritInstanceRoles: true
          }]
        }
      }).execute()

    }))

    it('should create a link to the parent and be able to access the child through inherited instance role', sandboxed(function() {

      const Model = CortexObject.as('c_rbac_parent_test'),
            cache = require('cache'),
            inheritMeRoleId = cache.get('inheritMeRoleId'),
            connTestId = Model.insertOne({
              c_foo: 'parent foo',
              c_children: [{
                c_foo: 'child foo'
              }]
            }).execute(),
            childId = Model.find().paths('c_children').next().c_children.data[0]._id,

            // create a connection that allows 0 access but update access through the inherit role.
            [conn1] = require('connections').create(
              'c_rbac_parent_test',
              connTestId,
              [
                { email: consts.mocha.principals.provider.email, roles: inheritMeRoleId }
              ],
              { skipNotification: true, connectionAppKey: script.__mocha_app_key__ }
            )

      cache.set('list_rbac_connTestId', connTestId)
      cache.set('list_rbac_childId', childId)
      cache.set('list_rbac_conn1', conn1)

    }))

    it('should be able to read through connection as the target.', sandboxed(function() {

      require('should')

      const connections = require('connections'),
            cache = require('cache'),
            conn1 = cache.get('list_rbac_conn1'),
            childId = cache.get('list_rbac_childId')

      connections.read(`${connections.getToken(conn1._id)}/context/c_foo`).should.equal('parent foo')
      connections.read(`${connections.getToken(conn1._id)}/context/c_children/${childId}/c_foo`).should.equal('child foo')

    }, 'provider'))

    it('should be able to apply the connection and read/update the context as the target.', sandboxed(function() {

      require('should')

      const connections = require('connections'),
            objects = require('objects'),
            cache = require('cache'),
            connTestId = cache.get('list_rbac_connTestId'),
            connToken = connections.getToken(cache.get('list_rbac_conn1')._id),
            childId = cache.get('list_rbac_childId')

      connections.apply(connToken)

      objects.read('c_rbac_parent_test', `${connTestId}/c_foo`).should.equal('parent foo')
      objects.read('c_rbac_parent_test', `${connTestId}/c_children/${childId}/c_foo`).should.equal('child foo')

      let err = null
      try {
        objects.update('c_rbac_parent_test', `${connTestId}/c_foo`, 'update')
      } catch (e) {
        err = e
      }
      if (!err) {
        throw new Error(`context reading of c_bar should have failed with kAccessDenied. Error: ${err && err.code}`)
      }

      objects.update('c_rbac_parent_test', `${connTestId}/c_children/${childId}/c_foo`, 'update')

    }, 'provider'))

  })

})
