'use strict'

/* global before */

const config = require('cortex-service/lib/config'),
      should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      { promised, sleep, path: pathTo } = require('../../../lib/utils'),
      RandomCharStream = require('../../lib/char-stream'),
      MPU = require('../../lib/multipart-uploader')

describe('CTXAPI-556 - Generate facet signed url with each request', function() {

  before(sandboxed(function() {
    /* global consts */
    org.objects.objects.insertOne({
      label: 'CTXAPI-556',
      name: 'c_ctxapi_556',
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
        }]
      }]
    }).execute()

  }))

  after(sandboxed(function() {
    org.objects.objects.deleteOne({ name: 'c_ctxapi_556' }).execute()
  }))

  it('Each request to file should include a facet signed url', async() => {

    let result, resultGet, done, err = null

    const testId = server.mochaCurrentTestUuid,
          handler = (message, e) => {
            if (message.mochaCurrentTestUuid === testId) {
              if (message.worker === 'media-processor') {
                if (pathTo(message, 'payload.medable.messageSource') === 'sqs') {
                  done = true
                }
              }
              err = e
            }
          },
          { _id, upload } = await promised(null, sandboxed(function() {
            const { _id, c_file: file } = org.objects.c_ctxapi_556.insertOne({ c_file: 'content.txt' }).lean(false).execute()
            return {
              _id,
              upload: file.uploads[0]
            }
          })),
          { uploadUrl } = upload,
          params = upload.fields.reduce(
            (params, { key, value }) => {
              params[key] = value
              return params
            },
            {}
          ),
          MiB = 1000000,
          stream = new RandomCharStream({ sz: 5.5 * MiB }),
          mpu = new MPU(
            config('uploads.s3.accessKeyId'),
            config('uploads.s3.secretAccessKey'),
            uploadUrl,
            params
          )

    server.events.on('worker.done', handler)

    mpu.upload(stream)

    while (!err && !done) { // eslint-disable-line no-unmodified-loop-condition
      await sleep(250)
    }
    server.events.removeListener('worker.done', handler)

    if (err) {
      throw err
    }

    result = await promised(null, sandboxed(function() {

      /* global org, script */

      const { _id } = script.arguments
      return org.objects.c_ctxapi_556.find({ _id }).next()

    }, {
      runtimeArguments: {
        _id
      }
    }
    ))
    resultGet = await server.sessions.admin
      .get(server.makeEndpoint(`/c_ctxapi_556/${_id}/c_file`))
      .set(server.getSessionHeaders()).then()

    should.exist(result.c_file.url)
    should.equal(result.c_file.url.includes('&Signature='), true)
    should.exist(resultGet.body.data.url)
    should.equal(resultGet.body.data.url.includes('&Signature='), true)
  })

})
