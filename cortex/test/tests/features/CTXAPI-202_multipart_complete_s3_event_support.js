'use strict'

/* global before */

const config = require('cortex-service/lib/config'),
      sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      { promised, sleep, path: pathTo } = require('../../../lib/utils'),
      RandomCharStream = require('../../lib/char-stream'),
      MPU = require('../../lib/multipart-uploader')

describe('Features - S3', function() {

  describe('CTXAPI-202 - Multipart Upload Event Support', function() {

    before(sandboxed(function() {

      org.objects.objects.insertOne({
        label: 'CTXAPI-202',
        name: 'c_ctxapi_202',
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

    it('multipart upload should trigger media processor', async() => {

      let done, err = null

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
              const { _id, c_file: file } = org.objects.c_ctxapi_202.insertOne({ c_file: 'content.txt' }).lean(false).execute()
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

      await promised(null, sandboxed(function() {

        /* global org, script, consts */

        require('should')

        const { _id } = script.arguments,
              doc = org.objects.c_ctxapi_202.find({ _id }).next()

        doc.c_file.state.should.equal(consts.media.states.ready)

      }, {
        runtimeArguments: {
          _id
        }
      }))

    })

  })

})
