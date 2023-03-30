'use strict'

/* global org, consts */

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('XXX - Typed indexing', function() {

    it('should succeed with typed indexes.', sandboxed(function() {

      org.objects.Object.insertOne({
        label: 'Dissimilar',
        name: 'c_dissimilar_indexing_test',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'Name', name: 'c_property', type: 'String' }
        ],
        objectTypes: [
          { label: 'A',
            name: 'c_a',
            properties: [
              { label: 'A', name: 'c_a', type: 'String' } // this will be indexed.
            ]
          },
          { label: 'B',
            name: 'c_b',
            properties: [
              { label: 'B', name: 'c_a', type: 'Number' }
            ]
          }
        ]
      }).execute()

      org.objects.c_dissimilar_indexing_test.insertMany([{
        type: 'c_a',
        c_a: '123'
      }, {
        type: 'c_a',
        c_a: '456'
      }, {
        type: 'c_b',
        c_a: 123
      }]).execute()

      var typeA = null,
          typeB = null,
          propA = org.objects.Object
            .find({ name: 'c_dissimilar_indexing_test' })
            .next()
            .objectTypes.find(v => v.name === 'c_a' && (typeA = v._id))
            .properties.find(v => v.name === 'c_a')._id,
          propB = org.objects.Object
            .find({ name: 'c_dissimilar_indexing_test' })
            .next()
            .objectTypes.find(v => v.name === 'c_b' && (typeB = v._id))
            .properties.find(v => v.name === 'c_a')._id

      org.objects.Object.updateOne({ name: 'c_dissimilar_indexing_test' }, { $set: {
        objectTypes: [{
          _id: typeA,
          properties: [{ _id: propA, indexed: true }]
        }, {
          _id: typeB,
          properties: [{ _id: propB, indexed: true }]
        }]
      } }).execute()

      // wait for indexer
      setTimeout(() => {
        require('should')
        const count = org.objects.c_dissimilar_indexing_test.find({ c_a: 123 }).count()
        count.should.equal(2)
      }, 2000)

    }))

  })

})
