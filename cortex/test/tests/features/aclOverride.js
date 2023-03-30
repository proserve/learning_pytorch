'use strict'

/* global before */

const sandboxed = require('../../lib/sandboxed')

describe('Features', function() {

  describe('ACL Override', function() {

    before(sandboxed(function() {

      /* global org */

      // add a role
      if (!org.read('roles').find(v => v.code === 'c_ctxapi_acl_override')) {
        org.objects.org.updateOne({ code: org.code }, {
          $push: {
            roles: [{
              code: 'c_ctxapi_acl_override',
              name: 'CTXAPI-ACL Override'
            }]
          }
        }).execute()
      }

      // add object
      if (!org.objects.objects.find({ name: 'c_ctxapi_acl_override' }).hasNext()) {
        org.objects.objects.insertOne({
          label: 'CTXAPI-ACL Override',
          name: 'c_ctxapi_acl_override',
          defaultAcl: 'owner.delete',
          createAcl: 'account.public',
          properties: [{
            name: 'c_foo',
            label: 'String',
            type: 'String',
            aclOverride: true,
            acl: 'role.c_ctxapi_acl_override.update'
          }, {
            name: 'c_bar',
            label: 'String',
            type: 'String',
            aclOverride: true,
            acl: ['account.public.public', 'role.c_ctxapi_acl_override.update']
          }]
        }).execute()
      }
    }))

    it('basic access gate', sandboxed(function() {

      /* global consts */

      require('should')

      const { c_ctxapi_acl_override: Model } = org.objects,
            { tryCatch } = require('util.values'),
            pathTo = require('util.paths.to')

      let _id, Undefined

      function expectError(err, path, code) {
        if (pathTo(err, 'code') === code &&
          pathTo(err, 'path') === path
        ) {
          return true
        }
        throw err
      }

      tryCatch(
        () => {
          Model.insertOne({ c_foo: 'foo', c_bar: 'bar' }).execute()
        },
        (err) => expectError(err, 'c_ctxapi_acl_override.c_foo', 'kAccessDenied')
      )

      _id = Model.insertOne({ c_foo: 'foo', c_bar: 'bar' }).roles('c_ctxapi_acl_override').execute()

      Model.insertOne({ c_foo: 'foo', c_bar: 'bar' }).grant(consts.accessLevels.update).execute()

      tryCatch(
        () => {
          Model.aggregate().project({ c_bar: 1 }).next()
        },
        (err) => expectError(err, 'c_ctxapi_acl_override.c_bar', 'kAccessDenied')
      )

      Model.aggregate().project({ c_bar: 1 }).grant(consts.accessLevels.read).next()
      Model.aggregate().project({ c_bar: 1 }).roles('c_ctxapi_acl_override').next()

      ;(Model.find({ _id }).next().c_foo === Undefined).should.be.true()
      ;(Model.find({ _id }).next().c_bar === Undefined).should.be.true()

      ;(Model.find({ _id }).roles('c_ctxapi_acl_override').next().c_foo === 'foo').should.be.true()
      ;(Model.find({ _id }).roles('c_ctxapi_acl_override').next().c_bar === 'bar').should.be.true()

    }))

  })

})
