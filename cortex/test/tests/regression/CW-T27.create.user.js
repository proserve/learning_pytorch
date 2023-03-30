'use strict'

/* global before, consts, org */

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      should = require('should'),
      _ = require('lodash')

let customRoleId,
    customInheritsRoleId

describe('CW-T27 - Admin user should be able to create users', function() {

  describe('CW-T27 - Create a User', function() {

    before(function(done) {
      sandboxed(function() {

        if (!org.read('roles').find(r => r.code === 'c_ctxapi_t27')) {
          org.objects.org.updateOne({ code: org.code }, {
            $push: {
              roles: [{
                code: 'c_ctxapi_t27',
                name: 'CTXAPI-T27'
              }]
            }
          }).execute()
        }

        let fatherRoleId, sonRoleId

        fatherRoleId = org.read('roles').find(r => r.code === 'c_ctxapi_t27')._id

        if (!org.read('roles').find(r => r.code === 'c_ctxapi_t27_inherits')) {
          org.objects.org.updateOne({ code: org.code }, {
            $push: {
              roles: [{
                code: 'c_ctxapi_t27_inherits',
                name: 'CTXAPI-T27-inherits',
                include: [fatherRoleId]
              }]
            }
          }).execute()
        }

        sonRoleId = org.read('roles').find(r => r.code === 'c_ctxapi_t27_inherits')._id

        return { fatherRoleId, sonRoleId }
      })((err, result) => {
        if (err) return done(err)
        customRoleId = result.fatherRoleId.toString()
        customInheritsRoleId = result.sonRoleId.toString()
        done()
      })
    })

    it('should create user with custom role', (done) => {
      let code = function() {
            const email = 'custom@medable.com',
                  roleID = org.read('roles').find(r => r.code === 'c_ctxapi_t27')._id

            org.objects.account.register({
              name: {
                first: 'Custom',
                last: 'Custom'
              },
              email: email,
              mobile: '15055555555',
              roles: [roleID]
            }, {
              skipVerification: true,
              skipActivation: true,
              skipNotification: true,
              requireMobile: false
            })

            return org.objects.account.find({ email: email }).skipAcl().grant(consts.accessLevels.read).next()
          },
          codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
          script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set(server.getSessionHeaders())
        .send(script)
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.email, 'custom@medable.com')
          should.equal(result.mobile, '+15055555555')
          should.equal(result.access, 4)
          should.exist(result.accessRoles)
          should.equal(_.includes(result.accessRoles, '000000000000000000000004'), true)
          should.equal(_.includes(result.accessRoles, '000000000000000000000006'), true)
          should.equal(_.includes(result.accessRoles, '000000000000000000000007'), true)
          should.equal(result.roles.length, 1)
          should.equal(result.roles[0], customRoleId)
          should.exist(result.inherited_roles)
          should.equal(result.inherited_roles.length, 0)
          should.equal(result.name.first, 'Custom')
          should.equal(result.name.last, 'Custom')
          should.equal(result.state, 'verified')
          should.equal(result.locked, false)
          done()
        })
    })

    it('should create a user with a custom role that inherits from another custom role', (done) => {
      let code = function() {
            const email = 'custom+inherits@medable.com',
                  roleID = org.read('roles').find(r => r.code === 'c_ctxapi_t27_inherits')._id

            org.objects.account.register({
              name: {
                first: 'Custom',
                last: 'Inherits Custom'
              },
              email: email,
              mobile: '15055555555',
              roles: [roleID]
            }, {
              skipVerification: true,
              skipActivation: true,
              skipNotification: true,
              requireMobile: false
            })

            return org.objects.account.find({ email: email }).skipAcl().grant(consts.accessLevels.read).next()
          },
          codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
          script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set(server.getSessionHeaders())
        .send(script)
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.email, 'custom+inherits@medable.com')
          should.equal(result.mobile, '+15055555555')
          should.equal(result.access, 4)
          should.exist(result.accessRoles)
          should.equal(_.includes(result.accessRoles, '000000000000000000000004'), true)
          should.equal(_.includes(result.accessRoles, '000000000000000000000006'), true)
          should.equal(_.includes(result.accessRoles, '000000000000000000000007'), true)
          should.equal(result.roles.length, 1)
          should.equal(result.roles[0], customInheritsRoleId)
          should.exist(result.inherited_roles)
          should.equal(result.inherited_roles.length, 1)
          should.equal(result.inherited_roles[0], customRoleId)
          should.equal(result.name.first, 'Custom')
          should.equal(result.name.last, 'Inherits Custom')
          should.equal(result.state, 'verified')
          should.equal(result.locked, false)
          done()
        })
    })

    it('should not be able to create a role that inherits from a built-in role', sandboxed(function() {
      const tryCatch = require('util.values').tryCatch
      require('should')
      tryCatch(function() {
        org.objects.org.updateOne({ code: org.code }, {
          $push: {
            roles: [{
              code: 'c_ctxapi_t27_inherits_provider',
              name: 'CTXAPI-T27-inherits-provider',
              include: [consts.roles.provider]
            }]
          }
        }).execute()

        return org.read('roles').find(r => r.code === 'c_ctxapi_t27_inherits_provider')
      }, function(err) {
        err.code.should.equal('kValidationError')
        err.errCode.should.equal('cortex.invalidArgument.validation')
        err.faults.length.should.equal(1)
        err.faults[0].errCode.should.equal('cortex.invalidArgument.unspecified')
        err.faults[0].path.should.equal('org.roles[].include[]')
      })
    }))

    it('should create an admin user', (done) => {

      let code = function() {
            const email = 'admin@medable.com'

            org.objects.account.register({
              name: {
                first: 'Admin',
                last: 'Test'
              },
              email: email,
              mobile: '15055555555',
              roles: [consts.roles.Administrator]
            }, {
              skipVerification: true,
              skipActivation: true,
              skipNotification: true,
              requireMobile: false
            })

            return org.objects.account.find({ email: email }).skipAcl().grant(consts.accessLevels.read).next()
          },
          codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
          script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set(server.getSessionHeaders())
        .send(script)
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.email, 'admin@medable.com')
          should.equal(result.mobile, '+15055555555')
          should.equal(result.access, 4)
          should.exist(result.accessRoles)
          should.equal(_.includes(result.accessRoles, '000000000000000000000004'), true)
          should.equal(_.includes(result.accessRoles, '000000000000000000000006'), true)
          should.equal(_.includes(result.accessRoles, '000000000000000000000007'), true)
          should.equal(result.roles.length, 1)
          should.equal(result.roles[0], '000000000000000000000004')
          should.exist(result.inherited_roles)
          should.equal(result.inherited_roles.length, 2)
          should.equal(_.includes(result.inherited_roles, '000000000000000000000007'), true)
          should.equal(_.includes(result.inherited_roles, '000000000000000000000006'), true)
          should.equal(result.name.first, 'Admin')
          should.equal(result.name.last, 'Test')
          should.equal(result.state, 'verified')
          should.equal(result.locked, false)
          done()
        })
    })

    it('should create a support user', (done) => {

      let code = function() {
            const email = 'support@medable.com'

            org.objects.account.register({
              name: {
                first: 'Support',
                last: 'Test'
              },
              email: email,
              mobile: '15055555555',
              roles: [consts.roles.support]
            }, {
              skipVerification: true,
              skipActivation: true,
              skipNotification: true,
              requireMobile: false
            })

            return org.objects.account.find({ email: email }).skipAcl().grant(consts.accessLevels.read).next()
          },
          codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
          script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set(server.getSessionHeaders())
        .send(script)
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.email, 'support@medable.com')
          should.equal(result.mobile, '+15055555555')
          should.equal(result.access, 4)
          should.exist(result.accessRoles)
          should.equal(_.includes(result.accessRoles, '000000000000000000000004'), true)
          should.equal(_.includes(result.accessRoles, '000000000000000000000006'), true)
          should.equal(_.includes(result.accessRoles, '000000000000000000000007'), true)
          should.equal(result.roles.length, 1)
          should.equal(result.roles[0], '000000000000000000000006')
          should.exist(result.inherited_roles)
          should.equal(result.inherited_roles.length, 0)
          should.equal(result.name.first, 'Support')
          should.equal(result.name.last, 'Test')
          should.equal(result.state, 'verified')
          should.equal(result.locked, false)
          done()
        })
    })

    it('should create a developer user', (done) => {

      let code = function() {
            const email = 'developer@medable.com'

            org.objects.account.register({
              name: {
                first: 'Developer',
                last: 'Test'
              },
              email: email,
              mobile: '15055555555',
              roles: [consts.roles.developer]
            }, {
              skipVerification: true,
              skipActivation: true,
              skipNotification: true,
              requireMobile: false
            })

            return org.objects.account.find({ email: email }).skipAcl().grant(consts.accessLevels.read).next()
          },
          codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
          script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set(server.getSessionHeaders())
        .send(script)
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.email, 'developer@medable.com')
          should.equal(result.mobile, '+15055555555')
          should.equal(result.access, 4)
          should.exist(result.accessRoles)
          should.equal(_.includes(result.accessRoles, '000000000000000000000004'), true)
          should.equal(_.includes(result.accessRoles, '000000000000000000000006'), true)
          should.equal(_.includes(result.accessRoles, '000000000000000000000007'), true)
          should.equal(result.roles.length, 1)
          should.equal(result.roles[0], '000000000000000000000007')
          should.exist(result.inherited_roles)
          should.equal(result.inherited_roles.length, 0)
          should.equal(result.name.first, 'Developer')
          should.equal(result.name.last, 'Test')
          should.equal(result.state, 'verified')
          should.equal(result.locked, false)
          done()
        })
    })

    it('should create a provider user', (done) => {

      let code = function() {
            const email = 'provider@medable.com'

            org.objects.account.register({
              name: {
                first: 'Provider',
                last: 'Test'
              },
              email: email,
              mobile: '15055555555',
              roles: [consts.roles.provider]
            }, {
              skipVerification: true,
              skipActivation: true,
              skipNotification: true,
              requireMobile: false
            })

            return org.objects.account.find({ email: email }).skipAcl().grant(consts.accessLevels.read).next()
          },
          codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
          script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set(server.getSessionHeaders())
        .send(script)
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.email, 'provider@medable.com')
          should.equal(result.mobile, '+15055555555')
          should.equal(result.access, 4)
          should.exist(result.accessRoles)
          should.equal(_.includes(result.accessRoles, '000000000000000000000004'), true)
          should.equal(_.includes(result.accessRoles, '000000000000000000000006'), true)
          should.equal(_.includes(result.accessRoles, '000000000000000000000007'), true)
          should.equal(result.roles.length, 1)
          should.equal(result.roles[0], '000000000000000000000005')
          should.exist(result.inherited_roles)
          should.equal(result.inherited_roles.length, 0)
          should.equal(result.name.first, 'Provider')
          should.equal(result.name.last, 'Test')
          should.equal(result.state, 'verified')
          should.equal(result.locked, false)
          done()
        })
    })
  })

})
