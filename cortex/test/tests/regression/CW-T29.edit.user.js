'use strict'

/* global before, org, script */

const consts = require('../../../lib/consts'),
      sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      should = require('should'),
      _ = require('lodash')

let Undefined

describe('CW-T29 - All users should be able to edit their own account information', function() {

  before(function(done) {
    let code = function() {

          if (!org.read('roles').find(r => r.code === 'c_ctxapi_t29')) {
            org.objects.org.updateOne({ code: org.code }, {
              $push: {
                roles: [{
                  code: 'c_ctxapi_t29',
                  name: 'CTXAPI-T29'
                }]
              }
            }).execute()
          }

          let roleId = org.read('roles').find(r => r.code === 'c_ctxapi_t29')._id

          org.objects.account.register({
            name: {
              first: 'Custom',
              last: 'User'
            },
            email: 't29_custom@medable.com',
            mobile: '15055555555',
            roles: [roleId]
          }, {
            skipVerification: true,
            skipActivation: true,
            skipNotification: true,
            requireMobile: false
          })

          org.objects.account.register({
            name: {
              first: 'Admin',
              last: 'User'
            },
            email: 't29_admin@medable.com',
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
            email: 't29_dev@medable.com',
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
            email: 't29_support@medable.com',
            mobile: '15055555555',
            roles: [consts.roles.support]
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

  describe('CW-T29 - Should edit own account information', function() {

    it('should edit its own account information with admin role', (done) => {

      sandboxed(function() {

        const customRole = org.read('roles').find(r => r.code === 'c_ctxapi_t29')._id

        script.as(
          't29_admin@medable.com',
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
            return org.objects.account.updateOne({ email: 't29_admin@medable.com' }, {
              $set: {
                name: {
                  first: 'Admin EDIT',
                  last: 'User EDIT'
                }
              },
              $push: {
                roles: [
                  customRole
                ]
              }
            }).execute()
          }
        )

        let account = org.objects.account.find({ email: 't29_admin@medable.com' }).skipAcl().grant(consts.accessLevels.read).next()
        return { account, customRole }
      })((err, result) => {
        should.not.exist(err)
        result.account.name.first.should.equal('Admin EDIT')
        result.account.name.last.should.equal('User EDIT')
        result.account.roles.length.should.equal(2)

        let stringRoles = result.account.roles.map(a => a.toString())
        should.equal(_.includes(stringRoles, consts.roles.admin.toString()), true)
        should.equal(_.includes(stringRoles, result.customRole.toString()), true)

        done()
      })
    })

    it('should edit its own account information with support role', sandboxed(function() {

      require('should')

      script.as(
        't29_support@medable.com',
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
          return org.objects.account.updateOne({ email: 't29_support@medable.com' }, {
            $set: {
              name: {
                first: 'Support EDIT',
                last: 'User EDIT'
              }
            }
          }).execute()
        }
      )

      let result = org.objects.account.find({ email: 't29_support@medable.com' }).skipAcl().grant(consts.accessLevels.read).next()

      result.name.first.should.equal('Support EDIT')
      result.name.last.should.equal('User EDIT')
    }))

    it('should edit its own account information with developer role', sandboxed(function() {

      require('should')

      script.as(
        't29_dev@medable.com',
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
          return org.objects.account.updateOne({ email: 't29_dev@medable.com' }, {
            $set: {
              name: {
                first: 'Developer EDIT',
                last: 'User EDIT'
              }
            }
          }).execute()
        }
      )

      let result = org.objects.account.find({ email: 't29_dev@medable.com' }).skipAcl().grant(consts.accessLevels.read).next()

      result.name.first.should.equal('Developer EDIT')
      result.name.last.should.equal('User EDIT')
    }))

    it('should edit its own account information with custom role', sandboxed(function() {

      require('should')

      script.as(
        't29_custom@medable.com',
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
          return org.objects.account.updateOne({ email: 't29_custom@medable.com' }, {
            $set: {
              name: {
                first: 'Custom EDIT',
                last: 'User EDIT'
              }
            }
          }).execute()
        }
      )

      let result = org.objects.account.find({ email: 't29_custom@medable.com' }).skipAcl().grant(consts.accessLevels.read).next()

      result.name.first.should.equal('Custom EDIT')
      result.name.last.should.equal('User EDIT')
    }))
  })

  describe('CW-T29 - Should not edit other users account information', function() {

    it('should not edit other user information', function(done) {
      sandboxed(function() {
        script.as(
          't29_admin@medable.com',
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
            return org.objects.account.updateOne({ email: 't29_custom@medable.com' }, {
              $set: {
                name: {
                  first: 'Should not',
                  last: 'Edit this info'
                }
              }
            }).execute()
          }
        )
      })((err, result) => {
        should.equal(result, Undefined)
        should.exist(err)
        err.errCode.should.equal('cortex.accessDenied.instanceUpdate')
        done()
      })
    })
  })

  describe('CW-T29 - Should not be able to upgrade its own role', function() {

    it('should not be able to push any role being custom user', function(done) {
      sandboxed(function() {
        script.as(
          't29_custom@medable.com',
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
            return org.objects.account.updateOne({ email: 't29_custom@medable.com' }, {
              $push: {
                roles: [
                  consts.roles.support
                ]
              }
            }).execute()
          }
        )
      })((err, result) => {
        should.not.exist(result)
        should.exist(err)
        err.code.should.equal('kAccessDenied')
        err.path.should.equal('account.roles[]')
        done()
      })
    })

    it('should not be able to push admin role being developer user', function(done) {
      sandboxed(function() {
        script.as(
          't29_dev@medable.com',
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
            return org.objects.account.updateOne({ email: 't29_dev@medable.com' }, {
              $push: {
                roles: [
                  consts.roles.admin
                ]
              }
            }).execute()
          }
        )
      })((err, result) => {
        should.not.exist(result)
        should.exist(err)
        err.code.should.equal('kAccessDenied')
        err.path.should.equal('account.roles[]')
        done()
      })
    })
  })
})
