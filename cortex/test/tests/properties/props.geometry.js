'use strict'

/* global consts */

const sandboxed = require('../../lib/sandboxed')

describe('Properties', function() {

  describe('Properties - Coordinate & Geometry', function() {

    before(sandboxed(function() {

      // noinspection NpmUsedModulesInstalled
      const objects = require('objects'),
            CoordGeos = require('wrapped')('c_coord_and_geos')

      objects.list('objects', { where: { name: 'c_coord_and_geo' }, paths: '_id' }).data.forEach(function(object) {
        objects.delete('objects', object._id)
      })

      objects.create('objects', {
        label: 'Coordinate & Geometry Test',
        name: 'c_coord_and_geo',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'Coordinate', name: 'c_coordinate', type: 'Coordinate' },
          { label: 'Coordinate Array', name: 'c_coordinate_array', type: 'Coordinate', array: true },
          { label: 'Point', name: 'c_point', type: 'Geometry', geoType: 'Point', indexed: true },
          { label: 'MultiPoint', name: 'c_multipoint', type: 'Geometry', geoType: 'MultiPoint', indexed: true }
        ]
      })

      CoordGeos.insertOne({
        c_coordinate: [7654321, -1234567],
        c_coordinate_array: [[7654321, -1234567], [7654321, -1234567], [123, 321]],
        c_point: [-123.863793, 49.472013],
        c_multipoint: [[-123.863793, 49.472013], [1, 1], [-1, -1]]
      })
      CoordGeos.insertOne({
        c_coordinate: [7654321, -1234567],
        c_coordinate_array: [[7654321, -1234567], [7654321, -1234567], [123, 321]],
        c_point: [-123.863793, 49.472013],
        c_multipoint: [[-123.863793, 49.472013], [1, 1], [-1, -1]]
      })
      CoordGeos.insertOne({
        c_coordinate: [null, null],
        c_coordinate_array: [[456, 456], [456, 456], [null, null]],
        c_point: [-1, -1],
        c_multipoint: [[1, 2], [3, 4], [5, 6]]
      })

      CoordGeos.insertOne({
        c_coordinate: [null, null],
        c_coordinate_array: [[456, 456], [456, 456], [null, null]],
        c_point: [-1, -1],
        c_multipoint: [[1.0009, 2.1999], [1.1, 2.2], [1.1, 2.2]]
      })

    }))

    it('various matcher test cases.', sandboxed(function() {

      require('should')

      const CoordGeos = require('wrapped')('c_coord_and_geos')

      let instances

      instances = CoordGeos.pipeline()
        .match({
          c_point: {
            $within: {
              $center: [-123.863793, 49.472013],
              $radius: 0
            }
          }
        })
        .exec()
      instances.data.length.should.equal(2)

      instances = CoordGeos.pipeline()
        .match({
          c_multipoint: {
            $within: {
              $center: [1.0009, 2.1999],
              $radius: 200
            }
          }
        })
        .exec()
      instances.data.length.should.equal(1)

    }))

  })

})
