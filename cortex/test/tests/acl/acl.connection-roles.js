'use strict'

const consts = require('../../../lib/consts'),
      sandboxed = require('../../lib/sandboxed')

describe('Acl', function() {

  describe('Instance Roles', function() {

    before(sandboxed(function() {

      /* global org, script */

      const Objects = org.objects.objects,
            Model = org.objects.c_connection_rbac_test,
            cache = require('cache'),
            ghiRoleId = org.push('roles', { name: 'GHI' }).pop()._id,
            jklRoleId = org.push('roles', { name: 'JKL' }).pop()._id

      Objects.insertOne({
        name: 'c_connection_rbac_test',
        label: 'RBAC Test',
        hasETag: true,
        shareAcl: [{
          type: consts.accessTypes.access, // allow anyone with share access or greater to assign the ghi role
          target: consts.accessLevels.share,
          allow: ghiRoleId
        }, {
          type: consts.accessTypes.access, // allow anyone with share access or greater to assign the ghi role
          target: consts.accessLevels.share,
          allow: jklRoleId
        }, {
          type: consts.accessTypes.access, // allow anyone with share access or greater to assign public access
          target: consts.accessLevels.share,
          allow: 1
        }],
        defaultAcl: [{
          type: consts.accessPrincipals.owner,
          allow: consts.accessLevels.delete
        }, {
          type: consts.accessTargets.role, // ghi role can update
          target: ghiRoleId,
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
            target: jklRoleId,
            allow: consts.accessLevels.delete
          }]
        }]
      }).execute()

      // create a connection that allows 0 access but update access through the ghi role.
      // create a connection that allows public (1) access but elevated access to the c_bar property through the def role.

      let connTestIdOne, connTestIdTwo, conn1, conn2, conn3, conn4

      connTestIdOne = Model.insertOne({
        c_foo: 'foo',
        c_bar: 'bar'
      }).execute()

      ;[conn1, conn2] = require('connections').create('c_connection_rbac_test', connTestIdOne, [
        { email: consts.mocha.principals.provider.email, roles: ghiRoleId },
        { email: consts.mocha.principals.patient.email, roles: jklRoleId }
      ], { skipNotification: true, connectionAppKey: script.__mocha_app_key__ })

      connTestIdTwo = Model.insertOne({
        c_foo: 'foo',
        c_bar: 'bar'
      }).execute()

      conn3 = require('connections').create('c_connection_rbac_test', connTestIdTwo, [{ email: consts.mocha.principals.provider.email, roles: ghiRoleId }], { skipNotification: true, connectionAppKey: script.__mocha_app_key__ })[0]
      conn4 = require('connections').create('c_connection_rbac_test', connTestIdTwo, [{ email: consts.mocha.principals.provider.email, roles: jklRoleId }], { skipNotification: true, connectionAppKey: script.__mocha_app_key__ })[0]

      cache.set('ghiRoleId', ghiRoleId)
      cache.set('jklRoleId', jklRoleId)
      cache.set('connTestIdOne', connTestIdOne)
      cache.set('conn1', conn1)
      cache.set('conn2', conn2)
      cache.set('connTestIdTwo', connTestIdTwo)
      cache.set('conn3', conn3)
      cache.set('conn4', conn4)

    }))

    it('should be able to read through connection as the target.', sandboxed(function() {

      const connections = require('connections'),
            cache = require('cache')

      require('should')

      connections.read(`${connections.getToken(cache.get('conn1')._id)}/context/c_foo`).should.equal('foo')

      let err = null
      try {
        connections.read(`${connections.getToken(cache.get('conn1')._id)}/context/c_bar`)
      } catch (e) {
        err = e
      }
      if (!err) {
        throw new Error(`link1 reading of c_bar should have failed with kAccessDenied. Error: ${err && err.code}`)
      }

    }, 'provider'))

    it('should be able to read through connection as the target.', sandboxed(function() {

      const connections = require('connections'),
            cache = require('cache')

      require('should')

      connections.read(`${connections.getToken(cache.get('conn2')._id)}/context/c_bar`).should.equal('bar')

      let err = null
      try {
        connections.read(`${connections.getToken(cache.get('conn2')._id)}/context/c_foo`)
      } catch (e) {
        err = e
      }
      if (!err) {
        throw new Error(`link2 reading of c_foo should have failed with kAccessDenied. Error: ${err && err.code}`)
      }

    }, 'patient'))

    it('should be able to read through connections as the target.', sandboxed(function() {

      const connections = require('connections'),
            cache = require('cache')

      require('should')

      connections.read(`${connections.getToken(cache.get('conn3')._id)}/context/c_foo`).should.equal('foo')
      connections.read(`${connections.getToken(cache.get('conn4')._id)}/context/c_bar`).should.equal('bar')

      // essentially the same connection.
      connections.read(`${connections.getToken(cache.get('conn3')._id)}/context/c_bar`).should.equal('bar')
      connections.read(`${connections.getToken(cache.get('conn4')._id)}/context/c_foo`).should.equal('foo')

    }, 'provider'))

    it('should be able to apply the connection and read the context as the target.', sandboxed(function() {

      const connections = require('connections'),
            objects = require('objects'),
            cache = require('cache'),
            connTestId = cache.get('connTestIdOne'),
            connToken = connections.getToken(cache.get('conn1')._id)

      require('should')

      connections.apply(connToken)

      objects.read('c_connection_rbac_test', `${connTestId}/c_foo`).should.equal('foo')

      let err = null
      try {
        objects.read('c_connection_rbac_test', `${connTestId}/c_bar`)
      } catch (e) {
        err = e
      }
      if (!err) {
        throw new Error(`context reading of c_bar should have failed with kAccessDenied. Error: ${err && err.code}`)
      }

    }, 'provider'))

    it('should be able to apply the connection and read the context as the target.', sandboxed(function() {

      const connections = require('connections'),
            objects = require('objects'),
            cache = require('cache'),
            connTestId = cache.get('connTestIdOne'),
            connToken = connections.getToken(cache.get('conn2')._id)

      require('should')

      connections.apply(connToken)

      objects.read('c_connection_rbac_test', `${connTestId}/c_bar`).should.equal('bar')

      let err = null
      try {
        objects.read('c_connection_rbac_test', `${connTestId}/c_foo`)
      } catch (e) {
        err = e
      }
      if (!err) {
        throw new Error(`context reading of c_foo should have failed with kAccessDenied. Error: ${err && err.code}`)
      }

    }, 'patient'))

    it('should be able to apply the connection and read the context as the target.', sandboxed(function() {

      const connections = require('connections'),
            objects = require('objects'),
            cache = require('cache'),
            connTestId = cache.get('connTestIdTwo'),
            connToken = connections.getToken(cache.get('conn3')._id)

      require('should')

      connections.apply(connToken)

      objects.read('c_connection_rbac_test', `${connTestId}/c_foo`).should.equal('foo')
      objects.read('c_connection_rbac_test', `${connTestId}/c_bar`).should.equal('bar')

      let err = null
      try {
        objects.read('c_connection_rbac_test', `${connTestId}/context/c_bar`)
      } catch (e) {
        err = e
      }
      if (!err) {
        throw new Error(`link1 reading of c_bar should have failed with kAccessDenied. Error: ${err && err.code}`)
      }

      err = null
      try {
        objects.read('c_connection_rbac_test', `${connTestId}/context/c_foo`)
      } catch (e) {
        err = e
      }
      if (!err) {
        throw new Error(`link2 reading of c_foo should have failed with kAccessDenied. Error: ${err && err.code}`)
      }

    }, 'provider'))

    it('should be able to list connected instances', sandboxed(function() {

      return org.objects.c_connection_rbac_test.find().count() === 2

    }, 'provider'))

    it('should be able to list connected instances', sandboxed(function() {

      return org.objects.c_connection_rbac_test.find().count() === 1

    }, 'patient'))

  })

})
