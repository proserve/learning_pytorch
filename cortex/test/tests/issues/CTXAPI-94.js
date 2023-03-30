'use strict'

/* global before, after */

/* global org, script */

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules')

describe('Issues', function() {

  describe('CTXAPI-94 - self in acls', function() {

    // make sure we allow restricted operators
    let matchOps
    before(function(callback) {
      matchOps = server.org.configuration.queries.allowedRestrictedMatchOps
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.queries.allowedRestrictedMatchOps': '*' } }, () => {
        server.updateOrg(callback)
      })
    })
    after(function(callback) {
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.queries.allowedRestrictedMatchOps': matchOps } }, () => {
        server.updateOrg(callback)
      })
    })

    before(sandboxed(function() {

      /* global org, consts */

      const Model = org.objects.c_ctxapi_94,
            Objects = org.objects.objects,
            properties = [{
              label: 'String',
              name: 'c_ctxapi_94_string',
              type: 'String',
              indexed: true,
              writeAccess: consts.accessLevels.delete,
              acl: [{ allow: consts.accessLevels.delete, type: consts.accessTypes.self }]
            }, {
              name: 'c_ctxapi_94_list',
              label: 'List',
              type: 'List',
              sourceObject: Model.name,
              inheritPropertyAccess: true,
              acl: [{ allow: consts.accessLevels.delete, type: consts.accessTypes.self }]
            }]

      Objects.insertOne({
        label: Model.name,
        name: Model.name,
        // allow only update access. we'll test to ensure caller inherits delete access through the account.c_ctxapi_94 list
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.read }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          {
            label: 'A',
            name: 'c_a',
            type: 'String',
            indexed: true,
            acl: [{ allow: consts.accessLevels.delete, type: consts.accessTypes.self }]
          },
          {
            name: 'c_ctxapi_94_list',
            label: 'List',
            type: 'List',
            sourceObject: 'account',
            inheritPropertyAccess: true,
            defaultAcl: [{ allow: consts.accessLevels.delete, type: consts.accessTypes.self }]
          }
        ]
      }).execute()

      if (Objects.find({ name: 'account' }).hasNext()) {
        Objects.updateOne({ name: 'account' }, { $push: { properties } }).execute()
      } else {
        Objects.insertOne({ name: 'account', label: 'Account', properties }).execute()
      }

      Model.insertOne({}).execute()

    }))

    it('should not elevate access for self in non-account.', sandboxed(function() {

      const tryCatch = require('util.values').tryCatch,
            Model = org.objects.c_ctxapi_94

      // should not have applied 'delete' access from the acl based on self.
      tryCatch(function() {
        Model.insertOne({ c_a: 'foo' }).execute()
      }, function(err) {
        if (![err, err.code === 'kAccessDenied', err.path === 'c_ctxapi_94.c_a'].every(v => v)) {
          throw new Error('Expected kAccessDenied on c_a')
        }
      })

    }))

    it('should allow writing to elevated property using self acl entry in account', sandboxed(function() {

      require('should')

      const value = 'foo',
            _id = org.objects.account.updateOne({ _id: script.principal._id }, { $set: { c_ctxapi_94_string: value } }).execute(),
            account = org.objects.account.find({ _id }).paths('c_ctxapi_94_string', 'propertyAccess').next()

      account.c_ctxapi_94_string.should.equal(value)
      account.propertyAccess.c_ctxapi_94_string.update.should.equal(true)

    }))

    it('should elevate property access for a list property using self.', sandboxed(function() {

      require('should')

      // calling as self will elevate access
      org.objects.accounts
        .find({ _id: script.principal._id })
        .skipAcl()
        .grant(4)
        .paths('c_ctxapi_94_list')
        .next()
        .c_ctxapi_94_list.data[0].access.should.equal(consts.accessLevels.delete)

      // calling as other will not
      org.objects.accounts
        .find({ _id: { $ne: script.principal._id } })
        .skipAcl()
        .grant(4)
        .paths('c_ctxapi_94_list')
        .next()
        .c_ctxapi_94_list.data[0].access.should.equal(consts.accessLevels.read)

    }))

    it('should elevate property access for list contents on an account using self.', sandboxed(function() {

      require('should')

      const Model = org.objects.c_ctxapi_94

      // getting self will elevate access
      Model
        .aggregate()
        .project({
          c_ctxapi_94_list: {
            $expand: {
              pipeline: [{
                $match: {
                  _id: script.principal._id
                }
              }, {
                $limit: 1
              }, {
                $project: {
                  _id: 1,
                  object: 1,
                  access: 1
                }
              }]
            }
          }
        })
        .limit(1)
        .next()
        .c_ctxapi_94_list.data[0].access.should.equal(consts.accessLevels.delete)

      // getting non-self will not elevate access
      script.as(script.principal._id, { principal: { skipAcl: true, grant: consts.accessLevels.public } }, function() {

        Model
          .aggregate()
          .project({
            c_ctxapi_94_list: {
              $expand: {
                pipeline: [{
                  $match: {
                    _id: { $ne: script.principal._id }
                  }
                }, {
                  $limit: 1
                }, {
                  $project: {
                    _id: 1,
                    object: 1,
                    access: 1
                  }
                }]
              }
            }
          })
          .limit(1)
          .next()
          .c_ctxapi_94_list.data[0].access.should.equal(consts.accessLevels.read)
      })

    }))

  })

})
