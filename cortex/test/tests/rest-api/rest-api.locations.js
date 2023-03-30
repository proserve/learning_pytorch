'use strict'

/* global after */

const server = require('../../lib/server'),
      supertest = require('supertest'),
      should = require('should'),
      modules = require('../../../lib/modules')

describe('Rest Api', function() {

  describe('Locations', function() {

    after(function(done) {

      const agent = supertest.agent(server.api.expressApp)
      agent
        .post(server.makeEndpoint('/accounts/login'))
        .set(server.getSessionHeaders())
        .send({ email: server.principals.admin.email, password: server.password })
        .done((err) => {
          if (!err) {
            server.sessions.admin = agent
            return done()
          }
          modules.db.models.Callback.findOne({ handler: 'ver-location', target: server.principals.admin.email }).lean().select({ token: 1 }).exec((err, ver) => {
            if (err) return done(err)
            agent
              .post(server.makeEndpoint('/accounts/login'))
              .set(server.getSessionHeaders())
              .send({ email: this.principals.admin.email, password: this.password, location: { name: 'newLocation', verificationToken: ver.token } })
              .done((err) => {
                server.sessions.admin = agent
                done(err)

              })
          })
        })
    })

    let locationID = null,
        newLocationName = 'New Location Name'

    it('should list locations', function(callback) {
      server.sessions.admin
        .get(server.makeEndpoint('/locations'))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'list')
          should.exist(result.data)
          locationID = result.data[0]._id
          callback()
        })
    })

    it('should update location name', function(callback) {
      server.sessions.admin
        .put(server.makeEndpoint('/locations/' + locationID))
        .set(server.getSessionHeaders())
        .send({ name: newLocationName })
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'location')
          result.name.should.equal(newLocationName)
          callback()
        })
    })

    it('should get location by ID', function(callback) {
      server.sessions.admin
        .get(server.makeEndpoint('/locations/' + locationID))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'location')
          result.name.should.equal(newLocationName)
          callback()
        })
    })

    it('should delete Location', function(callback) {
      server.sessions.admin
        .delete(server.makeEndpoint('/locations/' + locationID))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'result')
          result.data.should.be.ok()
          callback()
        })
    })

  })

})
