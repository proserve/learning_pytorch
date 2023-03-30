'use strict'

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server')

describe('Issues', function() {

  describe('CTXAPI-91 - Pipeline matches fail in latest parser engine', function() {

    // mimic support login to be able to see explains()

    let isSupportLogin
    before(function(callback) {
      isSupportLogin = server.principals.admin.isSupportLogin
      server.principals.admin.isSupportLogin = true
      callback()
    })

    after(function(callback) {
      server.principals.admin.isSupportLogin = isSupportLogin
      callback()
    })

    it('input stage should match output stage when after a non-indexed stage.', sandboxed(function() {

      /* global org */

      require('should')

      for (let engine of ['stable', 'latest']) {

        const Model = org.objects.audits,
              pipeline = [{
                $group: {
                  _id: {
                    err: 'err.code'
                  },
                  count: { $sum: 1 }
                }
              }, {
                $match: {
                  '_id.err': { $gt: '' },
                  count: { $gt: 0 }
                }
              }],
              query = Model
                .aggregate(pipeline)
                .skipAcl()
                .grant(4)
                .engine(engine)
                .explain({ query: true }).query

        pipeline[1].should.be.eql(query.pipeline[2])

      }

    }))

  })

})
