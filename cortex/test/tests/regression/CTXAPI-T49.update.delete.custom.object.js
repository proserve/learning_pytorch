'use strict'

/* global before, consts, org, script */

const sandboxed = require('../../lib/sandboxed'),
      should = require('should'),
      _ = require('lodash'),
      server = require('../../lib/server')

describe('CTXAPI-T49', function() {

  before(function(done) {
    let code = function() {

          if (!org.read('roles').find(r => r.code === 'c_ctxapi_t49')) {
            org.objects.org.updateOne({ code: org.code }, {
              $push: {
                roles: [{
                  code: 'c_ctxapi_t49',
                  name: 'CTXAPI-T49'
                }]
              }
            }).execute()
          }

          org.objects.objects.insertOne({
            label: 'c_t49_object',
            name: 'c_t49_object',
            defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
            createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
            properties: [
              { label: 'A', name: 'c_a', type: 'String', indexed: true },
              { label: 'B', name: 'c_b', type: 'Number', indexed: true }
            ]
          }).execute()

          org.objects.account.register({
            name: {
              first: 'Admin',
              last: 'User'
            },
            email: 't49_admin@medable.com',
            mobile: '15055555555',
            roles: [consts.roles.admin]
          }, {
            skipVerification: true,
            skipActivation: true,
            skipNotification: true,
            requireMobile: false
          })

          org.objects.account.register({
            name: {
              first: 'Developer',
              last: 'User'
            },
            email: 't49_dev@medable.com',
            mobile: '15055555555',
            roles: [consts.roles.developer]
          }, {
            skipVerification: true,
            skipActivation: true,
            skipNotification: true,
            requireMobile: false
          })

          org.objects.account.register({
            name: {
              first: 'Support',
              last: 'User'
            },
            email: 't49_support@medable.com',
            mobile: '15055555555',
            roles: [consts.roles.support]
          }, {
            skipVerification: true,
            skipActivation: true,
            skipNotification: true,
            requireMobile: false
          })

          let customRoleId = org.read('roles').find(r => r.code === 'c_ctxapi_t49')._id

          org.objects.account.register({
            name: {
              first: 'Custom',
              last: 'User'
            },
            email: 't49_custom@medable.com',
            mobile: '15055555555',
            roles: [customRoleId]
          }, {
            skipVerification: true,
            skipActivation: true,
            skipNotification: true,
            requireMobile: false
          })
        },
        codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
        script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

    server.sessions.admin
      .post(server.makeEndpoint('/sys/script_runner'))
      .set(server.getSessionHeaders())
      .send(script)
      .done(function(err, result) {
        should.not.exist(err)
        done()
      })
  })

  describe('Admin should update and delete a Custom Object', function() {

    it('should edit a custom object', sandboxed(function() {

      const should = require('should'),
            _ = require('underscore')

      org.objects.objects.updateOne({
        name: 'c_t49_object'
      },
      {
        $push: {
          properties: [{ label: 'C', name: 'c_c', type: 'String', indexed: true }]
        }
      }).execute()

      let c,
          theObject = org.objects.objects.find({ name: 'c_t49_object' }).next()

      should.exist(theObject)

      theObject.properties.length.should.equal(3)

      c = _.find(theObject.properties, p => p.name === 'c_c')

      c.label.should.equal('C')
      c.type.should.equal('String')
      c.indexed.should.equal(true)
    }))

    it('should delete a custom object', sandboxed(function() {

      const should = require('should'),
            _ = require('underscore')

      org.objects.objects.deleteOne({ name: 'c_t49_object' }).execute()

      let theObject = _.find(org.objects.objects.find().toArray(), o => o.name === 'c_t49_object')

      should.equal(theObject, undefined)

    }))
  })

  describe('Developer should be able to update and delete a Custom Object', function() {

    before(sandboxed(function() {
      org.objects.objects.insertOne({
        label: 'c_t49_object_2',
        name: 'c_t49_object_2',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'A', name: 'c_a', type: 'String', indexed: true },
          { label: 'B', name: 'c_b', type: 'Number', indexed: true }
        ]
      }).execute()
    }))

    it('should update a custom object', (done) => {
      sandboxed(function() {

        script.as(
          't49_dev@medable.com',
          {
            principal: {
              roles: [],
              scope: ['*'],
              skipAcl: false,
              bypassCreateAcl: false
            },
            acl: {
              safe: true
            },
            modules: {
              safe: false,
              blacklist: [],
              whitelist: ['script.as', 'objects.*']
            }
          },

          () => {
            org.objects.objects.updateOne({
              name: 'c_t49_object_2'
            },
            {
              $push: {
                properties: [{ label: 'C', name: 'c_c', type: 'String', indexed: true }]
              }
            }).execute()
          }
        )

        return org.objects.objects.find({ name: 'c_t49_object_2' }).next()
      })((err, result) => {
        if (err) return done(err)

        should.exist(result)
        result.properties.length.should.equal(3)

        let c = _.find(result.properties, p => p.name === 'c_c')

        c.label.should.equal('C')
        c.type.should.equal('String')
        c.indexed.should.equal(true)

        done()
      })
    })

    it('should delete a custom object', (done) => {
      sandboxed(function() {

        script.as(
          't49_dev@medable.com',
          {
            principal: {
              roles: [],
              scope: ['*'],
              skipAcl: false,
              bypassCreateAcl: false
            },
            acl: {
              safe: true
            },
            modules: {
              safe: false,
              blacklist: [],
              whitelist: ['script.as', 'objects.*']
            }
          },

          () => {
            org.objects.objects.deleteOne({
              name: 'c_t49_object_2'
            }).execute()
          }
        )

        return org.objects.objects.find({ name: 'c_t49_object_2' }).count()
      })((err, result) => {
        if (err) return done(err)

        should.exist(result)
        result.should.equal(0)

        done()
      })
    })
  })

  describe('Support should not be able to update and delete a Custom Object', function() {

    before(sandboxed(function() {
      org.objects.objects.insertOne({
        label: 'c_t49_object_3',
        name: 'c_t49_object_3',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'A', name: 'c_a', type: 'String', indexed: true },
          { label: 'B', name: 'c_b', type: 'Number', indexed: true }
        ]
      }).execute()
    }))

    it('should not update a custom object', (done) => {
      sandboxed(function() {

        script.as(
          't49_support@medable.com',
          {
            principal: {
              roles: [],
              scope: ['*'],
              skipAcl: false,
              bypassCreateAcl: false
            },
            acl: {
              safe: true
            },
            modules: {
              safe: false,
              blacklist: [],
              whitelist: ['script.as', 'objects.*']
            }
          },

          () => {
            org.objects.objects.updateOne({
              name: 'c_t49_object_3'
            },
            {
              $push: {
                properties: [{ label: 'C', name: 'c_c', type: 'String', indexed: true }]
              }
            }).execute()
          }
        )

        return org.objects.objects.find({ name: 'c_t49_object_3' }).next()
      })((err, result) => {
        should.not.exist(result)
        should.exist(err)
        err.errCode.should.equal('cortex.accessDenied.instanceUpdate')
        err.statusCode.should.equal(403)
        done()
      })
    })

    it('should not delete a custom object', (done) => {

      sandboxed(function() {
        script.as(
          't49_support@medable.com',
          {
            principal: {
              roles: [],
              scope: ['*'],
              skipAcl: false,
              bypassCreateAcl: false
            },
            acl: {
              safe: true
            },
            modules: {
              safe: false,
              blacklist: [],
              whitelist: ['script.as', 'objects.*']
            }
          },

          () => {
            org.objects.objects.deleteOne({
              name: 'c_t49_object_3'
            }).execute()
          }
        )

        return org.objects.objects.find({ name: 'c_t49_object_3' }).count()
      })((err, result) => {
        should.not.exist(result)
        should.exist(err)
        err.errCode.should.equal('cortex.accessDenied.instanceDelete')
        err.statusCode.should.equal(403)
        done()
      })
    })
  })

  describe('Custom should not be able to update and delete a Custom Object', function() {

    before(sandboxed(function() {
      org.objects.objects.insertOne({
        label: 'c_t49_object_4',
        name: 'c_t49_object_4',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'A', name: 'c_a', type: 'String', indexed: true },
          { label: 'B', name: 'c_b', type: 'Number', indexed: true }
        ]
      }).execute()
    }))

    it('should not update a custom object', (done) => {
      sandboxed(function() {

        script.as(
          't49_custom@medable.com',
          {
            principal: {
              roles: [],
              scope: ['*'],
              skipAcl: false,
              bypassCreateAcl: false
            },
            acl: {
              safe: true
            },
            modules: {
              safe: false,
              blacklist: [],
              whitelist: ['script.as', 'objects.*']
            }
          },

          () => {
            org.objects.objects.updateOne({
              name: 'c_t49_object_4'
            },
            {
              $push: {
                properties: [{ label: 'C', name: 'c_c', type: 'String', indexed: true }]
              }
            }).execute()
          }
        )

        return org.objects.objects.find({ name: 'c_t49_object_4' }).next()
      })((err, result) => {
        should.not.exist(result)
        should.exist(err)
        err.errCode.should.equal('cortex.accessDenied.instanceUpdate')
        done()
      })
    })

    it('should not delete a custom object', (done) => {

      sandboxed(function() {
        script.as(
          't49_custom@medable.com',
          {
            principal: {
              roles: [],
              scope: ['*'],
              skipAcl: false,
              bypassCreateAcl: false
            },
            acl: {
              safe: true
            },
            modules: {
              safe: false,
              blacklist: [],
              whitelist: ['script.as', 'objects.*']
            }
          },

          () => {
            org.objects.objects.deleteOne({
              name: 'c_t49_object_4'
            }).execute()
          }
        )

        return org.objects.objects.find({ name: 'c_t49_object_4' }).count()
      })((err, result) => {
        should.not.exist(result)
        should.exist(err)
        err.errCode.should.equal('cortex.accessDenied.instanceDelete')
        done()
      })
    })
  })
})
