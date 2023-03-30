'use strict'

/* global org, consts, script */

const sandboxed = require('../../lib/sandboxed')

describe('Properties', function() {

  describe('Properties - History', function() {

    it('create object with history, insert then update some items and show correct history', sandboxed(function() {

      require('should')

      const async = require('async'),
            tryCatch = require('util.values').tryCatch

      async.series([

        callback => tryCatch(() => org.objects.object.deleteMany({ name: 'c_dissimilar_types_history_test' }).execute(), callback, true),

        callback => setTimeout(() => {

          tryCatch(() => org.objects.object.insertOne({
            label: 'Dissimilar',
            name: 'c_dissimilar_types_history_test',
            defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
            createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
            properties: [
              {
                label: 'Name', name: 'c_property', type: 'String'
              }
            ],
            objectTypes: [
              {
                label: 'A',
                name: 'c_a',
                properties: [
                  { label: 'Value', name: 'c_value', type: 'String', history: true }
                ]
              },
              {
                label: 'B',
                name: 'c_b',
                properties: [
                  { label: 'Value', name: 'c_value', type: 'Document', properties: [{ label: 'Value', name: 'c_value', type: 'String', history: true }] }
                ]
              },
              {
                label: 'C',
                name: 'c_c',
                properties: [
                  { label: 'Value', name: 'c_value', type: 'Date', history: true }
                ]
              }
            ]
          }).execute()
          , callback)

        }, 2000),

        callback => {

          org.objects.c_dissimilar_types_history_test.insertMany([{
            type: 'c_a',
            c_value: 'value'
          }, {
            type: 'c_b',
            c_value: {
              c_value: 'value'
            }
          }, {
            type: 'c_c',
            c_value: new Date()
          }]).execute()

          async.times(
            5,
            (n, callback) => {
              const updates = org.objects.c_dissimilar_types_history_test.updateMany({ type: { $in: ['c_a', 'c_c'] } }, { $set: { audit: { message: `n: ${n}` }, c_value: new Date(n * 86400000) } }).execute()
              setTimeout(() => callback(null, updates), 1)
            }
            ,
            callback
          )

        },

        callback => {
          setTimeout(callback, 2000)
        },

        callback => {

          const doc = org.objects.c_dissimilar_types_history_test.find().sort({ _id: 1 }).limit(1).include('audit.history').next(),
                list = org.objects.c_dissimilar_types_history_test.find().pathPrefix(`${doc._id}.audit.history`).skip(1).limit(4).toList()

          list.data.length.should.equal(4)
          list.hasMore.should.equal(true)
          list.data[0].message.should.equal('n: 3')
          list.data[0].c_value.should.equal('Sat Jan 03 1970 16:00:00 GMT-0800 (Pacific Standard Time)')

          callback(null, list)
        }

      ], (err, result) => script.exit(err || result.pop()))

    }))

  })

})
