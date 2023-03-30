'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Cluster', function() {

  describe('Activity', function() {

    it('activity for current org', sandboxed(function() {

      require('should')

      const api = require('api'),
            activity = api.currentActivity()

      activity.requests.length.should.be.a.Number()
      activity.scripts.length.should.be.a.Number()
      activity.workers.length.should.be.a.Number()

    }))

  })
})
