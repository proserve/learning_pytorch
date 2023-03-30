'use strict'

/* global before */

const server = require('../../lib/server'),
      should = require('should'),
      acl = require('../../../lib/acl'),
      request = require('request')

server.usingMedia = true

describe('Rest Api', function() {

  describe('Objects', function() {

    before(function(callback) {

      server.sessions.provider
        .put(server.makeEndpoint('/accounts/' + server.principals.provider._id))
        .set(server.getSessionHeaders())
        .send({ favorite: true })
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'account')
          should.equal(result.favorite, true)
          callback()
        })

    })

    describe('GET /:objects/:id', function() {

      it('should load the instance', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/accounts/' + server.principals.admin._id))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'account')
            callback()
          })
      })

    })

    describe('GET /:objects/:id/*', function() {

      it('should load the property', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/accounts/' + server.principals.admin._id + '/email'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(server.principals.admin.email, result.data)
            callback()
          })
      })

      it('should stream the property', function(callback) {

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

          if (err) return callback(err)

          server.sessions.admin
            .get(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + instanceAc.subjectId + '/c_file/content'))
            .set({ 'Accept': 'text/plain' })
            .set(server.getSessionHeaders())
            .done(function(err, result, response) {
              should.not.exist(err)
              should.exist(response.headers.location)
              request(response.headers.location, (err, response) => {
                should.not.exist(err)
                should.equal(response.body, 'Testy')
                callback()
              })
            })

        })

      })

    })

    describe('GET /:objects', function() {

      it('should load a list', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/accounts'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            callback()
          })
      })

    })

    describe('GET /:objects?favorites', function() {

      it('should load a list of only favorites', function(callback) {
        server.sessions.provider
          .get(server.makeEndpoint('/accounts?favorites=true'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.equal(1, result.data.filter(v => (v._id === server.principals.provider._id.toString())).length)
            callback()
          })
      })

      it('should load a list of only !favorites', function(callback) {
        server.sessions.provider
          .get(server.makeEndpoint('/accounts?favorites=false'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.equal(0, result.data.filter(v => (v._id === server.principals.provider._id.toString())).length)
            callback()
          })
      })

      it('should load an empty list of favorites for another user', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/accounts?favorites=true'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.equal(0, result.data.length)
            callback()
          })
      })

    })

    describe('POST /:objects', function() {

      it('should create an instance', function(callback) {

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

          if (err) return callback(err)

          server.sessions.admin
            .post(server.makeEndpoint('/c_script_mod_obj_stream_tests'))
            .set(server.getSessionHeaders())
            .send({ c_label: 'wassamaddafayou', favorite: true })
            .done(function(err, result) {
              should.not.exist(err)
              should.exist(result)
              should.equal(result.object, 'c_script_mod_obj_stream_test')
              should.equal(result.favorite, true)
              should.equal(result.c_label, 'wassamaddafayou')
              callback()
            })
        })
      })

      it('should fail to create an account directly from the api', function(callback) {

        server.sessions.admin
          .post(server.makeEndpoint('/accounts'))
          .set(server.getSessionHeaders())
          .send({ email: 'no@never.org' })
          .done(function(err) {
            should.exist(err)
            should.equal(err.code, 'kAccessDenied')
            callback()
          })
      })

    })

    describe('PUT /:objects/:id', function() {

      it('should update an instance', function(callback) {

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

          if (err) return callback(err)

          server.sessions.admin
            .put(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + instanceAc.subjectId))
            .set(server.getSessionHeaders())
            .send({ c_label: 'ahoy hoy!' })
            .done(function(err, result) {
              should.not.exist(err)
              should.exist(result)
              should.equal(result.object, 'c_script_mod_obj_stream_test')
              should.equal(result.c_label, 'ahoy hoy!')
              callback()
            })
        })
      })

      it('should fail to update a missing property', function(callback) {

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

          if (err) return callback(err)

          server.sessions.admin
            .put(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + instanceAc.subjectId))
            .set(server.getSessionHeaders())
            .send({ c_not_a_prop: true })
            .done(function(err, result) {
              should.exist(err)
              should.equal(err.code, 'kNotFound')
              should.equal(err.path, 'c_not_a_prop')
              callback()
            })
        })
      })

    })

    describe('PUT /:objects/:id/*', function() {

      it('should update an instance property', function(callback) {

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

          if (err) return callback(err)

          server.sessions.admin
            .put(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + instanceAc.subjectId + '/c_label'))
            .set(server.getSessionHeaders())
            .set({ 'Content-Type': 'text/plain' })
            .send('"i\'m proud to be an okey"')
            .set({ 'Content-Type': 'application/json' })
            .done(function(err, result) {
              should.not.exist(err)
              should.exist(result)
              should.equal(result.object, 'result')
              should.equal(result.data, 'i\'m proud to be an okey')
              callback()
            })
        })
      })

      it('should fail to update a missing property', function(callback) {

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

          if (err) return callback(err)

          server.sessions.admin
            .put(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + instanceAc.subjectId + '/c_not_a_prop'))
            .set(server.getSessionHeaders())
            .set({ 'Content-Type': 'text/plain' })
            .send('"i\'m proud to be an okey"')
            .set({ 'Content-Type': 'application/json' })
            .done(function(err, result) {
              should.exist(err)
              should.equal(err.code, 'kNotFound')
              should.equal(err.path, 'c_not_a_prop')
              callback()
            })
        })
      })

    })

    describe('POST /:objects/:id', function() {

      it('should append an instance array', function(callback) {

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

          should.not.exist(err)

          server.sessions.admin
            .post(server.makeEndpoint('/c_script_mod_obj_stream_tests'))
            .set(server.getSessionHeaders())
            .send({ c_numbers: [1, 2] })
            .done(function(err, result) {

              should.not.exist(err)

              server.sessions.admin
                .post(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + result._id))
                .set(server.getSessionHeaders())
                .send({ c_numbers: [3, 4] })
                .done(function(err, result) {
                  should.not.exist(err)
                  should.exist(result)
                  should.equal(result.object, 'c_script_mod_obj_stream_test')
                  should.exist(result.c_numbers)
                  should.equal(result.c_numbers.length, 4)
                  callback()
                })

            })

        })
      })

      it('should fail to append to missing instance array', function(callback) {

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

          should.not.exist(err)

          server.sessions.admin
            .post(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + instanceAc.subjectId))
            .set(server.getSessionHeaders())
            .send({ c_not_a_prop: [3, 4] })
            .done(function(err) {
              should.exist(err)
              should.equal(err.code, 'kNotFound')
              callback()
            })

        })
      })

    })

    describe('POST /:objects/:id/*', function() {

      it('should append an instance array', function(callback) {

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

          should.not.exist(err)

          server.sessions.admin
            .post(server.makeEndpoint('/c_script_mod_obj_stream_tests'))
            .set(server.getSessionHeaders())
            .send({ c_numbers: [1, 2] })
            .done(function(err, result) {

              should.not.exist(err)

              server.sessions.admin
                .post(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + result._id + '/c_numbers'))
                .set(server.getSessionHeaders())
                .send([3, 4])
                .done(function(err, result) {
                  should.not.exist(err)
                  should.exist(result)
                  should.equal(result.object, 'list')
                  should.exist(result.data)
                  should.equal(result.data.length, 4)
                  callback()
                })

            })

        })
      })

      it('should fail to append to missing instance array', function(callback) {

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

          should.not.exist(err)

          server.sessions.admin
            .post(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + instanceAc.subjectId + '/c_not_a_prop'))
            .set(server.getSessionHeaders())
            .send([3, 4])
            .done(function(err) {
              should.exist(err)
              should.equal(err.code, 'kNotFound')
              callback()
            })

        })
      })

    })

    describe('DELETE /:objects/:id/*', function() {

      it('should remove elements from an instance array', function(callback) {

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

          should.not.exist(err)

          server.sessions.admin
            .post(server.makeEndpoint('/c_script_mod_obj_stream_tests'))
            .set(server.getSessionHeaders())
            .send({ c_numbers: [1, 2, 3, 4, 5, 6, 7, 7, 7, 7, 7] })
            .done(function(err, result) {

              should.not.exist(err)

              let instanceId = result._id

              server.sessions.admin
                .delete(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + instanceId + '/c_numbers/7'))
                .set(server.getSessionHeaders())
                .done(function(err, result) {

                  should.not.exist(err)

                  server.sessions.admin
                    .get(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + instanceId))
                    .set(server.getSessionHeaders())
                    .done(function(err, result) {
                      should.not.exist(err)
                      should.exist(result)
                      should.exist(result.c_numbers)
                      should.equal(result.c_numbers.length, 6)
                      callback()

                    })

                })

            })

        })
      })

      it('should destroy a property', function(callback) {

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

          should.not.exist(err)

          server.sessions.admin
            .post(server.makeEndpoint('/c_script_mod_obj_stream_tests'))
            .set(server.getSessionHeaders())
            .send({ c_removable: 'remove me' })
            .done(function(err, result) {

              should.not.exist(err)
              should.exist(result)
              should.equal(result.object, 'c_script_mod_obj_stream_test')
              should.equal(result.c_removable, 'remove me')

              let instanceId = result._id

              server.sessions.admin
                .delete(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + instanceId + '/c_removable'))
                .set(server.getSessionHeaders())
                .done(function(err, result) {

                  should.not.exist(err)

                  server.sessions.admin
                    .get(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + instanceId))
                    .set(server.getSessionHeaders())
                    .done(function(err, result) {
                      should.not.exist(err)
                      should.exist(result)
                      should.equal(result.object, 'c_script_mod_obj_stream_test')
                      should.not.exist(result.c_removable)

                      callback()

                    })
                })

            })

        })
      })

    })

    describe('DELETE /:objects/:id', function() {

      it('should delete an instance', function(callback) {

        require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

          should.not.exist(err)

          server.sessions.admin
            .post(server.makeEndpoint('/c_script_mod_obj_stream_tests'))
            .set(server.getSessionHeaders())
            .done(function(err, result) {

              should.not.exist(err)

              let instanceId = result._id

              server.sessions.admin
                .delete(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + instanceId))
                .set(server.getSessionHeaders())
                .done(function(err, result) {

                  should.not.exist(err)

                  should.not.exist(err)

                  server.sessions.admin
                    .get(server.makeEndpoint('/c_script_mod_obj_stream_tests/' + instanceId))
                    .set(server.getSessionHeaders())
                    .done(function(err, result) {
                      should.exist(err)
                      should.equal(err.code, 'kNotFound')
                      callback()

                    })

                })

            })

        })
      })

    })

  })

})
