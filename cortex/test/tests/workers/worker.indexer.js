'use strict'

const server = require('../../lib/server'),
      should = require('should'),
      async = require('async'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl')

describe('Workers', function() {

  describe('indexer', function() {

    it('job should run and property should be indexed.', function(callback) {

      // index an unindexed property, ensure the worker runs and that we can search for it afterwords.
      require('../../lib/create.custom')(new acl.AccessContext(server.principals.admin), (err, instanceAc, objectAc) => {

        should.not.exist(err)

        async.series([

          // index the property, which will fire up the worker.
          callback => {

            let propertyId, timeoutId = null
            const mochaCurrentTestUuid = server.mochaCurrentTestUuid,
                  doneTest = err => {
                    if (timeoutId) {
                      clearTimeout(timeoutId)
                      timeoutId = null
                    }
                    server.events.removeListener('worker.done', handler)
                    if (callback) {
                      callback(err)
                      callback = null
                    }
                  }
            function handler(message, err, result) {
              if (message.mochaCurrentTestUuid === mochaCurrentTestUuid) {
                doneTest(err)
              }
            }
            timeoutId = setTimeout(() => {
              doneTest(new Error('timed out waiting for job to run/complete'))
            }, 5000)
            server.events.on('worker.done', handler)

            // update the object
            propertyId = instanceAc.object.schema.node.findNode('c_unindexed')._id

            // switch quickly to try and trigger the restart
            modules.db.models.object.aclUpdatePath(server.principals.admin, objectAc.subjectId, 'properties.' + propertyId + '.indexed', true, { method: 'put' }, err => {
              if (err) {
                doneTest(err)
              }
            })
          },

          // reload the org so we pick up the object changes on the back-end
          callback => {
            server.updateOrg(callback)
          },

          // ensure we can find it.
          callback => {

            server.sessions.admin
              .get(server.makeEndpoint('/' + instanceAc.object.pluralName + '?where={"c_unindexed": "woe is me"}'))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                should.not.exist(err)
                should.equal(result.data.length, 1)
                should.equal(result.data[0]._id, instanceAc.subjectId.toString())
                callback()
              })

          }

        ], callback)

      })

    })

  })

})
