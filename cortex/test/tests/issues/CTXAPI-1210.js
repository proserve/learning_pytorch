'use strict'

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      should = require('should'),
      { promised, sleep } = require('../../../lib/utils')

describe('Issues - CTXAPI-1210 - Asset Export', function() {

  before(sandboxed(function() {

    const modelName = 'c_ctxapi_1210',
          {
            org: {
              objects: {
                Objects
              }
            }
          } = global

    Objects.insertOne({
      label: modelName,
      name: modelName,
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      uniqueKey: 'c_key',
      properties: [{
        label: 'c_key',
        name: 'c_key',
        type: 'UUID',
        autoGenerate: true,
        indexed: true,
        unique: true,
        writable: false
      }, {
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
        }]
      }]
    })
      .execute()

  }))

  it('should export assets.', async function() {

    let err = null,
        done,
        docs,
        facet

    const testId = server.mochaCurrentTestUuid,
          handler = (message, e) => {
            if (message.mochaCurrentTestUuid === testId) {
              if (message.worker === 'media-processor') {
                done = true
              }
              err = e
            }
          },
          doc = await promised(null, sandboxed(function() {
            return global.org.objects.c_ctxapi_1210.insertOne({
              c_file: {
                content: {
                  buffer: Buffer.from('contents'),
                  filename: 'contents.bin'
                }
              }
            }).lean(false).execute()
          }))

    server.events.on('worker.done', handler)

    while (!err && !done) { // eslint-disable-line no-unmodified-loop-condition
      await sleep(250)
    }
    server.events.removeListener('worker.done', handler)

    if (err) {
      throw err
    }

    // ---------------------------------------

    docs = await promised(null, sandboxed(function() {

      const {
              environment: { export: exportEnvironment }
            } = require('developer'),
            {
              script: {
                arguments: {
                  doc
                }
              }
            } = global
      return exportEnvironment({
        manifest: {
          c_ctxapi_1210: {
            includes: [doc.c_key]
          }
        }
      }).toArray()
    }, {
      runtimeArguments: {
        doc
      }
    }))

    // ---------------------------------------

    facet = docs.find(v => v.resource === `c_ctxapi_1210.${doc.c_key}.c_file.content`)

    should.exist(facet)
    should.exist(facet.url)

  })

})
