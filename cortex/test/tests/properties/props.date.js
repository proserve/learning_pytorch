'use strict'

/* global org, consts */

const sandboxed = require('../../lib/sandboxed')

describe('Properties', function() {

  describe('Dates', function() {

    before(sandboxed(function() {

      // noinspection NpmUsedModulesInstalled
      var objects = require('objects'),
          Dates = require('wrapped')('c_dates')

      objects.list('objects', { where: { name: 'c_dates' }, paths: '_id' }).data.forEach(function(object) {
        objects.delete('objects', object._id)
      })

      objects.create('objects', {
        label: 'Dates Test',
        name: 'c_date',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          {
            label: 'Date',
            name: 'c_date_validated_null_ok',
            type: 'Date',
            validators: [{
              name: 'date',
              definition: {
                allowNull: true
              }
            }],
            indexed: true
          },
          {
            label: 'Date',
            name: 'c_date_array',
            type: 'Date',
            array: true,
            indexed: true
          },
          {
            label: 'Date',
            name: 'c_date_validated_min_max',
            type: 'Date',
            validators: [{
              name: 'date',
              definition: {
                allowNull: false,
                min: new Date('2016-01-01'),
                max: new Date('2017-01-01')
              }
            }],
            indexed: true
          },
          {
            label: 'Date',
            name: 'c_dob',
            type: 'Date',
            validators: [{
              name: 'dateOfBirth'
            }],
            indexed: true
          },
          {
            label: 'Date',
            name: 'c_date_only',
            type: 'Date',
            dateOnly: true,
            indexed: true
          },
          {
            label: 'Date',
            name: 'c_date_enum',
            type: 'Date',
            validators: [{
              name: 'dateEnum',
              definition: {
                values: [new Date('2016-01-01T00:00:00.000Z'), new Date('2017-01-01T00:00:00.000Z')]
              }
            }],
            indexed: true
          }
        ]
      })

      Dates.insertOne({
        c_date_validated_null_ok: null,
        c_date_array: [new Date(), new Date(), new Date()],
        c_date_validated_min_max: new Date('2016-11-11T11:11:11.111Z'),
        c_dob: '1975-01-31',
        c_date_only: '1975-01-31',
        c_date_enum: new Date('2016-01-01T00:00:00.000Z')
      })

      Dates.insertOne({
        c_date_validated_null_ok: new Date('2016-01-01T00:00:00.000Z'),
        c_date_array: [new Date('2016-01-01T00:00:00.000Z'), new Date(), new Date()],
        c_date_validated_min_max: new Date('2017-01-01T00:00:00.000Z'),
        c_dob: '2000-01-01',
        c_date_only: '2000-01-01',
        c_date_enum: new Date('2016-01-01T00:00:00.000Z')
      })

    }))

    it('various matcher test cases.', sandboxed(function() {

      require('should')

      const Dates = org.objects.c_dates

      Dates.aggregate()
        .match({
          c_date_validated_null_ok: null
        })
        .toArray()
        .length.should.equal(1)

      Dates.aggregate()
        .match({
          c_date_validated_null_ok: new Date('2016-01-01T00:00:00.000Z')
        })
        .toArray()
        .length.should.equal(1)

      Dates.aggregate()
        .match({
          c_date_array: new Date('2016-01-01T00:00:00.000Z')
        })
        .toArray()
        .length.should.equal(1)

      Dates.aggregate()
        .match({
          c_date_only: '1975-01-31'
        })
        .toArray()
        .length.should.equal(1)

    }))

  })

})
