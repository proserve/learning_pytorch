'use strict'

const server = require('../../lib/server'),
      async = require('async'),
      consts = require('../../../lib/consts'),
      _ = require('underscore'),
      sandboxed = require('../../lib/sandboxed')

function waitForUploads(objectName, callback) {

  server.org.createObject(objectName, function(err, Issue517) {

    if (err) {
      return callback(err)
    }

    let timeoutId = null, done = false

    const doneStage = _.once(e => {
      if (e) {
        err = e
      }
      clearTimeout(timeoutId)
      callback(err)
    })

    timeoutId = setTimeout(() => {
      doneStage(err = new Error('timed out waiting for media processing'))
    }, 10000)

    async.whilst(
      () => !done && !err,
      callback => {
        Issue517.find({ object: objectName, reap: false }).select('facets.state').lean().exec((err, docs) => {
          if (!err) {
            done = _.all(docs, doc => _.all(doc.facets, facet => facet.state === consts.media.states.ready))
            if (_.some(docs, doc => _.some(doc.facets, facet => facet.state === consts.media.states.error))) {
              err = new Error('Some facets had processing errors')
            }
          }
          setTimeout(() => callback(err), 10)
        })
      },
      e => doneStage(err || e)
    )
  })

}

describe('Issues', function() {

  describe('517 - Facets should be allowed as file upload sources.', function() {

    before(sandboxed(function() {

      /* global org */

      const Issue517 = org.objects.c_issue_517

      // the roles will not be part of the script consts in this run.
      org.objects.object.insertOne({
        label: 'Issue 517',
        name: 'c_issue_517',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [{
          label: 'file',
          name: 'c_file',
          type: 'File',
          processors: [{
            allowUpload: true,
            label: 'Content',
            maxFileSize: 10000000,
            mimes: ['*'],
            name: 'content',
            passMimes: false,
            private: false,
            required: true,
            source: 'content',
            type: 'passthru'
          }, {
            allowUpload: true,
            label: 'Other',
            maxFileSize: 10000000,
            mimes: ['*'],
            name: 'c_other',
            passMimes: false,
            private: false,
            required: false,
            source: 'c_other',
            type: 'passthru'
          }]
        }, {
          label: 'file array',
          name: 'c_file_array',
          type: 'File',
          array: true,
          processors: [{
            allowUpload: true,
            label: 'Content',
            maxFileSize: 10000000,
            mimes: ['*'],
            name: 'content',
            passMimes: false,
            private: false,
            required: true,
            source: 'content',
            type: 'passthru'
          }, {
            allowUpload: true,
            label: 'Other',
            maxFileSize: 10000000,
            mimes: ['*'],
            name: 'c_other',
            passMimes: false,
            private: false,
            required: false,
            source: 'c_other',
            type: 'passthru'
          }]
        }]
      }).execute()

      Issue517.insertOne({
        c_file: { content: { buffer: new Buffer('1'), filename: 'thing.txt' }, c_other: new Buffer('2') }, // eslint-disable-line node/no-deprecated-api
        c_file_array: [{ content: new Buffer('2a'), c_other: new Buffer('2b') }, { content: new Buffer('3a'), c_other: new Buffer('3b') }] // eslint-disable-line node/no-deprecated-api
      }).execute()

    }))

    it('should complete media processing successfully', function(callback) {

      waitForUploads('c_issue_517', callback)

    })

    it('should allow facets to be used as sources', sandboxed(function() {

      const Issue517 = org.objects.c_issue_517,
            { c_file: file } = Issue517.find().next()

      Issue517.insertOne({
        c_file: {
          content: `facet://${file.path}`,
          c_other: `facet://${file.facets.find(f => f.name === 'c_other').path}`
        }
      }).execute()

      Issue517.insertOne({
        c_file: {
          content: {
            source: 'facet',
            filename: 'new filename.txt',
            path: file.path
          }
        }
      }).execute()

    }))

    it('should complete media processing successfully', function(callback) {

      waitForUploads('c_issue_517', callback)
    })

  })

})
