'use strict'

/* global org */

const sandboxed = require('../../lib/sandboxed')

describe('Properties', function() {

  describe('Properties - Unique', function() {

    before(sandboxed(function() {

      // null type.
      org.objects.object.insertOne({
        label: 'Unique 1',
        name: 'c_unique_1',
        properties: [
          { label: 'Prop', name: 'c_prop', type: 'String', indexed: true, unique: true }
        ]
      }).execute()

      // each with a type.
      org.objects.object.insertOne({
        label: 'Unique 2',
        name: 'c_unique_2',
        properties: [
          { label: 'Prop', name: 'c_prop', type: 'String', indexed: true, unique: true }
        ],
        objectTypes: [
          { label: 'One',
            name: 'c_one',
            properties: [
              { label: 'Prop', name: 'c_type_prop', type: 'String', indexed: true, unique: true },
              { label: 'Prop', name: 'c_another_type_prop', type: 'String', indexed: true, unique: true }
            ]
          },
          { label: 'Two',
            name: 'c_two',
            properties: [
              { label: 'Prop', name: 'c_type_prop', type: 'String', indexed: true, unique: true },
              { label: 'Prop', name: 'c_another_type_prop', type: 'Number', indexed: true, unique: true }
            ]
          }
        ]
      }).execute()

    }))

    it('uniqueness should function across objects and types.', sandboxed(function() {

      let cursor

      require('should')

      while ((cursor = org.objects.c_unique_1.find().limit(1).skipAcl().grant(8)).hasNext()) {
        new org.objects.c_unique_1(cursor.next()).delete({ grant: 8 })
      }
      while ((cursor = org.objects.c_unique_2.find().limit(1).skipAcl().grant(8)).hasNext()) {
        new org.objects.c_unique_2(cursor.next()).delete({ grant: 8 })
      }

      function shouldFailUnique(fn) {
        try {
          fn()
        } catch (err) {
          if (err.code === 'kValidationError' && err.faults && err.faults[0] && err.faults[0].code === 'kDuplicateKey') {
            return
          }
          throw err
        }
        throw new Error('blacklistedPort should cause an error.')
      }

      // ---------------------

      org.objects.c_unique_1.insertOne({
        c_prop: 'unique'
      }).bypassCreateAcl().grant(8).execute()

      org.objects.c_unique_1.insertOne({
        c_prop: 'singular'
      }).bypassCreateAcl().grant(8).execute()

      shouldFailUnique(() => {
        org.objects.c_unique_1.insertOne({
          c_prop: 'unique'
        }).bypassCreateAcl().grant(8).execute()
      })

      // ---------------------

      org.objects.c_unique_2.insertOne({
        type: 'c_one',
        c_prop: 'unique'
      }).bypassCreateAcl().grant(8).execute()

      org.objects.c_unique_2.insertOne({
        type: 'c_two',
        c_prop: 'singular'
      }).bypassCreateAcl().grant(8).execute()

      shouldFailUnique(() => {
        org.objects.c_unique_2.insertOne({
          type: 'c_one',
          c_prop: 'unique'
        }).bypassCreateAcl().grant(8).execute()
      })

      shouldFailUnique(() => {
        org.objects.c_unique_2.insertOne({
          type: 'c_two',
          c_prop: 'unique'
        }).bypassCreateAcl().grant(8).execute()
      })

      // ---------------------

      org.objects.c_unique_2.insertOne({
        type: 'c_one',
        c_type_prop: 'unique'
      }).bypassCreateAcl().grant(8).execute()

      org.objects.c_unique_2.insertOne({
        type: 'c_one',
        c_type_prop: 'singular'
      }).bypassCreateAcl().grant(8).execute()

      org.objects.c_unique_2.insertOne({
        type: 'c_two',
        c_type_prop: 'unique'
      }).bypassCreateAcl().grant(8).execute()

      org.objects.c_unique_2.insertOne({
        type: 'c_two',
        c_type_prop: 'singular'
      }).bypassCreateAcl().grant(8).execute()

      shouldFailUnique(() => {
        org.objects.c_unique_2.insertOne({
          type: 'c_one',
          c_type_prop: 'unique'
        }).bypassCreateAcl().grant(8).execute()
      })

      shouldFailUnique(() => {
        org.objects.c_unique_2.insertOne({
          type: 'c_two',
          c_type_prop: 'singular'
        }).bypassCreateAcl().grant(8).execute()
      })

      shouldFailUnique(() => {
        org.objects.c_unique_2.insertOne({
          type: 'c_one',
          c_type_prop: 'unique'
        }).bypassCreateAcl().grant(8).execute()
      })

      shouldFailUnique(() => {
        org.objects.c_unique_2.insertOne({
          type: 'c_two',
          c_type_prop: 'singular'
        }).bypassCreateAcl().grant(8).execute()
      })

      org.objects.c_unique_1.find({ c_prop: 'unique' }).skipAcl().grant(8).count().should.equal(1)
      org.objects.c_unique_2.find({ type: 'c_one', c_type_prop: 'unique' }).skipAcl().grant(8).count().should.equal(1)
      org.objects.c_unique_2.find({ type: 'c_two', c_type_prop: 'unique' }).skipAcl().grant(8).count().should.equal(1)
      org.objects.c_unique_2.find({ type: { $in: ['c_one', 'c_two'] }, c_type_prop: 'unique' }).skipAcl().grant(8).count().should.equal(2)
      org.objects.c_unique_2.find({ c_type_prop: 'unique' }).skipAcl().grant(8).count().should.equal(2)
      org.objects.c_unique_2.find({ c_type_prop: 'singular' }).skipAcl().grant(8).count().should.equal(2)

    }))

  })

})
