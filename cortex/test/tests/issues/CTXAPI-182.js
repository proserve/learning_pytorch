'use strict'

const config = require('cortex-service/lib/config'),
      sandboxed = require('../../lib/sandboxed'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl')

describe('Issues', function() {

  describe('CTXAPI-182 - privilege escalation', function() {

    before(function(callback) {

      config('app')._env = config('app').env
      config('app').env = 'production'
      config.flush()

      modules.db.models.object.c_ctxapi_182_defaultAcl = modules.db.models.object.defaultAcl
      modules.db.models.object.defaultAcl = [
        { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read },
        { type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Delete }
      ]
      modules.db.models.object.c_ctxapi_182_createAcl = modules.db.models.object.createAcl
      modules.db.models.object.createAcl = [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }]

      modules.db.models.view.c_ctxapi_182_defaultAcl = modules.db.models.view.defaultAcl
      modules.db.models.view.defaultAcl = [
        { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read },
        { type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Delete }
      ]
      modules.db.models.view.c_ctxapi_182_createAcl = modules.db.models.view.createAcl
      modules.db.models.view.createAcl = [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }]

      callback()
    })

    after(function(callback) {

      config('app').env = config('app')._env
      config.flush()

      modules.db.models.object.defaultAcl = modules.db.models.object.c_ctxapi_182_defaultAcl
      modules.db.models.object.createAcl = modules.db.models.object.c_ctxapi_182_createAcl

      modules.db.models.view.defaultAcl = modules.db.models.view.c_ctxapi_182_defaultAcl
      modules.db.models.view.createAcl = modules.db.models.view.c_ctxapi_182_createAcl

      callback()
    })

    before(sandboxed(function() {

      /* global org, consts */

      const Model = org.objects.object

      Model.insertOne({
        name: 'c_ctxapi_182',
        label: 'c_ctxapi_182'
      }).execute()

      org.push('serviceAccounts', { name: 'c_ctxapi_182', label: 'c_ctxapi_182', roles: [consts.roles.developer] })

    }))

    it('cannot manipulate object unless admin', sandboxed(function() {

      /* global org, script */

      require('should')

      script.env.name.should.equal('production')

      const pathTo = require('util.paths.to'),
            tryCatch = require('util.values').tryCatch,
            Model = org.objects.objects

      function expectError(err, code = 'kAccessDenied') {
        if (pathTo(err, 'code') === code) {
          return true
        }
        throw err
      }

      tryCatch(
        () => {
          script.as('james+patient@medable.com', () => {
            return Model.deleteOne({ name: 'c_ctxapi_182' }).execute()
          })
        },
        (err) => expectError(err)
      )

      tryCatch(
        () => {
          script.as('c_ctxapi_182', () => {
            return Model.insertOne({ name: 'c_ctxapi_182a', label: 'c_ctxapi_182a' }).execute()
          })
        },
        (err) => expectError(err)
      )

      tryCatch(
        () => {
          script.as('c_ctxapi_182', () => {
            return Model.updateOne({ name: 'c_ctxapi_182' }, { $set: { label: 'label' } }).execute()
          })
        },
        (err) => expectError(err)
      )

      tryCatch(
        () => {
          script.as('c_ctxapi_182', () => {
            return Model.deleteOne({ name: 'c_ctxapi_182' }).execute()
          })
        },
        (err) => expectError(err)
      )

      Model.insertOne({ name: 'c_ctxapi_182a', label: 'c_ctxapi_182a' }).execute()
      Model.deleteOne({ name: 'c_ctxapi_182a' }).execute()

    }))

    it('cannot manipulate view unless admin', sandboxed(function() {

      /* global org, script */

      require('should')

      script.env.name.should.equal('production')

      const pathTo = require('util.paths.to'),
            tryCatch = require('util.values').tryCatch,
            Model = org.objects.view

      Model.insertOne({
        name: 'c_ctxapi_182',
        label: 'c_ctxapi_182',
        sourceObject: 'c_ctxapi_182'
      }).execute()

      function expectError(err, code = 'kAccessDenied') {
        if (pathTo(err, 'code') === code) {
          return true
        }
        throw err
      }

      tryCatch(
        () => {
          script.as('james+patient@medable.com', () => {
            return Model.deleteOne({ name: 'c_ctxapi_182' }).execute()
          })
        },
        (err) => expectError(err)
      )

      tryCatch(
        () => {
          script.as('c_ctxapi_182', () => {
            return Model.insertOne({ name: 'c_ctxapi_182a', label: 'c_ctxapi_182a', sourceObject: 'c_ctxapi_182' }).execute()
          })
        },
        (err) => expectError(err)
      )

      tryCatch(
        () => {
          script.as('c_ctxapi_182', () => {
            return Model.updateOne({ name: 'c_ctxapi_182' }, { $set: { label: 'label' } }).execute()
          })
        },
        (err) => expectError(err)
      )

      tryCatch(
        () => {
          script.as('c_ctxapi_182', () => {
            return Model.deleteOne({ name: 'c_ctxapi_182' }).execute()
          })
        },
        (err) => expectError(err)
      )

      Model.deleteOne({ name: 'c_ctxapi_182' }).execute()

    }))

  })

})
