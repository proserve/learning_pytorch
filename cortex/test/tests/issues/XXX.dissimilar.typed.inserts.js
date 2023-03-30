'use strict'

/* global org, consts */

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('XXX - Typed insertMany', function() {

    it('should succeed with dissimilar types.', sandboxed(function() {

      require('should')

      // create object
      org.objects.Object.insertOne({
        label: 'Dissimilar',
        name: 'c_dissimilar_insert_many_test',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'Name', name: 'c_property', type: 'String' }
        ],
        objectTypes: [
          { label: 'A',
            name: 'c_a',
            properties: [
              { label: 'A', name: 'c_a', type: 'String' },
              { label: 'Value', name: 'c_value', type: 'String', history: true }
            ]
          },
          { label: 'B',
            name: 'c_b',
            properties: [
              { label: 'B', name: 'c_b', type: 'String' },
              { label: 'Value', name: 'c_value', type: 'Document', properties: [{ label: 'Value', name: 'c_value', type: 'String', history: true }] }
            ]
          },
          { label: 'C',
            name: 'c_c',
            properties: [
              { label: 'C', name: 'c_c', type: 'String' },
              { label: 'Value', name: 'c_value', type: 'Date', history: true }
            ]
          }
        ]
      }).execute()

      // test dissimilar insertMany()
      const result = org.objects.c_dissimilar_insert_many_test.insertMany([{
        type: 'c_a',
        c_value: 'value'
      }, {
        // no type set
      }, {
        type: 'c_b',
        c_not_a_prop: null
      }, {
        type: 'c_b',
        c_value: {
          c_value: 'value'
        }
      }, {
        type: 'c_c',
        c_value: new Date()
      }, {
        // no type set
      }]).execute()

      // delete object
      // org.objects.objects.deleteOne({name: 'c_dissimilar_insert_many_test'}).execute()

      result.insertedCount.should.equal(3)
      result.insertedIds[0].index.should.equal(0)
      result.insertedIds[1].index.should.equal(3)
      result.insertedIds[2].index.should.equal(4)
      result.writeErrors[0].index.should.equal(1)
      result.writeErrors[1].index.should.equal(2)
      result.writeErrors[2].index.should.equal(5)
      result.writeErrors[0].errCode.should.equal('cortex.invalidArgument.validation')
      result.writeErrors[0].faults[0].errCode.should.equal('cortex.invalidArgument.required')
      result.writeErrors[0].faults[0].path.should.equal('c_dissimilar_insert_many_test.type')
      result.writeErrors[1].errCode.should.equal('cortex.notFound.property')
      result.writeErrors[1].path.should.equal('c_not_a_prop')
      result.writeErrors[2].errCode.should.equal('cortex.invalidArgument.validation')
      result.writeErrors[2].faults[0].errCode.should.equal('cortex.invalidArgument.required')
      result.writeErrors[2].faults[0].path.should.equal('c_dissimilar_insert_many_test.type')

      return result

    }))

  })

})
