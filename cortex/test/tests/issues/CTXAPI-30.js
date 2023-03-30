'use strict'

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server')

describe('Issues', function() {

  describe('CTXAPI-30 - Expression builder outputs incorrect search query', function() {

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

    before(sandboxed(function() {

      /* global org, consts */

      const Model = org.objects.c_ctxapi_30

      org.objects.Object.insertOne({
        label: Model.name,
        name: Model.name,
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        objectTypes: [
          { label: 'A',
            name: 'c_a',
            properties: [
              { label: 'A', name: 'c_a', type: 'String', indexed: true }
            ]
          },
          { label: 'B',
            name: 'c_b',
            properties: [
              { label: 'A', name: 'c_a', type: 'Number', indexed: true }
            ]
          }
        ]
      }).execute()

    }))

    it('should produce the right results.', sandboxed(function() {

      require('should')

      const Model = org.objects.c_ctxapi_30

      Model.insertMany([
        { type: 'c_a', c_a: 1 }, { type: 'c_a', c_a: 2 }, { type: 'c_a', c_a: 3 }, // these will be cast to string
        { type: 'c_b', c_a: 1 }, { type: 'c_b', c_a: 2 }, { type: 'c_b', c_a: 3 } // these are numbers
      ]).execute()

      Model.count().should.equal(6)
      Model.find({ c_a: { $gt: 1, $lt: 3 } }).engine('stable').count().should.equal(2)
      Model.find({ c_a: { $gt: 1, $lt: 3 } }).engine('latest').count().should.equal(2)
      Model.find({ type: 'c_b', c_a: { $gt: 1, $lt: 3 } }).engine('stable').count().should.equal(1)
      Model.find({ type: 'c_b', c_a: { $gt: 1, $lt: 3 } }).engine('latest').count().should.equal(1)

    }))

    it('should produce the right indexes', sandboxed(function() {

      require('should')

      const Model = org.objects.c_ctxapi_30,
            simplified = Model.find({ type: 'c_b', c_a: { $gt: 1, $lt: 3 } }).engine('latest').skipAcl().explain({ query: true }).query.query.$and[1].$and[1],
            simpliedKey = Object.keys(simplified).find(key => key.match(/^idx\./)),
            branched = Model.find({ c_a: { $gt: 1, $lt: 3 } }).engine('latest').skipAcl().explain({ query: true }).query.query.$and[1].$and,
            branchedKeyA = Object.keys(branched[1].$or[0]).find(key => key.match(/^idx\./)),
            branchedKeyB = Object.keys(branched[1].$or[1]).find(key => key.match(/^idx\./))

      simplified.type.should.equal('c_b')
      simplified[simpliedKey].$gt.should.equal(1)
      simplified[simpliedKey].$lt.should.equal(3)

      branched[0].$or[0].c_a.$gt.should.equal('1')
      branched[0].$or[0].c_a.$lt.should.equal('3')
      branched[0].$or[1].c_a.$gt.should.equal(1)
      branched[0].$or[1].c_a.$lt.should.equal(3)

      branched[1].$or[0][branchedKeyA].$gt.should.equal('1')
      branched[1].$or[0][branchedKeyA].$lt.should.equal('3')
      branched[1].$or[1][branchedKeyB].$gt.should.equal(1)
      branched[1].$or[1][branchedKeyB].$lt.should.equal(3)

    }))

  })

})
