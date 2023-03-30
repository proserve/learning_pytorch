'use strict'

const server = require('../../lib/server'),
      should = require('should'),
      async = require('async'),
      modules = require('../../../lib/modules'),
      { v4 } = require('uuid')

describe('Rest Api', function() {

  describe('Cache', function() {

    const uuid = v4()

    let cacheItems = [
      {
        key: `${uuid}testKey1`,
        val: {
          data: 'testVal1'
        }
      },
      {
        key: `${uuid}testKey2`,
        val: {
          data: 'testVal2'
        }
      },
      {
        key: `${uuid}testKey3`,
        val: {
          data: 'testVal3'
        }
      }
    ]

    beforeEach(function(callback) {

      async.each(
        cacheItems,
        ({ key, val }, callback) => modules.cache.set(server.org, key, val, callback),
        callback
      )

    })

    afterEach(function(callback) {

      async.each(
        cacheItems,
        ({ key }, callback) => modules.cache.del(server.org, key, callback),
        callback
      )

    })

    describe('POST /cache', function() {

      it('should post cache item 1', function(callback) {

        server.sessions.admin
          .post(server.makeEndpoint('/cache/key/' + cacheItems[0].key))
          .set(server.getSessionHeaders())
          .send(cacheItems[0].val)
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            callback()
          })
      })

    })

    describe('GET /cache', function() {

      it('should get cache count with partial string "test"', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint(`/cache/count/${uuid}`))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'result')
            should.exist(result.data)
            result.data.should.equal(3)
            callback()
          })
      })

      it('should list cache', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/cache/'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.exist(result.data)
            callback()
          })
      })

      it('should have cache Item 1', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/cache/has/' + cacheItems[0].key))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            result.data.should.be.ok()
            callback()
          })
      })

      it('should not have cache Item 3', function(callback) {

        modules.cache.del(server.org, cacheItems[2].key, function(err) {
          if (err) {
            return callback(err)
          }
          server.sessions.admin
            .get(server.makeEndpoint('/cache/has/' + cacheItems[2].key))
            .set(server.getSessionHeaders())
            .done(function(err, result) {
              should.not.exist(err)
              should.exist(result)
              result.data.should.not.be.ok()
              callback()
            })

        })

      })

      it('should get cache item 2', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/cache/key/' + cacheItems[1].key))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'result')
            should.exist(result.data)
            result.data.data.should.equal(cacheItems[1].val.data)
            callback()
          })
      })

      it('should fail to get cache item 3', function(callback) {

        modules.cache.del(server.org, cacheItems[2].key, function(err) {
          if (err) {
            return callback(err)
          }
          server.sessions.admin
            .get(server.makeEndpoint('/cache/key/' + cacheItems[2].key))
            .set(server.getSessionHeaders())
            .done(function(err, result) {
              should.exist(err)
              should.equal(err.code, 'kNotFound')
              should.exist(result)
              should.equal(result.object, 'fault')
              callback()
            })

        })
      })

    })

    describe('DELETE /cache', function() {

      it('should delete cache item 1', function(done) {

        async.waterfall([
          callback => {
            server.sessions.admin
              .delete(server.makeEndpoint('/cache/key/' + cacheItems[0].key))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.object, 'result')
                should.exist(result.data)
                result.data.should.be.ok()
                callback()
              })
          },
          callback => {
            server.sessions.admin
              .get(server.makeEndpoint(`/cache/count/${uuid}`))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.object, 'result')
                should.exist(result.data)
                result.data.should.equal(2)
                callback()
              })
          }
        ], done)

      })

      it('should clear entire cache', function(done) {

        async.waterfall([
          callback => {
            server.sessions.admin
              .delete(server.makeEndpoint('/cache/all/'))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.object, 'result')
                should.exist(result.data)
                result.data.should.be.greaterThan(0)
                callback()
              })
          },
          callback => {
            server.sessions.admin
              .get(server.makeEndpoint(`/cache/count/${uuid}`))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.object, 'result')
                should.exist(result.data)
                result.data.should.equal(0)
                callback()
              })
          }
        ], done)

      })

    })

  })

})
