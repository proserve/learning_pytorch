'use strict'

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      { promised, sleep } = require('../../../lib/utils'),
      should = require('should'),
      waitUntilWorkerEnds = async() => {
        let done = false, err = null
        const testId = server.mochaCurrentTestUuid,
              handler = (message, e) => {
                if (message.mochaCurrentTestUuid === testId) {
                  if (message.worker === 'exporter') {
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

describe('Issues - CTXAPI-607 - Allow output objects as source on exports', function() {

  before(sandboxed(function() {
    /* global org */
    const contextObject = 'c_ctxapi_607',
          {
            OO,
            [contextObject]: Model,
            Objects
          } = org.objects,
          ooName = 'o_ctxapi_607'

    if (Objects.find({ name: contextObject }).count() === 0) {

      Objects.insertOne({
        name: contextObject,
        label: 'CTXAPI-607 context object',
        defaultAcl: 'role.administrator.delete',
        createAcl: 'account.public',
        properties: [{
          name: 'ctx__label',
          label: 'Label',
          type: 'String',
          indexed: true,
          removable: true
        }]
      }).execute()
    }

    Model.insertMany([
      { ctx__label: 'Adriane' },
      { ctx__label: 'Leia' },
      { ctx__label: 'Timi' },
      { ctx__label: 'Walt' },
      { ctx__label: 'Alvinia' },
      { ctx__label: 'Karlee' },
      { ctx__label: 'Fred' },
      { ctx__label: 'Arther' },
      { ctx__label: 'Ardis' },
      { ctx__label: 'Jessika' },
      { ctx__label: 'Jess' },
      { ctx__label: 'Collete' },
      { ctx__label: 'Walt' }
    ]).execute()

    OO.insertOne({
      label: ooName,
      name: ooName,
      context: {
        _id: Model.find().limit(1).next()._id,
        object: contextObject
      },
      cascadeDelete: true,
      expiresAt: Date.now() + (1000 * 60 * 15),
      listOptions: {
        implicitCreateAccessLevel: 'delete',
        writeThrough: true,
        updateOnWriteThrough: false,
        grant: 'update'
      },
      properties: [{
        label: 'String',
        name: 'c_string',
        type: 'String',
        indexed: true,
        writable: true
      }]
    }).bypassCreateAcl(true).execute()

    for (let site of Model.find()) {
      OO.updateOne({ name: ooName }, {
        $push: [{
          c_string: site.ctx__label
        }]
      })
        .pathPrefix('list')
        .execute()
    }
  }))

  after(sandboxed(function() {
    org.objects.objects.deleteOne({ name: 'c_ctxapi_607' }).execute()
  }))

  it('should support output object as source on exports', async function() {
    let exportExecuted,
        filename,
        exportId = await promised(null, sandboxed(function() {
          /* global org */
          return org.objects.exports.insertOne({
            label: 'o_ctxapi_607',
            objects: 'o_ctxapi_607',
            exportFiles: false,
            zipFiles: false,
            format: 'application/json'
          }).lean(true).execute()

        }))
    await waitUntilWorkerEnds()

    exportExecuted = await promised(null, sandboxed(function() {
      /* global script, org */
      /* eslint-disable node/no-deprecated-api */
      return org.objects.exports.find().pathRead(`${script.arguments.instanceId}`)
    },
    {
      runtimeArguments: {
        instanceId: exportId
      }
    }))

    should.exist(exportExecuted)
    should.equal(exportExecuted.object, 'export')
    should.equal(exportExecuted.state, 'ready')
    should.equal(exportExecuted.label, 'o_ctxapi_607')
    should.equal(exportExecuted.objects, 'o_ctxapi_607')
    should.equal(exportExecuted.zipFiles, false)
    should.equal(exportExecuted.exportFiles, false)
    should.equal(exportExecuted.format, 'application/json')
    should.equal(exportExecuted.stats.docs.count, 13)
    should.equal(exportExecuted.dataFile.state, 2)
    should.equal(exportExecuted.dataFile.mime, 'application/zip')
    filename = exportExecuted.dataFile.filename
    should.equal(filename.substr(filename.lastIndexOf('.') + 1), 'json')
  })

})
