'use strict'

/* global before */

const server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      { sleep, promised } = require('../../../lib/utils'),
      { driver: { Driver } } = modules,
      sandboxed = require('../../lib/sandboxed'),
      should = require('should'),
      _ = require('lodash')

describe('CTXAPI-285 - File History', function() {

  // --------------------------------

  before(sandboxed(function() {

    /* global org */

    const { c_ctxapi_285: Model } = org.objects,
          { environment: { import: importEnvironment } } = require('developer'),
          manifest = {
            object: 'manifest',
            dependencies: false,
            objects: [{
              name: Model.name
            }]
          },
          definition = getObjectDefinition()

    importEnvironment([definition], { manifest, backup: false }).toArray()

    function getObjectDefinition() {

      return {
        'allowConnections': true,
        'auditing': {
          'enabled': false
        },
        'canCascadeDelete': false,
        'connectionOptions': {
          'requireAccept': true,
          'requiredAccess': 5,
          'sendNotifications': true
        },
        'createAcl': [
          'account.public'
        ],
        'defaultAcl': [
          'owner.delete'
        ],
        'favorite': false,
        'hasETag': false,
        'isDeletable': true,
        'isUnmanaged': false,
        'isVersioned': false,
        'label': 'CTXAPI-285 User Story / CTXAPI-311 Task',
        'name': 'c_ctxapi_285',
        'object': 'object',
        'objectTypes': [],
        'properties': [
          {
            'acl': [],
            'aclOverride': false,
            'array': false,
            'canPull': true,
            'canPush': true,
            'creatable': false,
            'label': 'doc',
            'maxItems': 100,
            'maxShift': false,
            'minItems': 0,
            'name': 'c_doc',
            'optional': false,
            'properties': [
              {
                'acl': [],
                'aclOverride': false,
                'array': false,
                'auditable': false,
                'canPull': true,
                'canPush': true,
                'creatable': false,
                'history': true,
                'label': 'file',
                'maxItems': 100,
                'maxShift': false,
                'minItems': 0,
                'name': 'c_file',
                'optional': false,
                'processors': [
                  {
                    'allowUpload': true,
                    'label': 'Content',
                    'maxFileSize': 10000000,
                    'mimes': [
                      '*'
                    ],
                    'name': 'content',
                    'passMimes': false,
                    'private': false,
                    'required': true,
                    'source': 'content',
                    'type': 'passthru'
                  }
                ],
                'readAccess': 'read',
                'readable': true,
                'removable': true,
                'type': 'File',
                'uniqueValues': false,
                'urlExpirySeconds': null,
                'validators': [],
                'writable': true,
                'writeAccess': 'update',
                'writeOnCreate': true
              },
              {
                'acl': [],
                'aclOverride': false,
                'array': true,
                'auditable': false,
                'canPull': true,
                'canPush': true,
                'creatable': false,
                'history': true,
                'label': 'files',
                'maxItems': 100,
                'maxShift': false,
                'minItems': 0,
                'name': 'c_files',
                'optional': false,
                'processors': [
                  {
                    'allowUpload': true,
                    'label': 'Content',
                    'maxFileSize': 10000000,
                    'mimes': [
                      '*'
                    ],
                    'name': 'content',
                    'passMimes': false,
                    'private': false,
                    'required': true,
                    'source': 'content',
                    'type': 'passthru'
                  }
                ],
                'readAccess': 'read',
                'readable': true,
                'removable': true,
                'type': 'File',
                'uniqueValues': false,
                'urlExpirySeconds': null,
                'validators': [],
                'writable': true,
                'writeAccess': 'update',
                'writeOnCreate': true
              }
            ],
            'readAccess': 'read',
            'readable': true,
            'removable': true,
            'type': 'Document',
            'uniqueKey': '',
            'validators': [],
            'writable': true,
            'writeAccess': 'update',
            'writeOnCreate': true
          },
          {
            'acl': [],
            'aclOverride': false,
            'array': true,
            'canPull': true,
            'canPush': true,
            'creatable': false,
            'label': 'docs',
            'maxItems': 100,
            'maxShift': false,
            'minItems': 0,
            'name': 'c_docs',
            'optional': false,
            'properties': [
              {
                'acl': [],
                'aclOverride': false,
                'array': false,
                'auditable': false,
                'canPull': true,
                'canPush': true,
                'creatable': false,
                'history': true,
                'label': 'file',
                'maxItems': 100,
                'maxShift': false,
                'minItems': 0,
                'name': 'c_file',
                'optional': false,
                'processors': [
                  {
                    'allowUpload': true,
                    'label': 'Content',
                    'maxFileSize': 10000000,
                    'mimes': [
                      '*'
                    ],
                    'name': 'content',
                    'passMimes': false,
                    'private': false,
                    'required': true,
                    'source': 'content',
                    'type': 'passthru'
                  }
                ],
                'readAccess': 'read',
                'readable': true,
                'removable': true,
                'type': 'File',
                'uniqueValues': false,
                'urlExpirySeconds': null,
                'validators': [],
                'writable': true,
                'writeAccess': 'update',
                'writeOnCreate': true
              },
              {
                'acl': [],
                'aclOverride': false,
                'array': true,
                'auditable': false,
                'canPull': true,
                'canPush': true,
                'creatable': false,
                'history': true,
                'label': 'files',
                'maxItems': 100,
                'maxShift': false,
                'minItems': 0,
                'name': 'c_files',
                'optional': false,
                'processors': [
                  {
                    'allowUpload': true,
                    'label': 'Content',
                    'maxFileSize': 10000000,
                    'mimes': [
                      '*'
                    ],
                    'name': 'content',
                    'passMimes': false,
                    'private': false,
                    'required': true,
                    'source': 'content',
                    'type': 'passthru'
                  }
                ],
                'readAccess': 'read',
                'readable': true,
                'removable': true,
                'type': 'File',
                'uniqueValues': false,
                'urlExpirySeconds': null,
                'validators': [],
                'writable': true,
                'writeAccess': 'update',
                'writeOnCreate': true
              }
            ],
            'readAccess': 'read',
            'readable': true,
            'removable': true,
            'type': 'Document',
            'uniqueKey': '',
            'validators': [],
            'writable': true,
            'writeAccess': 'update',
            'writeOnCreate': true
          },
          {
            'acl': [],
            'aclOverride': false,
            'array': false,
            'auditable': false,
            'canPull': true,
            'canPush': true,
            'creatable': false,
            'history': true,
            'label': 'file',
            'maxItems': 100,
            'maxShift': false,
            'minItems': 0,
            'name': 'c_file',
            'optional': false,
            'processors': [
              {
                'allowUpload': true,
                'label': 'Content',
                'maxFileSize': 100000,
                'mimes': [
                  '*'
                ],
                'name': 'content',
                'passMimes': false,
                'private': false,
                'required': true,
                'source': 'content',
                'type': 'passthru'
              }
            ],
            'readAccess': 'read',
            'readable': true,
            'removable': true,
            'type': 'File',
            'uniqueValues': false,
            'urlExpirySeconds': null,
            'validators': [],
            'writable': true,
            'writeAccess': 'update',
            'writeOnCreate': true
          },
          {
            'acl': [],
            'aclOverride': false,
            'array': true,
            'auditable': false,
            'canPull': true,
            'canPush': true,
            'creatable': false,
            'history': true,
            'label': 'Files',
            'maxItems': 100,
            'maxShift': false,
            'minItems': 0,
            'name': 'c_files',
            'optional': false,
            'processors': [
              {
                'allowUpload': true,
                'label': 'Content',
                'maxFileSize': 10000000,
                'mimes': [
                  '*'
                ],
                'name': 'content',
                'passMimes': false,
                'private': false,
                'required': true,
                'source': 'content',
                'type': 'passthru'
              }
            ],
            'readAccess': 'read',
            'readable': true,
            'removable': true,
            'type': 'File',
            'uniqueValues': false,
            'urlExpirySeconds': null,
            'validators': [],
            'writable': true,
            'writeAccess': 'update',
            'writeOnCreate': true
          }
        ],
        'resource': 'object.c_ctxapi_285',
        'shareAcl': [],
        'shareChain': [],
        'uniqueKey': ''
      }

    }

  }))

  it('record history for file inserts/updates/deletes.', async function() {

    let workerDone = false,
        processingComplete = false,
        err = null,
        doc,
        set,
        _id,
        cursor,
        history = [],
        fileUploadsHistory,
        ops,
        originalDocsIds = [],
        updatedDocsIds = []

    const principal = server.principals.admin,
          Model = await promised(principal.org, 'createObject', 'c_ctxapi_285'),
          { History } = modules.db.models,
          driver = new Driver(principal, Model),
          testId = server.mochaCurrentTestUuid,
          onDone = (message, e) => {
            if (message.mochaCurrentTestUuid === testId) {
              if (message.worker === 'history-processor') {
                workerDone = true
              }
              err = e
            }
          }

    server.events.on('worker.done', onDone)

    // insert and wait for all media and history to process.
    _id = await driver.insertOne({
      document: {
        c_file: content('c_file'),
        c_files: [content('c_files[0]'), content('c_files[1]')],
        c_doc: {
          c_file: content('c_doc.c_file'),
          c_files: [content('c_doc.c_files[0]'), content('c_doc.c_files[1]')]
        },
        c_docs: [{
          c_file: content('c_docs[0].c_file'),
          c_files: [content('c_docs[0].c_files[0]'), content('c_docs[0].c_files[1]')]
        }, {
          c_file: content('c_docs[1].c_file'),
          c_files: [content('c_docs[1].c_files[0]'), content('c_docs[1].c_files[1]')]
        }]
      },
      lean: true
    })

    while (!processingComplete) {

      doc = await driver.readOne({ where: { _id } })

      processingComplete = doc.c_file.state === 2 &&
        doc.c_files[0].state === 2 &&
        doc.c_files[1].state === 2 &&
        doc.c_doc.c_file.state === 2 &&
        doc.c_doc.c_files[0].state === 2 &&
        doc.c_doc.c_files[1].state === 2 &&
        doc.c_docs[0].c_file.state === 2 &&
        doc.c_docs[0].c_files[0].state === 2 &&
        doc.c_docs[0].c_files[1].state === 2 &&
        doc.c_docs[1].c_file.state === 2 &&
        doc.c_docs[1].c_files[0].state === 2 &&
        doc.c_docs[1].c_files[1].state === 2

      await sleep(250)
    }

    while (1) {
      if (err || workerDone) {
        break
      }
      await sleep(50)
    }

    if (err) {
      throw err
    }

    originalDocsIds[0] = doc.c_docs[0]._id
    originalDocsIds[1] = doc.c_docs[1]._id
    workerDone = false
    processingComplete = false

    // update wait for all media and history to process.
    await driver.updateOne({
      where: {
        _id
      },
      update: {
        $set: {
          c_file: content('c_file - updated'),
          c_files: [content('c_files[0] - updated'), content('c_files[1] - updated')],
          c_doc: {
            c_file: content('c_doc.c_file - updated'),
            c_files: [content('c_doc.c_files[0] - updated'), content('c_doc.c_files[1] - updated')]
          },
          c_docs: [{
            c_file: content('c_docs[0].c_file - updated'),
            c_files: [content('c_docs[0].c_files[0] - updated'), content('c_docs[0].c_files[1] - updated')]
          }, {
            c_file: content('c_docs[1].c_file - updated'),
            c_files: [content('c_docs[1].c_files[0] - updated'), content('c_docs[1].c_files[1] - updated')]
          }]
        }
      }
    })

    while (!processingComplete) {

      doc = await driver.readOne({ where: { _id } })

      processingComplete = doc.c_file.state === 2 &&
        doc.c_files[0].state === 2 &&
        doc.c_files[1].state === 2 &&
        doc.c_doc.c_file.state === 2 &&
        doc.c_doc.c_files[0].state === 2 &&
        doc.c_doc.c_files[1].state === 2 &&
        doc.c_docs[0].c_file.state === 2 &&
        doc.c_docs[0].c_files[0].state === 2 &&
        doc.c_docs[0].c_files[1].state === 2 &&
        doc.c_docs[1].c_file.state === 2 &&
        doc.c_docs[1].c_files[0].state === 2 &&
        doc.c_docs[1].c_files[1].state === 2

      await sleep(50)
    }

    while (1) {
      if (err || workerDone) {
        break
      }
      await sleep(50)
    }

    if (err) {
      throw err
    }

    // remove/delete wait for all media and history to process.

    updatedDocsIds[0] = doc.c_docs[0]._id
    updatedDocsIds[1] = doc.c_docs[1]._id
    workerDone = false

    await driver.updateOne({
      match: {
        _id
      },
      update: {
        $unset: {
          c_file: 1,
          'c_doc.c_file': 1
        },
        $set: {
          c_files: [],
          c_doc: {
            c_files: []
          },
          c_docs: []
        }
      }
    })

    while (1) {
      if (err || workerDone) {
        break
      }
      await sleep(50)
    }

    if (err) {
      throw err
    }

    server.events.removeListener('worker.done', onDone)

    doc = await driver.readOne({ where: { _id } })

    cursor = await (new Driver(principal, History)).cursor({
      where: {
        'context.object': Model.objectName
      },
      include: ['ops'],
      sort: { 'context.sequence': 1 }
    }, {
      grant: 'script' // in order to read ops.
    })

    while (await promised(cursor, 'hasNext')) {
      history.push((await promised(cursor, 'next')))
    }

    should.exist(history)
    history.length.should.equal(27)
    history.forEach(h => h.context.object.should.equal('c_ctxapi_285'))

    history[0].ops.length.should.equal(16)
    ops = history[0].ops

    set = ops.filter(v => v.path === 'c_file')
    set[0].type.should.equal(2)
    set[1].type.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    set = ops.filter(v => v.path === 'c_files')
    set[0].type.should.equal(3)
    set[0].index.should.equal(0)
    set[0].value.filename.should.equal('buffer.txt')
    set[0].value.state.should.equal(0)
    set[1].type.should.equal(3)
    set[1].index.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    set = ops.filter(v => v.path === 'c_doc.c_file')
    set[0].type.should.equal(2)
    set[1].type.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    set = ops.filter(v => v.path === 'c_doc.c_files')
    set[0].type.should.equal(3)
    set[0].index.should.equal(0)
    set[0].value.filename.should.equal('buffer.txt')
    set[0].value.state.should.equal(0)
    set[1].type.should.equal(3)
    set[1].index.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    set = ops.filter(v => v.path === `c_docs.${originalDocsIds[0]}.c_file`)
    set[0].type.should.equal(2)
    set[1].type.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    set = ops.filter(v => v.path === `c_docs.${originalDocsIds[0]}.c_files`)
    set[0].type.should.equal(3)
    set[0].index.should.equal(0)
    set[0].value.filename.should.equal('buffer.txt')
    set[0].value.state.should.equal(0)
    set[1].type.should.equal(3)
    set[1].index.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    set = ops.filter(v => v.path === `c_docs.${originalDocsIds[1]}.c_file`)
    set[0].type.should.equal(2)
    set[1].type.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    set = ops.filter(v => v.path === `c_docs.${originalDocsIds[1]}.c_files`)
    set[0].type.should.equal(3)
    set[0].index.should.equal(0)
    set[0].value.filename.should.equal('buffer.txt')
    set[0].value.state.should.equal(0)
    set[1].type.should.equal(3)
    set[1].index.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    fileUploadsHistory = _.slice(history, 1, 13)
    verifyFileUploadsHistory(fileUploadsHistory, originalDocsIds)

    history[13].ops.length.should.equal(26)
    ops = history[13].ops

    set = ops.filter(v => v.path === `c_file`)
    set[0].type.should.equal(2)
    set[0].value.filename.should.equal('buffer.bin')
    set[0].value.state.should.equal(2)
    set[1].type.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    set = ops.filter(v => v.path === `c_files`)
    set[0].type.should.equal(4)
    set[0].index.should.equal(0)
    set[0].value.filename.should.equal('buffer.bin')
    set[0].value.state.should.equal(2)
    set[1].type.should.equal(4)
    set[1].index.should.equal(1)
    set[1].value.filename.should.equal('buffer.bin')
    set[1].value.state.should.equal(2)
    set[2].type.should.equal(3)
    set[2].index.should.equal(0)
    set[2].value.filename.should.equal('buffer.txt')
    set[2].value.state.should.equal(0)
    set[3].type.should.equal(3)
    set[3].index.should.equal(1)
    set[3].value.filename.should.equal('buffer.txt')
    set[3].value.state.should.equal(0)

    set = ops.filter(v => v.path === `c_doc.c_file`)
    set[0].type.should.equal(2)
    set[0].value.filename.should.equal('buffer.bin')
    set[0].value.state.should.equal(2)
    set[1].type.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    set = ops.filter(v => v.path === `c_doc.c_files`)
    set[0].type.should.equal(4)
    set[0].index.should.equal(0)
    set[0].value.filename.should.equal('buffer.bin')
    set[0].value.state.should.equal(2)
    set[1].type.should.equal(4)
    set[1].index.should.equal(1)
    set[1].value.filename.should.equal('buffer.bin')
    set[1].value.state.should.equal(2)
    set[2].type.should.equal(3)
    set[2].index.should.equal(0)
    set[2].value.filename.should.equal('buffer.txt')
    set[2].value.state.should.equal(0)
    set[3].type.should.equal(3)
    set[3].index.should.equal(1)
    set[3].value.filename.should.equal('buffer.txt')
    set[3].value.state.should.equal(0)

    set = ops.filter(v => v.path === `c_docs.${originalDocsIds[0]}.c_file`)
    set[0].type.should.equal(2)
    set[0].value.filename.should.equal('buffer.bin')
    set[0].value.state.should.equal(2)

    set = ops.filter(v => v.path === `c_docs.${originalDocsIds[0]}.c_files`)
    set[0].type.should.equal(4)
    set[0].index.should.equal(0)
    set[0].value.filename.should.equal('buffer.bin')
    set[0].value.state.should.equal(2)
    set[1].type.should.equal(4)
    set[1].index.should.equal(1)
    set[1].value.filename.should.equal('buffer.bin')
    set[1].value.state.should.equal(2)

    set = ops.filter(v => v.path === `c_docs.${originalDocsIds[1]}.c_file`)
    set[0].type.should.equal(2)
    set[0].value.filename.should.equal('buffer.bin')
    set[0].value.state.should.equal(2)

    set = ops.filter(v => v.path === `c_docs.${originalDocsIds[1]}.c_files`)
    set[0].type.should.equal(4)
    set[0].index.should.equal(0)
    set[0].value.filename.should.equal('buffer.bin')
    set[0].value.state.should.equal(2)
    set[1].type.should.equal(4)
    set[1].index.should.equal(1)
    set[1].value.filename.should.equal('buffer.bin')
    set[1].value.state.should.equal(2)

    set = ops.filter(v => v.path === `c_docs.${updatedDocsIds[0]}.c_file`)
    set[0].type.should.equal(2)
    set[1].type.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    set = ops.filter(v => v.path === `c_docs.${updatedDocsIds[0]}.c_files`)
    set[0].type.should.equal(3)
    set[0].index.should.equal(0)
    set[0].value.filename.should.equal('buffer.txt')
    set[0].value.state.should.equal(0)
    set[1].type.should.equal(3)
    set[1].index.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    set = ops.filter(v => v.path === `c_docs.${updatedDocsIds[1]}.c_file`)
    set[0].type.should.equal(2)
    set[1].type.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    set = ops.filter(v => v.path === `c_docs.${updatedDocsIds[1]}.c_files`)
    set[0].type.should.equal(3)
    set[0].index.should.equal(0)
    set[0].value.filename.should.equal('buffer.txt')
    set[0].value.state.should.equal(0)
    set[1].type.should.equal(3)
    set[1].index.should.equal(1)
    set[1].value.filename.should.equal('buffer.txt')
    set[1].value.state.should.equal(0)

    fileUploadsHistory = _.slice(history, 14, 26)
    verifyFileUploadsHistory(fileUploadsHistory, updatedDocsIds)

    history[26].ops.length.should.equal(12)
    ops = history[26].ops
    ops.forEach(o => should.exist(o.value))
    ops.forEach(o => o.value.filename.should.equal('buffer.bin'))
    ops.forEach(o => o.value.state.should.equal(2))

    set = ops.filter(v => v.path === `c_file`)
    set[0].type.should.equal(2)

    set = ops.filter(v => v.path === `c_doc.c_file`)
    set[0].type.should.equal(2)

    set = ops.filter(v => v.path === `c_files`)
    set[0].type.should.equal(4)
    set[0].index.should.equal(0)
    set[1].type.should.equal(4)
    set[1].index.should.equal(1)

    set = ops.filter(v => v.path === `c_doc.c_files`)
    set[0].type.should.equal(4)
    set[0].index.should.equal(0)
    set[1].type.should.equal(4)
    set[1].index.should.equal(1)

    set = ops.filter(v => v.path === `c_docs.${updatedDocsIds[0]}.c_file`)
    set[0].type.should.equal(2)

    set = ops.filter(v => v.path === `c_docs.${updatedDocsIds[0]}.c_files`)
    set[0].type.should.equal(4)
    set[0].index.should.equal(0)
    set[1].type.should.equal(4)
    set[1].index.should.equal(1)

    set = ops.filter(v => v.path === `c_docs.${updatedDocsIds[1]}.c_file`)
    set[0].type.should.equal(2)

    set = ops.filter(v => v.path === `c_docs.${updatedDocsIds[1]}.c_files`)
    set[0].type.should.equal(4)
    set[0].index.should.equal(0)
    set[1].type.should.equal(4)
    set[1].index.should.equal(1)

  })

})

