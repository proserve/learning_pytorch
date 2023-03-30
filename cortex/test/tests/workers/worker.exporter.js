'use strict'

const server = require('../../lib/server'),
      should = require('should'),
      async = require('async'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl')

server.usingMedia = true

describe('Workers', function() {

  describe('exporter', function() {

    it('should export application/json', function(callback) {

      require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc, objectAc) => {

        should.not.exist(err)

        let localAc

        async.series([

          callback => {

            let payload, timeoutId = null

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

            function handler(message, err, result) {
              if (message.worker === 'exporter' && message.mochaCurrentTestUuid === mochaCurrentTestUuid) {
                doneStage(err)
              }
            }

            timeoutId = setTimeout(() => {
              doneStage(new Error('timed out waiting for job to run/complete'))
            }, 15000)
            server.events.on('worker.done', handler)

            payload = {
              label: 'Test Export',
              exportFiles: true,
              format: 'application/json',
              objects: instanceAc.object.pluralName
            }

            // create the export specification, which will trigger the exporter to begin.
            modules.db.models.export.aclCreate(server.principals.admin, payload, { method: 'post' }, (err, { ac }) => {
              localAc = ac
              if (err) {
                doneStage(err)
              }
            })
          },

          // ensure we can find the upload and it has at least 1 document.
          callback => {

            server.sessions.admin
              .get(server.makeEndpoint('/exports/' + localAc.subjectId + '?include=files'))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                should.not.exist(err)
                should.equal(result.state, 'ready')
                should.equal(result.dataFile.state, 2)
                should.equal(result.stats.docs.count > 0, true, 'expects at least 1 document')
                should.equal(result.stats.files.count > 0, true, 'expects at least 1 file')
                callback()
              })
          }

        ], callback)

      })

    })

    it('should export application/x-ndjson', function(callback) {

      require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc, objectAc) => {

        should.not.exist(err)

        let localAc

        async.series([

          callback => {

            let payload, timeoutId = null

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
            function handler(message, err, result) {
              if (message.worker === 'exporter' && message.mochaCurrentTestUuid === mochaCurrentTestUuid) {
                doneStage(err)
              }
            }
            timeoutId = setTimeout(() => {
              doneStage(new Error('timed out waiting for job to run/complete'))
            }, 15000)
            server.events.on('worker.done', handler)

            payload = {
              label: 'Test Export',
              exportFiles: true,
              format: 'application/x-ndjson',
              objects: instanceAc.object.pluralName
            }

            // create the export specification, which will trigger the exporter to begin.
            modules.db.models.export.aclCreate(server.principals.admin, payload, { method: 'post' }, (err, { ac }) => {
              localAc = ac
              if (err) {
                doneStage(err)
              }
            })
          },

          // ensure we can find the upload and it has at least 1 document.
          callback => {

            server.sessions.admin
              .get(server.makeEndpoint('/exports/' + localAc.subjectId + '?include=files'))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                should.not.exist(err)
                should.equal(result.state, 'ready')
                should.equal(result.dataFile.state, 2)
                should.equal(result.stats.docs.count > 0, true, 'expects at least 1 document')
                should.equal(result.stats.files.count > 0, true, 'expects at least 1 file')
                callback()
              })
          }

        ], callback)

      })

    })

    it('should export text/csv', function(callback) {

      require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc, objectAc) => {

        should.not.exist(err)

        let localAc

        async.series([

          callback => {

            let payload, timeoutId = null

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
            function handler(message, err, result) {
              if (message.worker === 'exporter' && message.mochaCurrentTestUuid === mochaCurrentTestUuid) {
                doneStage(err)
              }
            }
            timeoutId = setTimeout(() => {
              doneStage(new Error('timed out waiting for job to run/complete'))
            }, 15000)
            server.events.on('worker.done', handler)

            payload = {
              label: 'Test Export',
              exportFiles: true,
              format: 'text/csv',
              paths: ['c_file', 'c_label'],
              objects: instanceAc.object.pluralName
            }

            // create the export specification, which will trigger the exporter to begin.
            modules.db.models.export.aclCreate(server.principals.admin, payload, { method: 'post' }, (err, { ac }) => {
              localAc = ac
              if (err) {
                doneStage(err)
              }
            })
          },

          // ensure we can find the upload and it has at least 1 document.
          callback => {

            server.sessions.admin
              .get(server.makeEndpoint('/exports/' + localAc.subjectId + '?include=files'))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                should.not.exist(err)
                should.equal(result.state, 'ready')
                should.equal(result.dataFile.state, 2)
                should.equal(result.stats.docs.count > 0, true, 'expects at least 1 document')
                should.equal(result.stats.files.count > 0, true, 'expects at least 1 file')
                callback()
              })
          }

        ], callback)

      })

    })
  })

})
