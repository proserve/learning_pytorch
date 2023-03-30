'use strict'

/* global before */

const server = require('../../lib/server'),
      should = require('should'),
      async = require('async'),
      modules = require('../../../lib/modules')

describe('Modules', function() {

  describe('Metrics', function() {

    before(function(done) {

      async.series([
        callback => {
          callback()
        },
        callback => {
          callback()
        }

      ], done)

    })

    it('should get metrics', async() => {

      const res = await modules.metrics.get()
      // console.log(JSON.stringify(res));
      should.exist(res.db)
      should.exist(res.v8)
      should.exist(res.sandbox)
      should.exist(res.workers)
    })

    it('should get org activity', function() {
      var res = modules.metrics.orgActivity(server.org._id)
      should.exist(res.requests)
      should.exist(res.scripts)
      should.exist(res.workers)
    })

    it('Org Counts', function() {
      modules.metrics.orgRequestCount(server.org._id).should.be.type('number')
      modules.metrics.orgJobCount(server.org._id).should.be.type('number')
    })

    it('Jobs', function() {
      modules.metrics.numActiveJobs.should.be.type('number')
      modules.metrics.activeJobs.should.be.instanceOf(Array)
    })

    it('Requests', function() {
      modules.metrics.numActiveRequests.should.be.type('number')
      modules.metrics.activeRequests.should.be.empty()
    })

  })

})
