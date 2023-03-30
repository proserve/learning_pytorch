'use strict'

const server = require('../../lib/server'),
      should = require('should'),
      async = require('async'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl')

describe('Workers', function() {

  describe('cascade-deleter', function() {

    it('should cascade delete on parent ref deletion', function(callback) {

      async.waterfall([

        // create the parent
        callback => {
          modules.db.models.object.aclCreate(server.principals.admin, {
            name: 'c_cascade_worker_test_parent',
            label: 'Parent',
            defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }],
            createAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
            shareChain: [acl.AccessLevels.Update, acl.AccessLevels.Share, acl.AccessLevels.Connected]
          }, callback)
        },

        // create the child
        ({ ac, modified }, callback) => {
          modules.db.models.object.aclCreate(server.principals.admin, {
            name: 'c_cascade_worker_test_child',
            label: 'Child',
            defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }],
            createAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
            shareChain: [acl.AccessLevels.Update, acl.AccessLevels.Share, acl.AccessLevels.Connected],
            properties: [{
              label: 'Parent',
              name: 'c_parent',
              type: 'Reference',
              sourceObject: 'c_cascade_worker_test_parent',
              cascadeDelete: true,
              autoCreate: true,
              indexed: true

            }]
          }, callback)
        },

        // create a single child (auto-created parent)
        ({ ac, modified }, callback) => {
          server.org.createObject('c_cascade_worker_test_child', (err, object) => {
            if (err) return callback(err)
            object.aclCreate(server.principals.unverified, {}, callback)
          })

        },

        // delete the parent, triggering the cascade and waiting for the worker to complete.
        ({ ac, modified }, callback) => {

          let timeoutId = null
          const mochaCurrentTestUuid = server.mochaCurrentTestUuid,
                doneStage = err => {
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
          function handler(message, err) {
            if (message.worker === 'cascade-deleter' && message.mochaCurrentTestUuid === mochaCurrentTestUuid) {
              doneStage(err)
            }
          }
          timeoutId = setTimeout(() => {
            doneStage(new Error('timed out waiting for job to run/complete'))
          }, 5000)
          server.events.on('worker.done', handler)

          server.org.createObject('c_cascade_worker_test_parent', (err, object) => {
            if (err) return doneStage(err)
            ac.subject.aclRead(ac, (err, json) => {
              if (err) return doneStage(err)
              object.aclDelete(server.principals.unverified, json.c_parent._id, err => {
                if (err) doneStage(err)
              })
            })
          })

        },

        // ensure both parent and child have been deleted.
        callback => {

          async.parallel([

            callback => {
              server.sessions.unverified.get(server.makeEndpoint('/c_cascade_worker_test_parents')).set(server.getSessionHeaders()).done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.object, 'list')
                should.equal(result.data.length, 0, 'list should be empty')
                callback()
              })
            },

            callback => {
              server.sessions.unverified.get(server.makeEndpoint('/c_cascade_worker_test_children')).set(server.getSessionHeaders()).done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.object, 'list')
                should.equal(result.data.length, 0, 'list should be empty')
                callback()
              })
            }

          ], callback)

        }

      ], err => {
        callback(err)
      })

    })

  })

})
