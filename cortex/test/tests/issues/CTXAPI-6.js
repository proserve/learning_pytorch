'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('CTXAPI-6 - Property reaper deletes all data in sibling doc array properties.', function() {

    it('indexer should only update selected properties', sandboxed(function() {

      /* global org, consts, script */

      require('should')

      const Model = org.objects.c_ctxapi_6

      org.objects.Object.insertOne({
        label: Model.name,
        name: Model.name,
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'c_a', name: 'c_a', type: 'String', indexed: true },
          { label: 'c_b',
            name: 'c_b',
            type: 'Document',
            array: true,
            properties: [{ label: 'StringA', name: 'c_string_a', type: 'String', indexed: true }, { label: 'StringB', name: 'c_string_b', type: 'String' }]
          }
        ]
      }).execute()

      Model.insertMany([
        { c_a: 'test', c_b: [{ c_string_a: '1', c_string_b: '2' }] },
        { c_a: 'test1', c_b: [{ c_string_a: '3', c_string_b: '4' }] }
      ]).execute()

      try {
        org.objects.objects
          .updateOne(
            { name: 'c_ctxapi_6' },
            { $remove: [
              org.objects.objects.find({ name: 'c_ctxapi_6' }).next().properties.find(p => p.name === 'c_a')._id
            ] }
          )
          .pathPrefix('properties')
          .execute()
      } catch (err) {}

      setTimeout(
        () => {
          Model.find().toArray()[0].c_b.length.should.equal(1)
          script.exit(true)
        },
        2000
      )

    }))

  })

})
