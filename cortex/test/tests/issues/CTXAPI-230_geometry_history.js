'use strict'

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      cleanInstances = function() {
        const should = require('should')
        org.objects.c_ctxapi_230.deleteMany({}).execute()
        should.equal(org.objects.c_ctxapi_230.find().count(), 0)
      }

describe('Issue - fix issue when Geometry type property has history enabled', function() {

  describe('CTXAPI-230 - getting history of Geometry property', function() {

    after(sandboxed(cleanInstances))

    before(sandboxed(function() {
      /* global consts */
      org.objects.objects.insertOne({
        label: 'CTXAPI-230',
        name: 'c_ctxapi_230',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [{
          name: 'location',
          label: 'Location',
          type: 'Geometry',
          history: true
        }]
      }).execute()

      const item = org.objects.c_ctxapi_230.insertOne({
        c_location: {
          type: 'Point',
          coordinates: [
            0,
            0
          ]
        }
      }).execute()

      org.objects.c_ctxapi_230.updateOne({ _id: item }, { $set: {
        'c_location': [
          -50,
          -30
        ]
      } }).execute()

      return org.objects.c_ctxapi_230.updateOne({ _id: item }, { $set: {
        'c_location': [
          -70,
          -20
        ]
      } }).execute()
    }))

    before((done) => {
      server.events.once('worker.done', () => {
        done()
      })
    })

    it('get document with audit.history on it', sandboxed(function() {
      require('should')
      /* global org */
      const item = org.objects.c_ctxapi_230.find().limit(1).include('audit.history').next()
      item.audit.history.data.length.should.above(0)
      item.audit.history.data[0].c_location.coordinates[0].should.equal(-70)
      item.audit.history.data[0].c_location.coordinates[1].should.equal(-20)
      item.audit.history.data[1].c_location.coordinates[0].should.equal(-50)
      item.audit.history.data[1].c_location.coordinates[1].should.equal(-30)
      item.audit.history.data[2].c_location.coordinates[0].should.equal(0)
      item.audit.history.data[2].c_location.coordinates[1].should.equal(0)
    }))

  })

})
