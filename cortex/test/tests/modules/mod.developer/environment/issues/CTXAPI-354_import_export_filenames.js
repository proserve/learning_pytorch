'use strict'

/* global before, after */

const { sandboxed } = require('../setup')

describe('Modules.Developer - CTXAPI-354 - adding filenames to facets exports', function() {

  before(sandboxed(function() {

    const { import: importEnvironment } = require('developer').environment
    importEnvironment([
      {
        'object': 'manifest',
        'objects': [
          {
            'includes': [
              '*'
            ],
            'name': 'c_test_file'
          }
        ]
      },
      { 'allowConnections': true, 'auditing': { 'enabled': false }, 'canCascadeDelete': false, 'connectionOptions': { 'requireAccept': true, 'requiredAccess': 5, 'sendNotifications': true }, 'createAcl': ['account.public'], 'defaultAcl': ['owner.delete'], 'favorite': false, 'hasETag': false, 'isDeletable': true, 'isUnmanaged': false, 'isVersioned': false, 'label': 'c_test_file', 'name': 'c_test_file', 'object': 'object', 'objectTypes': [], 'properties': [{ 'acl': [], 'aclOverride': false, 'array': false, 'auditable': false, 'canPull': true, 'canPush': true, 'creatable': false, 'history': false, 'label': 'c_file', 'maxItems': 100, 'maxShift': false, 'minItems': 0, 'name': 'c_file', 'optional': false, 'processors': [{ 'allowUpload': true, 'label': 'Content', 'maxFileSize': 10000000, 'mimes': ['*'], 'name': 'content', 'passMimes': false, 'private': false, 'required': true, 'source': 'content', 'type': 'passthru' }], 'readAccess': 'read', 'readable': true, 'removable': false, 'type': 'File', 'uniqueValues': false, 'urlExpirySeconds': null, 'validators': [], 'writable': true, 'writeAccess': 'update', 'writeOnCreate': true }, { 'acl': [], 'aclOverride': false, 'array': false, 'auditable': false, 'autoGenerate': true, 'canPull': true, 'canPush': true, 'creatable': false, 'history': false, 'indexed': true, 'label': 'c_key', 'maxItems': 100, 'maxShift': false, 'minItems': 0, 'name': 'c_key', 'optional': false, 'readAccess': 'read', 'readable': true, 'removable': false, 'type': 'UUID', 'unique': true, 'uniqueValues': false, 'uuidVersion': -1, 'validators': [], 'writable': true, 'writeAccess': 'update', 'writeOnCreate': true }], 'shareAcl': [], 'shareChain': ['share', 'read', 'connected'], 'uniqueKey': 'c_key' }
    ], {
      backup: false
    }).toArray()
  }))

  after(sandboxed(function() {

    /* global org */
    // org.objects.c_test_files.deleteMany({}).execute()
    org.objects.objects.deleteMany({ name: /^c_test_file/ }).execute()

  }))

  it('check if import store properly the filenames', sandboxed(function() {

    require('should')

    const { import: importEnvironment } = require('developer').environment
    importEnvironment([{
      'c_test_file': {
        'includes': [
          'd0af7af5-e141-49d8-9c31-285a13154b17'
        ]
      },
      'object': 'manifest'
    },
    { 'c_file': [{ 'filename': 'testing_name.txt', 'name': 'content', 'mime': 'text/plain', 'object': 'facet', 'ETag': '7c37c7d729650e095945980c7cfc7182', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef9', 'resourceId': '56c74c74-396e-44d7-a86b-8c920e121ef9' }], 'c_key': 'd0af7af5-e141-49d8-9c31-285a13154b17', 'favorite': false, 'object': 'c_test_file' },
    { 'filename': 'testing_name.txt', 'name': 'content', 'mime': 'text/plain', 'object': 'facet', 'ETag': '7c37c7d729650e095945980c7cfc7182', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef9', 'resourceId': '56c74c74-396e-44d7-a86b-8c920e121ef9' },
    { 'data': 'dGVzdGluZyBhIGZpbGUgZm9yIHVwbG9hZCBpbnRvIGltcG9ydFkKCg==', 'index': 0, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef9' },
    { 'data': null, 'index': 1, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef9' }], { backup: false }).toArray()

    let object = org.objects.c_test_file.find({ c_key: 'd0af7af5-e141-49d8-9c31-285a13154b17' }).toArray()
    object[0].c_file.filename.should.equal('testing_name.txt')
  }))

  it('check if export contains filenames', sandboxed(function() {

    require('should')

    const { export: exportEnvironment } = require('developer').environment,
          data = exportEnvironment({
            manifest: {
              c_test_file: {
                includes: ['d0af7af5-e141-49d8-9c31-285a13154b17']
              }
            }
          }).toArray()

    data[0].c_file[0].filename.should.equal('testing_name.txt')

  }))

})
