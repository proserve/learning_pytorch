const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      modules = require('../../../lib/modules'),
      nock = require('nock'),
      config = require('cortex-service/lib/config'),
      { promised } = require('../../../lib/utils'),
      consts = require('../../../lib/consts'),
      Fault = require('cortex-service/lib/fault')

describe('CTXAPI-202 Buffer scripts triggering virus scanner', () => {

  before(
    sandboxed(function() {
      /* global org */
      org.objects.object.insertOne({
        label: 'c_test_object_with_file_buffer_scan',
        name: 'c_test_object_with_file_buffer_scan',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
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
    }, {})
  )

  before(() => {
    config('services').viruscan.scan_uploads = true
    config.flush()
  })

  after(() => {
    config('services').viruscan.scan_uploads = false
    config.flush()
  })

  after(async function() {
    sandboxed(function() {
      /* global org */
      org.objects.object.deleteOne({ name: 'c_test_object_with_file_buffer_scan' }).execute()
    }, {})

  })

  afterEach(async function() {
    nock.cleanAll()
  })

  it('should go through virus scan successfully and create a log', async() => {

    nock(config('services.viruscan.url'))
      .persist()
      .post('/scan')
      .reply(200, { error: null, result: null })

    const newObject = await promised(null, sandboxed(function() {
            /* global org */
            const object = org.objects.c_test_object_with_file_buffer_scan.insertOne({
              c_file: {
                content: {
                  source: 'buffer',
                  buffer: Buffer.from('return script.env'),
                  filename: 'file.js',
                  mime: 'application/json'
                }
              }
            }).execute()
            require('debug').sleep(10000)
            return object
          }, {})),

          data = await modules.db.models.log.find({ 'dat._dat_': `{"message":"Viruscan completed. No viruses detected.","path":"c_test_object_with_file_buffer_scans/${newObject.toString()}/c_file"}` })

    should.exist(data[0])
    should.equal(data[0].sts, 200)

  })

  it('should go through virus scan create a fault if virus scan failed', async() => {

    nock(config('services.viruscan.url'))
      .persist()
      .post('/scan')
      .reply(500, Fault.create('cortex.error.virusDetected'))

    const newObject = await promised(null, sandboxed(function() {
            /* global org */
            const object = org.objects.c_test_object_with_file_buffer_scan.insertOne({
              c_file: {
                content: {
                  source: 'buffer',
                  buffer: Buffer.from('return script.env'),
                  filename: 'file.js',
                  mime: 'application/json'
                }
              }
            }).execute()
            require('debug').sleep(10000)
            return object
          }, {})),
          [file] = await promised(null, sandboxed(function() {
            /* global org, script */
            return org.objects.c_test_object_with_file_buffer_scan.find({ _id: script.arguments.id }).toArray()
          }, {
            runtimeArguments: {
              id: newObject.toString()
            }
          }))

    // File should be in a failed state
    should.exist(file.c_file)
    should.exist(file.c_file.uploads[0])
    should.exist(file.c_file.uploads[0].fault)
    should.equal(file.c_file.uploads[0].fault.code, 'kVirusFound')
    should.equal(file.c_file.uploads[0].fault.errCode, 'cortex.error.virusDetected')
    should.equal(file.c_file.uploads[0].state, consts.media.states.error)

  })

})
