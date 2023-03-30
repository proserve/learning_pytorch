'use strict'

/* global consts */

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('CTXAPI-167 - Geometry issue when no set.', () => {

  before(sandboxed(function() {
    global.org.objects.objects.insertOne({
      label: 'Coordinate & Geometry Test',
      name: 'c_geo',
      defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
      createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
      properties: [
        { label: 'Point', name: 'c_point', type: 'Geometry', geoType: 'Point', indexed: true }
      ]
    }).execute()
  }))

  beforeEach(async() => {
    await promised(null, sandboxed(function() {
      global.org.objects.c_geo.deleteMany().skipAcl().grant(8).execute()
    }))
  })

  it('should not add anything if property is not present', async() => {
    const result = await promised(null, sandboxed(function() {
      global.org.objects.c_geo.insertOne({}).execute()
      return global.org.objects.c_geo.find().sort({ _id: -1 }).limit(1).next()
    }))
    should.not.exist(result.c_point)
  })

  it('should add property if set on payload', async() => {
    const result = await promised(null, sandboxed(function() {
      global.org.objects.c_geo.insertOne({
        c_point: [-90, 90]
      }).execute()
      return global.org.objects.c_geo.find().sort({ _id: -1 }).limit(1).next()
    }))
    should.exist(result.c_point)
    should(result.c_point.coordinates).deepEqual([-90, 90])
  })

})
