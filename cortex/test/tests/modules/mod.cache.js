'use strict'

/* global before */

const server = require('../../lib/server'),
      should = require('should'),
      async = require('async'),
      modules = require('../../../lib/modules')

describe('Modules', function() {

  describe('Cache', function() {

    before(function(done) {

      async.series([
        callback => {
          modules.cache.set(server.org, 'TestKey1', 'TestVal1', (err, result) => {
            callback(err)
          })
        },
        callback => {
          modules.cache.set(server.org, 'TestKey2', 'TestVal2', (err, result) => {
            callback(err)
          })
        }

      ], done)

    })

    it('Get', function(done) {

      async.series([
        callback => {
          modules.cache.get(server.org, 'TestKey1', (err, result) => {
            if (err) return callback(err)
            result.should.equal('TestVal1')
            callback()
          })
        },
        callback => {
          modules.cache.get(server.org, 'TestKey2', (err, result) => {
            if (err) return callback(err)
            result.should.equal('TestVal2')
            callback()
          })
        },
        callback => {
          modules.cache.get(server.org, 'NonExistant6541', (err, result) => {
            if (err) return callback(err)
            should.not.exist(result)
            callback()
          })
        }

      ], done)
    })

    it('Has', function(done) {
      async.series([
        callback => {
          modules.cache.has(server.org, 'TestKey1', (err, result) => {
            if (err) return callback(err)
            result.should.equal(true)
            callback()
          })
        },
        callback => {
          modules.cache.has(server.org, 'NonExistant6541', (err, result) => {
            if (err) return callback(err)
            result.should.equal(false)
            callback()
          })
        }

      ], done)

    })

    it('Find', function(callback) {
      async.series([
        callback => {
          modules.cache.find(server.org, 'Test', (err, result) => {
            if (err) return callback(err)
            result.length.should.equal(2)
            callback()
          })
        },
        callback => {
          modules.cache.find(server.org, 'NonExistant6541', (err, result) => {
            if (err) return callback(err)
            result.length.should.equal(0)
            callback()
          })
        }

      ], callback)

    })

    it('Count', function(callback) {
      modules.cache.count(server.org, 'Test', (err, result) => {
        if (err) return callback(err)
        result.should.equal(2)
        callback()
      })
    })

    it('List', function(callback) {
      modules.cache.list(server.org, 'Test', (err, result) => {
        if (err) return callback(err)
        result.data.length.should.equal(2)
        result.total.should.equal(2)
        callback()
      })
    })

    it('CAS', function(done) {

      async.series([
        callback => {
          // successful swap
          modules.cache.cas(server.org, 'TestKey1', 'TestVal1', 'TestVal3', (err) => {
            callback(err)
          })
        },
        callback => {
          modules.cache.get(server.org, 'TestKey1', (err, result) => {
            if (err) return callback(err)
            result.should.equal('TestVal3')
            callback()
          })
        },
        callback => {
          // failed swap
          modules.cache.cas(server.org, 'TestKey1', 'TestVal1', 'TestVal4', (err) => {
            if (err) return callback(err)
            callback()
          })
        },
        callback => {
          modules.cache.get(server.org, 'TestKey1', (err, result) => {
            if (err) return callback(err)
            result.should.equal('TestVal3')
            callback()
          })
        }

      ], done)
    })

    it('Delete', function(done) {
      async.series([
        callback => {
          modules.cache.del(server.org, 'TestKey1', (err) => {
            callback(err)
          })
        },
        callback => {
          modules.cache.find(server.org, 'TestKey1', (err, result) => {
            if (err) return callback(err)
            result.length.should.equal(0)
            callback()
          })
        }

      ], done)

    })

    it('Clear', function(done) {
      async.series([
        callback => {
          modules.cache.clear(server.org, (err) => {
            callback(err)
          })
        },
        callback => {
          modules.cache.find(server.org, 'Test', (err, result) => {
            if (err) return callback(err)
            result.length.should.equal(0)
            callback()
          })
        }

      ], done)
    })
  })

})
