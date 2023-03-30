'use strict'

const sandboxed = require('../../lib/sandboxed'),
      cleanInstances = function() {
        const should = require('should')
        org.objects.c_ctxapi_211.deleteMany({}).execute()
        should.equal(org.objects.c_ctxapi_211.find().count(), 0)
      }

describe('Features - add support for $addFields in parser', function() {

  describe('CTXAPI-211 - querying with $addFields', function() {

    after(sandboxed(cleanInstances))

    before(sandboxed(function() {
      org.objects.objects.insertOne({
        label: 'CTXAPI-211',
        name: 'c_ctxapi_211',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'name', name: 'c_name', type: 'String', indexed: true },
          { label: 'tag', name: 'c_tag', type: 'String', indexed: true },
          { label: 'id', name: 'c_id', type: 'Number', indexed: true },
          { label: 'age', name: 'c_age', type: 'Number', indexed: true },
          { label: 'height', name: 'c_height', type: 'Number', indexed: true },
          { label: 'weight', name: 'c_weight', type: 'Number', indexed: true },
          { label: 'heartRate', name: 'c_heart_rate', type: 'Number', indexed: true },
          { label: 'bloodPressure', name: 'c_blood_pressure', type: 'Number', indexed: true },
          { label: 'bodyFatPercentage', name: 'c_body_fat_percentage', type: 'Number', indexed: true },
          { label: 'bodyMassIndex', name: 'c_body_mass_index', type: 'Number', indexed: true },
          { label: 'waistCircumference', name: 'c_waist_circumference', type: 'Number', indexed: true },
          { label: 'doesExercise', name: 'c_does_exercise', type: 'Boolean', indexed: true },
          { label: 'exerciseHours', name: 'c_exercise_hours', type: 'Number', indexed: true },
          { label: 'info',
            name: 'c_info',
            type: 'Document',
            properties: [{
              name: 'c_location',
              label: 'Location',
              type: 'String'
            }, {
              name: 'c_terrain',
              label: 'Terrain',
              type: 'String'
            }] }
        ]
      }).execute()

      org.objects.c_ctxapi_211.insertOne({
        c_name: 'John Smith',
        c_tag: 'BLUE',
        c_id: 1,
        c_age: 36,
        c_height: (Math.random() * 200).toFixed(0),
        c_weight: (Math.random() * 150).toFixed(2),
        c_heart_rate: (Math.random() * 120).toFixed(0),
        c_blood_pressure: (Math.random() * 20).toFixed(2),
        c_body_fat_percentage: (Math.random() * 50).toFixed(0),
        c_body_mass_index: (Math.random() * 40).toFixed(2),
        c_waist_circumference: (Math.random() * 120).toFixed(2),
        c_does_exercise: Math.round(Math.random()) > 0,
        c_exercise_hours: 1,
        c_info: {
          c_location: 'Outside',
          c_terrain: 'Cement'
        }
      }).execute()

      org.objects.c_ctxapi_211.insertOne({
        c_name: 'John Doe',
        c_tag: 'GREEN',
        c_id: 2,
        c_age: 25,
        c_height: (Math.random() * 200).toFixed(0),
        c_weight: (Math.random() * 150).toFixed(2),
        c_heart_rate: (Math.random() * 120).toFixed(0),
        c_blood_pressure: (Math.random() * 20).toFixed(2),
        c_body_fat_percentage: (Math.random() * 50).toFixed(0),
        c_body_mass_index: (Math.random() * 40).toFixed(2),
        c_waist_circumference: (Math.random() * 120).toFixed(2),
        c_does_exercise: Math.round(Math.random()) > 0,
        c_exercise_hours: 2,
        c_info: {
          c_location: 'Beach',
          c_terrain: 'Sand'
        }
      }).execute()

      org.objects.c_ctxapi_211.insertOne({
        c_name: 'John Connor',
        c_tag: 'RED',
        c_id: 3,
        c_age: 40,
        c_height: (Math.random() * 200).toFixed(0),
        c_weight: (Math.random() * 150).toFixed(2),
        c_heart_rate: (Math.random() * 120).toFixed(0),
        c_blood_pressure: (Math.random() * 20).toFixed(2),
        c_body_fat_percentage: (Math.random() * 50).toFixed(0),
        c_body_mass_index: (Math.random() * 40).toFixed(2),
        c_waist_circumference: (Math.random() * 120).toFixed(2),
        c_does_exercise: Math.round(Math.random()) > 0,
        c_exercise_hours: 3,
        c_info: {
          c_location: 'Indoor',
          c_terrain: 'Wood'
        }
      }).execute()

    }))

    it('select all items + added fields', sandboxed(function() {
      require('should')
      /* global org */
      const patients = org.objects.c_ctxapi_211.aggregate([
        {
          $addFields: {
            'name_tag': { $concat: ['c_name', { $literal: ' - ' }, 'c_tag'] }
          }
        }
      ]).toArray()
      patients.length.should.equal(3)
      patients[0].name_tag.should.equal('John Smith - BLUE')
      patients[1].name_tag.should.equal('John Doe - GREEN')
      patients[2].name_tag.should.equal('John Connor - RED')
      // Check if other properties come along
      Object.keys(patients[0]).length.should.be.above(1)

    }))

    it('use $addFields before a $project', sandboxed(function() {
      require('should')
      /* global org, consts */
      const patients = org.objects.c_ctxapi_211.aggregate([
        {
          $addFields: {
            'name_tag': { $concat: ['c_name', { $literal: ' - ' }, 'c_tag'] }
          }
        },
        {
          $project: {
            'name_tag': 1
          }
        }
      ]).toArray()
      patients.length.should.equal(3)
      patients[0].name_tag.should.equal('John Smith - BLUE')
      patients[1].name_tag.should.equal('John Doe - GREEN')
      patients[2].name_tag.should.equal('John Connor - RED')
      // Check if other properties come along
      Object.keys(patients[0]).length.should.be.below(3)

    }))

    it('use $addFields and overwrite property', sandboxed(function() {
      require('should')
      /* global org, consts */
      const patients = org.objects.c_ctxapi_211.aggregate([
        {
          $addFields: {
            'c_name': { $concat: ['c_name', { $literal: ' - ' }, 'c_tag'] }
          }
        }
      ]).toArray()
      patients.length.should.equal(3)
      patients[0].c_name.should.equal('John Smith - BLUE')
      patients[1].c_name.should.equal('John Doe - GREEN')
      patients[2].c_name.should.equal('John Connor - RED')

    }))

    it('use $addFields in between projections', sandboxed(function() {
      require('should')
      /* global org, consts */
      const patients = org.objects.c_ctxapi_211.aggregate([
        {
          $project: {
            'c_name': 1,
            'c_exercise_hours': 1
          }
        },
        {
          $addFields: {
            'exercise_in_minutes': { $multiply: ['c_exercise_hours', 60] }
          }
        },
        {
          $project: {
            c_name: 1,
            exercise_in_minutes: 1
          }
        }
      ]).skipAcl().grant(4).toArray()
      patients.length.should.equal(3)
      patients[0].c_name.should.equal('John Smith')
      patients[1].c_name.should.equal('John Doe')
      patients[2].c_name.should.equal('John Connor')
      patients[0].exercise_in_minutes.should.equal(60)
      patients[1].exercise_in_minutes.should.equal(120)
      patients[2].exercise_in_minutes.should.equal(180)
    }))

    it('check continue projections of Document type', sandboxed(function() {
      require('should')
      /* global org, consts */
      const patients = org.objects.c_ctxapi_211.aggregate([
        {
          $project: {
            'c_info': 1
          }
        },
        {
          $project: {
            'c_info': 1
          }
        }
      ]).skipAcl().grant(4).toArray()
      patients.length.should.equal(3)
      patients[0].c_info.c_location.should.equal('Outside')
      patients[0].c_info.c_terrain.should.equal('Cement')
      patients[1].c_info.c_location.should.equal('Beach')
      patients[1].c_info.c_terrain.should.equal('Sand')
      patients[2].c_info.c_location.should.equal('Indoor')
      patients[2].c_info.c_terrain.should.equal('Wood')
    }))

    it('throw exception when key is a reserved word on $addFields', sandboxed(function() {
      /* global org, consts */
      const { tryCatch } = require('util.values'),
            should = require('should'),
            cursor = org.objects.accounts.aggregate()
              .addFields({
                facets: { $number: 1 }
              })
      tryCatch(function() {
        cursor.toArray()
        should.exist(undefined)
      }, function(err) {
        err.code.should.equal('kInvalidArgument')
      })
    }))

    it('use properties of a projected Document property', sandboxed(function() {
      /* global org, consts */
      require('should')
      /* global org, consts */
      const patients = org.objects.c_ctxapi_211.aggregate()
        .project({
          c_info: 1
        })
        .addFields({
          place: { $concat: ['c_info.c_location', { $string: ' - ' }, 'c_info.c_terrain'] }
        }).toArray()
      patients.length.should.equal(3)
      patients[0].place.should.equal('Outside - Cement')
      patients[1].place.should.equal('Beach - Sand')
      patients[2].place.should.equal('Indoor - Wood')
    }))

    it('use a projected Document property into $addFields', sandboxed(function() {
      /* global org, consts */
      require('should')
      /* global org, consts */
      const patients = org.objects.c_ctxapi_211.aggregate()
        .project({
          'c_info.c_location': 1
        })
        .addFields({
          location: { $concat: ['c_info.c_location', { $string: ' (Location)' }] }
        }).toArray()
      patients.length.should.equal(3)
      patients[0].location.should.equal('Outside (Location)')
      patients[1].location.should.equal('Beach (Location)')
      patients[2].location.should.equal('Indoor (Location)')
    }))

    it('throw error when use a projected Document property that not exists', sandboxed(function() {
      /* global org, consts */
      require('should')
      const { tryCatch } = require('util.values'),
            patients = org.objects.c_ctxapi_211.aggregate()
              .project({
                'c_info.c_location': 1
              })
              .addFields({
                location: { $concat: ['c_info.c_terrain', { $string: ' (Location)' }] }
              })
      tryCatch(function() {
        patients.toArray()
      }, function(err) {
        err.errCode.should.equal('cortex.invalidArgument.query')
        err.reason.should.equal('strict: there are no properties that could match c_info.c_terrain')
      })
    }))

    it('return all fields after a $match', sandboxed(function() {
      /* global org, consts */
      require('should')
      /* global org, consts */
      const patients = org.objects.c_ctxapi_211.aggregate()
        .match({
          'c_age': 36
        })
        .addFields({
          location: { $concat: ['c_info.c_location', { $string: ' (Location)' }] }
        }).toArray()
      patients.length.should.equal(1)
      patients[0].location.should.equal('Outside (Location)')
      Object.keys(patients[0]).length.should.above(2)
    }))

    it('return all projected fields after a $match and $projection', sandboxed(function() {
      /* global org, consts */
      require('should')
      /* global org, consts */
      const patients = org.objects.c_ctxapi_211.aggregate()
        .match({
          'c_age': 36
        })
        .project({
          c_info: 1
        })
        .addFields({
          location: { $concat: ['c_info.c_location', { $string: ' (Location)' }] }
        }).toArray()
      patients.length.should.equal(1)
      patients[0].location.should.equal('Outside (Location)')
      Object.keys(patients[0]).length.should.equal(3)
    }))

    it('use $sort before $addFields', sandboxed(function() {
      require('should')
      /* global org */
      const patients = org.objects.c_ctxapi_211.aggregate([
        {
          $sort: {
            c_name: 1
          }
        },
        {
          $addFields: {
            location: { $concat: ['c_info.c_location', { $string: ' (Location)' }] }
          }
        }
      ]).toArray()
      patients.length.should.equal(3)
      patients[0].c_name.should.equal('John Connor')
    }))

    it('use $group before $addFields', sandboxed(function() {
      require('should')
      /* global org */
      const patients = org.objects.c_ctxapi_211.aggregate([
        {
          $group: {
            _id: null,
            count: {
              '$count': '_id'
            }
          }
        },
        {
          $addFields: {
            location: { $literal: 'testing' }
          }
        }
      ]).toArray()
      patients.length.should.equal(1)
      patients[0].count.should.equal(3)
      patients[0].location.should.equal('testing')
    }))

  })

})
