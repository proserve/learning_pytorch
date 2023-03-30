'use strict'

/* global org, script, consts */

const sandboxed = require('../../lib/sandboxed')

describe('Parser', function() {

  describe('Stages', function() {

    before(sandboxed(function() {

      org.objects.Object.insertOne({
        label: 'Parser Stages Skip',
        name: 'c_parser_stages_skip',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'Name', name: 'c_array', type: 'String', indexed: true, array: true },
          { label: 'Name', name: 'c_name', type: 'String', indexed: true },
          { label: 'Doc',
            name: 'c_doc',
            type: 'Document',
            array: false,
            properties: [
              { label: 'Creator', name: 'c_creator', type: 'Reference', indexed: true, sourceObject: 'account', expandable: true }
            ]
          },
          { label: 'Set',
            name: 'c_set',
            type: 'Set',
            indexed: true,
            documents: [
              { label: 'A', name: 'c_a', properties: [{ label: 'Value from A', name: 'c_value', type: 'String', indexed: true }] },
              { label: 'B', name: 'c_b', properties: [{ label: 'Value from B', name: 'c_value', type: 'Number', array: true, indexed: true }] },
              { label: 'C', name: 'c_c', properties: [{ label: 'Value from C', name: 'c_value', type: 'Any' }] }
            ]
          }
        ],
        objectTypes: [
          { label: 'Dog',
            name: 'c_dog',
            properties: [
              { label: 'Barks', name: 'c_barks', type: 'Boolean', indexed: true },
              { label: 'Set',
                name: 'c_dog_set',
                type: 'Set',
                indexed: true,
                minItems: 1,
                documents: [
                  { label: 'A', name: 'c_a', properties: [{ label: 'A', name: 'c_a', type: 'Boolean', validators: [{ name: 'required' }] }] }
                ]
              },
              { label: 'Set',
                name: 'c_shared_set',
                type: 'Set',
                indexed: true,
                minItems: 0,
                documents: [
                  { label: 'A',
                    name: 'c_a',
                    properties: [
                      { label: 'Value from A', name: 'c_value', type: 'String', indexed: true }
                    ]
                  },
                  { label: 'B',
                    name: 'c_b',
                    properties: [
                      { label: 'Value from B', name: 'c_value', type: 'Date', indexed: true }
                    ]
                  }
                ]
              }
            ]
          },
          { label: 'Cat',
            name: 'c_cat',
            properties: [
              { label: 'Meows', name: 'c_meows', type: 'Boolean', indexed: true, validators: [{ name: 'required' }] },
              { label: 'Set',
                name: 'c_shared_set',
                type: 'Set',
                indexed: true,
                minItems: 0,
                documents: [
                  { label: 'A',
                    name: 'c_a',
                    properties: [
                      { label: 'Value from A', name: 'c_value', type: 'String', indexed: true }
                    ]
                  },
                  { label: 'B',
                    name: 'c_b',
                    properties: [
                      { label: 'Value from B', name: 'c_value', type: 'Date', indexed: true }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }).execute()

      var Obj = org.objects.c_parser_stages_skip

      // create some pets
      Obj.insertOne({
        type: 'c_cat',
        c_meows: false,
        c_array: ['foo', 'bar'],
        c_doc: { c_creator: { _id: script.principal._id } },
        c_set: [{ name: 'c_a', c_value: '2' }, { name: 'c_b', c_value: [1, 2, 3] }, { name: 'c_a', c_value: '' }]
      }).execute()
      Obj.insertOne({
        type: 'c_cat',
        c_meows: true,
        c_array: ['bat', 'baz'],
        c_doc: { c_creator: { _id: script.principal._id } },
        c_set: [{ name: 'c_a', c_value: '2' }, { name: 'c_b', c_value: [1, 2, 3] }, { name: 'c_a', c_value: '' }]
      }).execute()
      Obj.insertOne({
        type: 'c_cat',
        c_meows: true,
        c_doc: { c_creator: { _id: script.principal._id } },
        c_set: [{ name: 'c_a', c_value: '2' }, { name: 'c_b', c_value: [1, 2, 3] }, { name: 'c_a', c_value: '' }]
      }).execute()
      Obj.insertOne({
        type: 'c_dog',
        c_barks: true,
        c_doc: { c_creator: { _id: script.principal._id } },
        c_set: [{ name: 'c_b', c_value: [1, 2, 3, 4, 5] }],
        c_dog_set: [{ name: 'c_a', c_a: true }],
        c_shared_set: [{ name: 'c_a', c_value: 'woof woof' }, { name: 'c_b', c_value: new Date() }]
      }).execute()
      Obj.insertOne({
        type: 'c_dog',
        c_barks: false,
        c_doc: { c_creator: { _id: script.principal._id } },
        c_set: [{ name: 'c_b', c_value: [6, 7, 8, 9] }, { name: 'c_c', c_value: { 'this': { is: 'it' } } }],
        c_dog_set: [{ name: 'c_a', c_a: false }],
        c_shared_set: [{ name: 'c_a', c_value: 'moew meow' }, { name: 'c_b', c_value: new Date() }]
      }).execute()

    }))

    describe('Skip - Aggregation', function() {

      before(function() {

      })

      it('should detect invalid input cases', sandboxed(function() {

        var Obj = org.objects.c_parser_stages_skip

        function failAt(message, fn) {
          try {
            fn()
          } catch (e) {
            return true
          }
          throw new Error(message)
        }

        failAt('should fail to parse an invalid string expression', () => {
          return Obj.aggregate().skip('{a": 1}').toArray().length
        })

        failAt('aggregate should require an integer', () => {
          return Obj.aggregate().skip('yo').toArray().length
        })

        failAt('aggregate should require an integer', () => {
          return Obj.aggregate().skip('false').toArray().length
        })

        failAt('aggregate should require an integer', () => {
          return Obj.aggregate().skip(true).toArray().length
        })

        failAt('aggregate should require an integer', () => {
          return Obj.aggregate().skip().toArray().length
        })

        failAt('aggregate should be >= 0', () => {
          return Obj.aggregate().skip(-1).toArray().length
        })

        failAt('aggregate should be <= max', () => {
          return Obj.aggregate().skip(500001).toArray().length
        })
      }))

      it('should succeed at various valid skip cases', sandboxed(function() {

        require('should')
        var Obj = org.objects.c_parser_stages_skip

        Obj.aggregate().skip(1).skip(1).toArray().length.should.equal(3)
        Obj.aggregate().skip(1).toArray().length.should.equal(4)
        Obj.aggregate().skip(1000).toArray().length.should.equal(0)

      }))

    })

    describe('Skip - Find', function() {

      before(function() {

      })

      it('should detect invalid input cases', sandboxed(function() {

        var Obj = org.objects.c_parser_stages_skip

        function failAt(message, fn) {
          try {
            fn()
          } catch (e) {
            return true
          }
          throw new Error(message)
        }

        failAt('should fail to parse an invalid string expression', () => {
          return Obj.find().skip('{a": 1}').toArray().length
        })

        failAt('aggregate should require an integer', () => {
          return Obj.find().skip('yo').toArray().length
        })

        failAt('aggregate should require an integer', () => {
          return Obj.find().skip('false').toArray().length
        })

        failAt('aggregate should require an integer', () => {
          return Obj.find().skip(true).toArray().length
        })

        failAt('aggregate should require an integer', () => {
          return Obj.find().skip().toArray().length
        })

        failAt('aggregate should be >= 0', () => {
          return Obj.find().skip(-1).toArray().length
        })

        failAt('aggregate should be <= max', () => {
          return Obj.find().skip(500001).toArray().length
        })
      }))

      it('should succeed at various valid skip cases', sandboxed(function() {

        require('should')
        var Obj = org.objects.c_parser_stages_skip

        Obj.find().skip(1).skip(2).toArray().length.should.equal(3) // find overwrites.
        Obj.find().skip(1).toArray().length.should.equal(4)
        Obj.find().skip(1000).toArray().length.should.equal(0)

      }))

    })

  })

})
