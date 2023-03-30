'use strict'

/* eslint-disable node/no-deprecated-api */

/* global before */

/* global org */

const server = require('../../lib/server'),
      async = require('async'),
      consts = require('../../../lib/consts'),
      _ = require('underscore'),
      sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('320 - File reads should remain consistent in pipelines and queries.', function() {

    before(sandboxed(function() {

      /* global org */

      const Issue320 = org.objects.c_issue_320

      // the roles will not be part of the script consts in this run.
      org.objects.object.insertOne({
        label: 'Issue 320',
        name: 'c_issue_320',
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

      Issue320.insertOne({
        c_file: { content: new Buffer('1'), c_other: new Buffer('2') },
        c_file_array: [{ content: new Buffer('2a'), c_other: new Buffer('2b') }, { content: new Buffer('3a'), c_other: new Buffer('3b') }]
      }).execute()

    }))

    it('should complete media processing successfully', function(callback) {

      server.org.createObject('c_issue_320', function(err, Issue320) {

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
            Issue320.find({ object: 'c_issue_320', reap: false }).select('facets.state').lean().exec((err, docs) => {
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

    })

    it('should read files identically.', sandboxed(function() {

      const should = require('should'),
            Issue320 = org.objects.c_issue_320,
            { c_file: file, c_file_array: fileArray } = Issue320.find().next(),
            { c_file1: file1, c_file_array1: fileArray1 } = Issue320.aggregate().project({ c_file1: 'c_file', c_file_array1: 'c_file_array' }).next()

      should.equal(JSON.stringify([file, fileArray]), JSON.stringify([file1, fileArray1]))

    }))

  })

})
