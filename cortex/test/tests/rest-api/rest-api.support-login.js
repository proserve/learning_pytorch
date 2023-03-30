'use strict'

/* global before */

const server = require('../../lib/server'),
      should = require('should'),
      modules = require('../../../lib/modules')

let baseOrgData = null

describe('Rest Api', function() {

  describe('Support Login', function() {

    // create new baseAdmin
    before(function(done) {

      require('../../lib/create.medable.admin')('fiachra+admin01@medable.com', (err, result) => {

        if (!err) {
          baseOrgData = result
        }
        // enable support logins
        modules.db.models.Org.updateOne({ _id: server.org._id }, {
          $inc: {
            sequence: 1
          },
          $set: {
            'support.disableSupportLogin': false
          }
        }, err => {
          done(err)
        })
      })

    })

    it('should fail to login as support to org without a reason', function(callback) {

      baseOrgData.session
        .post('/medable/sys/orgs/support-login/' + server.org.code + '/' + server.principals.admin.email)
        .set(baseOrgData.getHeaders())
        .done(function(err, result) {
          should.exist(err)
          err.errCode.should.equal('cortex.accessDenied.supportReasonRequired')
          callback()
        })
    })

    it('should login as support', function(callback) {

      baseOrgData.session
        .post('/medable/sys/orgs/support-login/' + server.org.code + '/' + server.principals.admin.email)
        .set(baseOrgData.getHeaders())
        .send({ reason: 'Login reasons' })
        .done(function(err, result) {
          should.not.exist(err)
          callback()
        })
    })

    it('should make authenticated request as support login user', function(callback) {

      baseOrgData.session
        .get(server.makeEndpoint('/accounts/me'))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.not.exist(err)
          result.object.should.equal('account')
          result.email.should.equal(server.principals.admin.email)
          callback()
        })
    })

    let script = {
      script: 'return org.objects.account.find().skipAcl().grant(consts.accessLevels.read).engine("latest").explain({plan: true, query: true})',
      language: 'javascript',
      specification: 'es6'
    }

    it('should return query cursor explain data from script', function(callback) {

      baseOrgData.session
        .post(server.makeEndpoint('/sys/script_runner'))
        .set(server.getSessionHeaders())
        .send(script)
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.exist(result.data)
          should.exist(result.engine)
          should.exist(result.query)
          should.exist(result.plan)
          callback()
        })
    })

    it('should not return query cursor explain data from script', function(callback) {

      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set(server.getSessionHeaders())
        .send(script)
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.exist(result.data)
          should.exist(result.engine)
          should.not.exist(result.query)
          should.not.exist(result.plan)
          callback()
        })
    })

  })

})
