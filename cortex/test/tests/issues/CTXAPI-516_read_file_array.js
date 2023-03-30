const should = require('should'),
      server = require('../../lib/server'),
      sandboxed = require('../../lib/sandboxed'),
      { promised, sleep } = require('../../../lib/utils'),
      waitUntilWorkerEnds = async() => {
        let done = false, err = null
        const testId = server.mochaCurrentTestUuid,
              handler = (message, e) => {
                if (message.mochaCurrentTestUuid === testId) {
                  if (message.worker === 'media-processor') {
                    done = true
                    err = e
                  }
                }
              }

        server.events.on('worker.done', handler)

        while (!done) { // eslint-disable-line no-unmodified-loop-condition
          await sleep(250)
        }
        server.events.removeListener('worker.done', handler)

        if (err) {
          throw err
        }
        return true
      }

describe('Bugs - CTXAPI-516 Read file array', function() {
  let result, resultRest
  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */

      org.objects.objects.insertOne({
        name: 'c_ctxapi_516',
        label: 'CTXAPI-516 Object',
        createAcl: 'account.public',
        defaultAcl: 'role.administrator.delete',
        properties: [{
          name: 'c_file_array',
          label: 'File Array',
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
          }]
        }]
      }).execute()
    }))
  })

  it('check file array facets with pathRead and by Api Rest', async() => {

    const _id = await promised(null, sandboxed(function() {
      /* global org */

      /* eslint-disable node/no-deprecated-api */

      return org.objects.c_ctxapi_516.insertOne({
        c_file_array: [{
          content: { buffer: new Buffer('This is text in english'), filename: 'english_c_file.bin' }
        }, {
          content: { buffer: new Buffer('This is a second file in english'), filename: 'english_c_file_2.bin' }
        }]
      }).execute()
    }))

    await waitUntilWorkerEnds()

    result = await promised(null, sandboxed(function() {
      /* global org, script */
      /* eslint-disable node/no-deprecated-api */
      return org.objects.c_ctxapi_516.find().pathRead(`${script.arguments.instanceId}/c_file_array/content`)

    },
    {
      runtimeArguments: {
        instanceId: _id
      }
    }
    ))

    // check content with corresponding filename
    should.equal(result.length, 2)
    should.equal(result[0].filename, 'english_c_file.bin')
    should.equal(result[1].filename, 'english_c_file_2.bin')
    should.equal(result[0].name, 'content')
    should.equal(result[1].name, 'content')

    resultRest = await fetchObjects(`/c_ctxapi_516/${_id}/c_file_array/content`)

    // check content with corresponding filename
    should.equal(resultRest.body.data.length, 2)
    should.equal(resultRest.body.data[0].filename, 'english_c_file.bin')
    should.equal(resultRest.body.data[1].filename, 'english_c_file_2.bin')
    should.equal(resultRest.body.data[0].name, 'content')
    should.equal(resultRest.body.data[1].name, 'content')

  })

  async function fetchObjects(path) {
    return server.sessions.admin
      .get(server.makeEndpoint(path))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .then()
  }
})
