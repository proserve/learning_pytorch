'use strict'

const sandboxed = require('../../lib/sandboxed'),
      cleanInstances = function() {
        const should = require('should')
        org.objects.c_ctxapi_263.deleteMany({}).execute()
        should.equal(org.objects.c_ctxapi_263.find().count(), 0)
      }

describe('Features - fix issue with positon of $limit', function() {

  describe('CTXAPI-263 - querying with $limit in different positions', function() {

    after(sandboxed(cleanInstances))

    before(sandboxed(function() {
      /* global consts */
      org.objects.objects.insertOne({
        label: 'CTXAPI-263',
        name: 'c_ctxapi_263',
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

      org.objects.c_ctxapi_263.insertOne({
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

      org.objects.c_ctxapi_263.insertOne({
        c_name: 'John Doe',
        c_tag: 'GREEN',
        c_id: 2,
        c_age: 36,
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

      org.objects.c_ctxapi_263.insertOne({
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

    it('use $limit before $match with $project', sandboxed(function() {
      require('should')
      /* global org */
      const patients = org.objects.c_ctxapi_263.aggregate([
        {
          $limit: 1
        },
        {
          $match: {
            'c_age': 36
          }
        },
        {
          $project: {
            c_age: 1
          }
        }
      ]).toArray()
      patients.length.should.equal(1)
    }))

    it('use $limit after $match with $project', sandboxed(function() {
      require('should')
      /* global org */
      const patients = org.objects.c_ctxapi_263.aggregate([
        {
          $match: {
            'c_age': 36
          }
        },
        {
          $limit: 1
        },
        {
          $project: {
            c_age: 1
          }
        }
      ]).toArray()
      patients.length.should.equal(1)
    }))

  })

})
