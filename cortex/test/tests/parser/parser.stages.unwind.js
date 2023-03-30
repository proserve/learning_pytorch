'use strict'

/* global org, script, consts */

const sandboxed = require('../../lib/sandboxed')

describe('Parser', function() {

  describe('Stages', function() {

    describe('Unwind', function() {

      before(sandboxed(function() {

        org.objects.Object.insertOne({
          label: 'Parser Stages Unwind',
          name: 'c_parser_stages_unwind',
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

        var Obj = org.objects.c_parser_stages_unwind

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

      it('should detect invalid input cases', sandboxed(function() {

        var Obj = org.objects.c_parser_stages_unwind

        function failAt(message, fn) {
          try {
            fn()
          } catch (e) {
            return true
          }
          throw new Error(message)
        }

        failAt('unwind must be a string or object with the path property', () => {
          Obj.aggregate().unwind({ thing: 'c_array' }).toList()
        })

        failAt('unwind must be a valid property name', () => {
          Obj.aggregate().unwind({ path: '$bad' }).toList()
        })

        failAt('unwound path must exist', () => {
          Obj.aggregate().unwind({ path: 'c_not_a_property' }).toList()
        })

        failAt('unwound path must be an array property', () => {
          Obj.aggregate().unwind({ path: 'c_not_a_property' }).toList()
        })

        failAt('unwound path cannot be a virtual', () => {
          Obj.aggregate().unwind('shared').toList()
        })

        failAt('unwound path cannot be a virtual', () => {
          Obj.aggregate().unwind('shared').toList()
        })

        failAt('unwound path cannot be a virtual', () => {
          Obj.aggregate().unwind('posts').toList()
        })

      }))

      it('should succeed at various valid unwind cases', sandboxed(function() {

        require('should')
        var Obj = org.objects.c_parser_stages_unwind
        Obj.aggregate().unwind('c_set').unwind('c_set.c_value').toArray().length.should.equal(25)
        Obj.aggregate().unwind('c_array').toArray().length.should.equal(4)
        Obj.aggregate().unwind('_id').toArray().length.should.equal(5)
        Obj.aggregate().unwind('c_array').unwind('c_set').unwind('c_set.c_value').toArray().length.should.equal(20)

      }))

    })

  })

})