function verifyFileUploadsHistory(fileUploadsHistory, docIds) {
  fileUploadsHistory.forEach(h => h.ops.length.should.equal(1))
  fileUploadsHistory.forEach(h => h.ops[0].type.should.equal(1))
  fileUploadsHistory.forEach(h => h.ops[0].value.state.should.equal(2))
  fileUploadsHistory.forEach(h => h.ops[0].value.filename.should.equal('buffer.bin'))
  fileUploadsHistory = _.sortBy(fileUploadsHistory, h => h.ops[0].path)
  docIds = _.sortBy(docIds, d => d.toString())

  fileUploadsHistory[0].ops[0].path.should.equal('c_doc.c_file')
  fileUploadsHistory[1].ops[0].path.should.equal('c_doc.c_files')
  fileUploadsHistory[2].ops[0].path.should.equal('c_doc.c_files')
  fileUploadsHistory[3].ops[0].path.should.equal(`c_docs.${docIds[0]}.c_file`)
  fileUploadsHistory[4].ops[0].path.should.equal(`c_docs.${docIds[0]}.c_files`)
  fileUploadsHistory[5].ops[0].path.should.equal(`c_docs.${docIds[0]}.c_files`)
  fileUploadsHistory[6].ops[0].path.should.equal(`c_docs.${docIds[1]}.c_file`)
  fileUploadsHistory[7].ops[0].path.should.equal(`c_docs.${docIds[1]}.c_files`)
  fileUploadsHistory[8].ops[0].path.should.equal(`c_docs.${docIds[1]}.c_files`)
  fileUploadsHistory[9].ops[0].path.should.equal(`c_file`)
  fileUploadsHistory[10].ops[0].path.should.equal(`c_files`)
  fileUploadsHistory[11].ops[0].path.should.equal(`c_files`)
}

function content(buffer = 'content', filename = 'buffer.txt') {

  return { content: { buffer, filename } }
}
