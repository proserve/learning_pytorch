'use strict'

const server = require('../../lib/server'),
      should = require('should'),
      async = require('async'),
      consts = require('../../../lib/consts'),
      modules = require('../../../lib/modules'),
      _ = require('underscore'),
      acl = require('../../../lib/acl'),
      request = require('request')

server.usingMedia = true

describe('Workers', function() {

  describe('media-processor', function() {

    it('should process media, then be stream-able from aws', function(callback) {

      require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

        should.not.exist(err)

        let localAc

        const text = new modules.storage.FilePointer(null, { path: `${__dirname}/../../files/plain.txt`, mime: 'text/plain' }, instanceAc),
              image = new modules.storage.FilePointer(null, { path: `${__dirname}/../../files/mesh.png`, mime: 'image/png' }, instanceAc)

        async.series([

          // create a new instance and fire up the worker.
          callback => {

            instanceAc.object.aclCreate(server.principals.admin, { c_file: { content: text, c_image: image } }, (err, { ac }) => {
              localAc = ac
              callback(err)
            })

          },

          // poll for state.
          callback => {

            let err, timeoutId = null, done = false

            const doneStage = e => {
              if (e) {
                err = e
              }
              if (timeoutId) {
                clearTimeout(timeoutId)
                timeoutId = null
              }
              if (callback) {
                callback(err)
                callback = null
              }
            }

            timeoutId = setTimeout(() => {
              doneStage(err = new Error('timed out waiting for job to run/complete'))
            }, 10000)

            async.whilst(

              () => !done && !err,

              callback => {

                localAc.object.findOne({ _id: localAc.subjectId }).select('facets.state').lean().exec((err, doc) => {

                  if (!err) {
                    done = _.all(doc.facets, facet => facet.state === consts.media.states.ready)
                    if (_.some(doc.facets, facet => facet.state === consts.media.states.error)) {
                      err = new Error('Some facets had processing errors')
                    }
                  }
                  setTimeout(() => callback(err), 10)

                })
              },

              e => doneStage(err || e)

            )

          },

          // stream c_image and c_gray
          callback => {

            async.parallel([

              callback => {

                server.sessions.admin
                  .get(server.makeEndpoint('/' + localAc.object.pluralName + '/' + localAc.subjectId + '/c_file/c_image'))
                  .set({ 'Accept': 'image/png' })
                  .set(server.getSessionHeaders())
                  .done(function(err, result, response) {
                    should.not.exist(err)
                    should.exist(response.headers.location)
                    request(response.headers.location, (err, response) => {
                      should.not.exist(err)
                      should.equal(response.headers['content-type'], 'image/png')
                      callback()
                    })
                  })

              },

              callback => {

                server.sessions.admin
                  .get(server.makeEndpoint('/' + localAc.object.pluralName + '/' + localAc.subjectId + '/c_file/c_gray'))
                  .set({ 'Accept': 'image/png' })
                  .set(server.getSessionHeaders())
                  .done(function(err, result, response) {
                    should.not.exist(err)
                    should.exist(response.headers.location)
                    request(response.headers.location, (err, response) => {
                      should.not.exist(err)
                      should.equal(response.headers['content-type'], 'image/png')
                      callback()
                    })
                  })
              }

            ], callback)

          }

        ], callback)

      })

    })

  })

})
