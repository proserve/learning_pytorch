'use strict'

const should = require('should')
/* global before, after */

const sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      assets = require('./data/assets')

describe('CTXAPI-1751 - fixing large imports causing socket timeouts', function() {

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

      { 'allowConnections': true, 'auditing': { 'enabled': false }, 'canCascadeDelete': false, 'connectionOptions': { 'requireAccept': true, 'requiredAccess': 5, 'sendNotifications': true }, 'createAcl': ['account.public'], 'defaultAcl': ['owner.delete'], 'favorite': false, 'hasETag': false, 'isDeletable': true, 'isUnmanaged': false, 'isVersioned': false, 'label': 'c_test_file', 'name': 'c_test_file', 'object': 'object', 'objectTypes': [], 'properties': [{ 'acl': [], 'aclOverride': false, 'array': false, 'auditable': false, 'canPull': true, 'canPush': true, 'creatable': false, 'history': false, 'label': 'c_file', 'maxItems': 100, 'maxShift': false, 'minItems': 0, 'name': 'c_file', 'optional': false, 'processors': [{ 'allowUpload': true, 'label': 'Content', 'maxFileSize': 10000000, 'mimes': ['*'], 'name': 'content', 'passMimes': false, 'private': false, 'required': true, 'source': 'content', 'type': 'passthru' }], 'readAccess': 'read', 'readable': true, 'removable': false, 'type': 'File', 'uniqueValues': false, 'urlExpirySeconds': null, 'validators': [], 'writable': true, 'writeAccess': 'update', 'writeOnCreate': true }, { 'acl': [], 'aclOverride': false, 'array': false, 'auditable': false, 'canPull': true, 'canPush': true, 'creatable': false, 'history': false, 'label': 'c_file_2', 'maxItems': 100, 'maxShift': false, 'minItems': 0, 'name': 'c_file_2', 'optional': false, 'processors': [{ 'allowUpload': true, 'label': 'Content', 'maxFileSize': 10000000, 'mimes': ['*'], 'name': 'content', 'passMimes': false, 'private': false, 'required': true, 'source': 'content', 'type': 'passthru' }], 'readAccess': 'read', 'readable': true, 'removable': false, 'type': 'File', 'uniqueValues': false, 'urlExpirySeconds': null, 'validators': [], 'writable': true, 'writeAccess': 'update', 'writeOnCreate': true }, { 'acl': [], 'aclOverride': false, 'array': false, 'auditable': false, 'autoGenerate': true, 'canPull': true, 'canPush': true, 'creatable': false, 'history': false, 'indexed': true, 'label': 'c_key', 'maxItems': 100, 'maxShift': false, 'minItems': 0, 'name': 'c_key', 'optional': false, 'readAccess': 'read', 'readable': true, 'removable': false, 'type': 'UUID', 'unique': true, 'uniqueValues': false, 'uuidVersion': -1, 'validators': [], 'writable': true, 'writeAccess': 'update', 'writeOnCreate': true }], 'shareAcl': [], 'shareChain': ['share', 'read', 'connected'], 'uniqueKey': 'c_key' }
    ], {
      backup: false
    }).toArray()
  }))

  after(sandboxed(function() {

    /* global org */
    // org.objects.c_test_files.deleteMany({}).execute()
    org.objects.objects.deleteMany({ name: /^c_test_file/ }).execute()

  }))

  it('should check if import completes successfully', async function() {
    const result = await promised(null, sandboxed(function() {
        const { import: importEnvironment } = require('developer').environment
        importEnvironment([
            {
            'c_test_file': {
                'includes': [
                'd0af7af5-e141-49d8-9c31-285a13154b17'
                ]
            },
            'object': 'manifest'
            },
            { 
                'c_file': [{ 'filename': 'testing_name.txt', 'name': 'content', 'mime': 'text/plain', 'object': 'facet', 'ETag': '7c37c7d729650e095945980c7cfc7182', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef9', 'resourceId': '56c74c74-396e-44d7-a86b-8c920e121ef9' }], 'c_key': 'd0af7af5-e141-49d8-9c31-285a13154b17', 'favorite': false, 'object': 'c_test_file' 
            },
            { 
                'filename': 'testing_name.txt', 'name': 'content', 'mime': 'text/plain', 'object': 'facet', 'ETag': '7c37c7d729650e095945980c7cfc7182', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef9', 'resourceId': '56c74c74-396e-44d7-a86b-8c920e121ef9' 
            },
            { 
                'data': script.arguments.assets.c_test_file_1[0].data, 'index': 0, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef9' 
            },
            { 
                'data': script.arguments.assets.c_test_file_1[1].data, 'index': 1, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef9' 
            },
            { 
                'data': script.arguments.assets.c_test_file_1[2].data, 'index': 2, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef9' 
            },
            { 
                'data': script.arguments.assets.c_test_file_1[3].data, 'index': 3, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef9' 
            },
            { 
                'data': null, 'index': 4, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef9' 
            }
        ], { backup: false, triggers: false }).toArray()
    
    
        return org.objects.c_test_file.find({ c_key: 'd0af7af5-e141-49d8-9c31-285a13154b17' }).toArray()
        // object[0].c_file.filename.should.equal('testing_name.txt')
        
      }, {
        runtimeArguments: {
            assets
        }
      }))

    should.exist(result[0].c_file)
    should.exist(result[0].c_file.url)
    should.equal(result[0].c_file.state, 2)
  })

  it('should check if import completes successfully for multiple facets/streams', async function() {
    this.timeout(60000) // increasing the timeout since large network upload requests 
    const result = await promised(null, sandboxed(function() {
        const { import: importEnvironment } = require('developer').environment
        importEnvironment([
          {
            'c_test_file': {
              'includes': [
                'd0af7af5-e141-49d8-9c31-285a13154b17'
              ]
            },
            'object': 'manifest'
          },
          {
            'c_file': [{ 'filename': 'testing_name.txt', 'name': 'content', 'mime': 'text/plain', 'object': 'facet', 'ETag': '7c37c7d729650e095945980c7cfc7182', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef7', 'resourceId': '56c74c74-396e-44d7-a86b-8c920e121ef7' }],
            'c_file_2': [{ 'filename': 'testing_name_2.txt', 'name': 'content', 'mime': 'text/plain', 'object': 'facet', 'ETag': '7c37c7d729650e095945980c7cfc7183', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef8', 'resourceId': '56c74c74-396e-44d7-a86b-8c920e121ef8' }],
            'c_key': 'd0af7af5-e141-49d8-9c31-285a13154b17',
            'favorite': false,
            'object': 'c_test_file'
          },
          {
            'filename': 'testing_name.txt', 'name': 'content', 'mime': 'text/plain', 'object': 'facet', 'ETag': '7c37c7d729650e095945980c7cfc7182', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef7', 'resourceId': '56c74c74-396e-44d7-a86b-8c920e121ef7'
          },
          {
            'filename': 'testing_name_2.txt', 'name': 'content', 'mime': 'text/plain', 'object': 'facet', 'ETag': '7c37c7d729650e095945980c7cfc7183', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef8', 'resourceId': '56c74c74-396e-44d7-a86b-8c920e121ef8'
          },
          {
            'data': script.arguments.assets.c_test_file_1[0].data, 'index': 0, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef7'
          },
          {
            'data': script.arguments.assets.c_test_file_1[1].data, 'index': 1, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef7'
          },
          {
            'data': script.arguments.assets.c_test_file_1[2].data, 'index': 2, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef7'
          },
          {
            'data': script.arguments.assets.c_test_file_1[3].data, 'index': 3, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef7'
          },
          {
            'data': null, 'index': 4, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef7'
          },
          {
            'data': script.arguments.assets.c_test_file_1[0].data, 'index': 0, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef8'
          },
          {
            'data': script.arguments.assets.c_test_file_1[1].data, 'index': 1, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef8'
          },
          {
            'data': script.arguments.assets.c_test_file_1[2].data, 'index': 2, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef8'
          },
          {
            'data': script.arguments.assets.c_test_file_1[3].data, 'index': 3, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef8'
          },
          {
            'data': null, 'index': 4, 'object': 'stream', 'streamId': '56c74c74-396e-44d7-a86b-8c920e121ef8'
          }
        ], { backup: false, triggers: false }).toArray()
    
    
        return org.objects.c_test_file.find({ c_key: 'd0af7af5-e141-49d8-9c31-285a13154b17' }).toArray()
        // object[0].c_file.filename.should.equal('testing_name.txt')
        
      }, {
        runtimeArguments: {
            assets
        }
      }))

    should.exist(result[0].c_file)
    should.exist(result[0].c_file.url)
    should.equal(result[0].c_file.state, 2)

    should.exist(result[0].c_file_2)
    should.exist(result[0].c_file_2.url)
    should.equal(result[0].c_file_2.state, 2)
  })
})
