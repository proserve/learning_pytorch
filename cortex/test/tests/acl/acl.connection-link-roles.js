'use strict'

const consts = require('../../../lib/consts'),
      sandboxed = require('../../lib/sandboxed')

describe('Acl', function() {

  describe('Instance Roles', function() {

    it('should create a test object with a share acl', sandboxed(function() {

      /* global CortexObject, org */

      const cache = require('cache'),
            Model = CortexObject.as('Object'),
            abcRoleId = org.push('roles', { name: 'ABC' }).pop()._id,
            defRoleId = org.push('roles', { name: 'DEF' }).pop()._id

      cache.set('abcRoleId', abcRoleId)
      cache.set('defRoleId', defRoleId)

      Model.insertOne({
        name: 'c_connection_link_rbac_test',
        label: 'RBAC Test',
        hasETag: true,
        shareAcl: [{
          type: consts.accessTypes.access, // allow anyone with share access or greater to assign the abc role
          target: consts.accessLevels.share,
          allow: abcRoleId
        }, {
          type: consts.accessTypes.access, // allow anyone with share access or greater to assign the abc role
          target: consts.accessLevels.share,
          allow: defRoleId
        }, {
          type: consts.accessTypes.access, // allow anyone with share access or greater to assign public access
          target: consts.accessLevels.share,
          allow: 1
        }],
        defaultAcl: [{
          type: consts.accessPrincipals.owner,
          allow: consts.accessLevels.delete
        }, {
          type: consts.accessTargets.role, // abc role can update
          target: abcRoleId,
          allow: consts.accessLevels.update
        }],
        createAcl: [{
          type: consts.accessTargets.account, // anyone can create
          target: consts.principals.public
        }],
        properties: [{
          label: 'Foo',
          name: 'c_foo',
          type: 'String'
        }, {
          label: 'Bar',
          name: 'c_bar',
          type: 'String',
          readAccess: consts.accessLevels.delete, // high access required.
          acl: [{
            type: consts.accessTargets.role, // def role can read.
            target: defRoleId,
            allow: consts.accessLevels.delete
          }]
        }]
      }).execute()

    }))

    it('should create an instance with some links', sandboxed(function() {

      /* global CortexObject, org, script */

      const Model = CortexObject.as('c_connection_link_rbac_test'),
            cache = require('cache'),
            abcRoleId = cache.get('abcRoleId'),
            defRoleId = cache.get('defRoleId'),
            linkTestId = Model.insertOne({
              c_foo: 'foo',
              c_bar: 'bar'
            }).execute(),
            // create a link that allows 0 access but update access through the abc role.
            link1 = require('connections').linkTo(
              'c_connection_link_rbac_test',
              linkTestId,
              0,
              { roles: abcRoleId, connectionAppKey: script.__mocha_app_key__ }
            ),
            // create a link that allows public (1) access but elevated access to the c_bar property through the def role.
            link2 = require('connections').linkTo(
              'c_connection_link_rbac_test',
              linkTestId,
              1,
              { roles: defRoleId, connectionAppKey: script.__mocha_app_key__ }
            )

      cache.set('linkTestId', linkTestId)
      cache.set('link1', link1)
      cache.set('link2', link2)
    }))

    it('should be able to read through links as another caller.', sandboxed(function() {

      require('should')

      const connections = require('connections'),
            cache = require('cache')

      connections.read(`${cache.get('link1').token}/context/c_foo`).should.equal('foo')
      connections.read(`${cache.get('link2').token}/context/c_bar`).should.equal('bar')

      let err = null
      try {
        connections.read(`${cache.get('link1').token}/context/c_bar`)
      } catch (e) {
        err = e
      }
      if (!err) {
        throw new Error(`link1 reading of c_bar should have failed with kAccessDenied. Error: ${err && err.code}`)
      }

      err = null
      try {
        connections.read(`${cache.get('link2').token}/context/c_foo`)
      } catch (e) {
        err = e
      }
      if (!err) {
        throw new Error(`link2 reading of c_foo should have failed with kAccessDenied. Error: ${err && err.code}`)
      }

    }, 'provider'))

  })

})
