'use strict'

/* global before */

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('503 - file upload refresh destroys facet information.', function() {

    before(sandboxed(function() {

      /* global org, consts */

      org.objects.object.insertOne({
        label: 'Issue 503',
        name: 'c_issue_503',
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

    }))

    it('should update content facet and preserve information.', sandboxed(function() {

      require('should')

      let a, b

      const Issue503 = org.objects.c_issue_503

      a = new Issue503(Issue503.insertOne({
        c_file: { content: 'content.jpg', c_other: 'other.jpg' },
        c_file_array: [{ content: 'content0.jpg', c_other: 'other0.jpg' }, { content: 'content1.jpg', c_other: 'other1.jpg' }]
      }).lean(false).execute())

      a.update('c_file/refresh', ['content', 'c_other'])
      a.update(`c_file_array/${a.c_file_array[0]._id}/refresh`, ['content', 'c_other'])

      b = Issue503.find({ _id: a._id }).limit(1).toArray()[0]

      a.c_file.filename.should.equal(b.c_file.filename)
      a.c_file.name.should.equal(b.c_file.name)
      a.c_file.path.should.equal(b.c_file.path)
      a.c_file.state.should.equal(b.c_file.state)
      a.c_file.uploads.find(v => v.name === 'content').fields.find(v => v.key === 'x-amz-signature').value.should.not.equal(b.c_file.uploads.find(v => v.name === 'content').fields.find(v => v.key === 'x-amz-signature').value)

      a.c_file.facets[0].filename.should.equal(b.c_file.facets[0].filename)
      a.c_file.facets[0].name.should.equal(b.c_file.facets[0].name)
      a.c_file.facets[0].path.should.equal(b.c_file.facets[0].path)
      a.c_file.facets[0].state.should.equal(b.c_file.facets[0].state)
      a.c_file.uploads.find(v => v.name === 'c_other').fields.find(v => v.key === 'x-amz-signature').value.should.not.equal(b.c_file.uploads.find(v => v.name === 'c_other').fields.find(v => v.key === 'x-amz-signature').value)

      a.c_file_array[0].filename.should.equal(b.c_file_array[0].filename)
      a.c_file_array[0].name.should.equal(b.c_file_array[0].name)
      a.c_file_array[0].path.should.equal(b.c_file_array[0].path)
      a.c_file_array[0].state.should.equal(b.c_file_array[0].state)
      a.c_file_array[0].uploads.find(v => v.name === 'content').fields.find(v => v.key === 'x-amz-signature').value.should.not.equal(b.c_file_array[0].uploads.find(v => v.name === 'content').fields.find(v => v.key === 'x-amz-signature').value)

      a.c_file_array[0].facets[0].filename.should.equal(b.c_file_array[0].facets[0].filename)
      a.c_file_array[0].facets[0].name.should.equal(b.c_file_array[0].facets[0].name)
      a.c_file_array[0].facets[0].path.should.equal(b.c_file_array[0].facets[0].path)
      a.c_file_array[0].facets[0].state.should.equal(b.c_file_array[0].facets[0].state)
      a.c_file_array[0].uploads.find(v => v.name === 'c_other').fields.find(v => v.key === 'x-amz-signature').value.should.not.equal(b.c_file_array[0].uploads.find(v => v.name === 'c_other').fields.find(v => v.key === 'x-amz-signature').value)

      a.c_file_array[1].filename.should.equal(b.c_file_array[1].filename)
      a.c_file_array[1].name.should.equal(b.c_file_array[1].name)
      a.c_file_array[1].path.should.equal(b.c_file_array[1].path)
      a.c_file_array[1].state.should.equal(b.c_file_array[1].state)
      a.c_file_array[1].uploads.find(v => v.name === 'content').fields.find(v => v.key === 'x-amz-signature').value.should.equal(b.c_file_array[1].uploads.find(v => v.name === 'content').fields.find(v => v.key === 'x-amz-signature').value)

      a.c_file_array[1].facets[0].filename.should.equal(b.c_file_array[1].facets[0].filename)
      a.c_file_array[1].facets[0].name.should.equal(b.c_file_array[1].facets[0].name)
      a.c_file_array[1].facets[0].path.should.equal(b.c_file_array[1].facets[0].path)
      a.c_file_array[1].facets[0].state.should.equal(b.c_file_array[1].facets[0].state)
      a.c_file_array[1].uploads.find(v => v.name === 'c_other').fields.find(v => v.key === 'x-amz-signature').value.should.equal(b.c_file_array[1].uploads.find(v => v.name === 'c_other').fields.find(v => v.key === 'x-amz-signature').value)

    }))

  })

})
