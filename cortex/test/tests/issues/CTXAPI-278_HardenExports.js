'use strict'

/* global script, org */

require('should')

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      { db, workers, storage } = require('../../../lib/modules'),
      { AccessContext } = require('../../../lib/acl'),
      { getServer, createLocationConfiguration, fileExistsInBucket } = require('../../lib/s3rver'),
      { promised, sleep } = require('../../../lib/utils')

describe('Issues - CTXAPI-278 - Better exports', function() {

  // admin level settings to allow custom locations.
  let enableLocations
  before(function(callback) {
    enableLocations = server.org.configuration.storage.enableLocations
    db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.storage.enableLocations': true } }, () => {
      server.updateOrg(callback)
    })
  })
  after(function(callback) {
    db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.storage.enableLocations': enableLocations } }, () => {
      server.updateOrg(callback)
    })
  })

  // create a custom storage location
  before(async() => {

    const principal = server.principals.admin

    await promised(null, sandboxed(function() {

      const { arguments: { location } } = script,
            { Objects } = org.objects

      org.push('configuration.storage.locations', location)
      org.update('configuration.storage.exportLocation', 'any')

      Objects.insertOne({
        label: 'c_ctxapi_278',
        name: 'c_ctxapi_278',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'file',
          name: 'c_file',
          type: 'File',
          processors: [{
            allowUpload: true,
            label: 'Content',
            maxFileSize: 1000000,
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

    }, {
      principal,
      runtimeArguments: {
        location: createLocationConfiguration('c_ctxapi_278')
      }
    }))

    // fire up the local s3 server
    await getServer()

    // update the org with the new location
    await promised(server, 'updateOrg')

  })

  it('create an export at the local custom location, using real aws for intermediate files.', async() => {

    // create an instance with a file.
    let fileDoc, exportDoc, done = false, err = null

    const testId = server.mochaCurrentTestUuid,
          handler = (message, e) => {
            if (message.mochaCurrentTestUuid === testId) {
              if (message.worker === 'exporter') {
                done = true
              }
              err = e
            }
          }

    fileDoc = await createTestFile({ purge: true })

    server.events.on('worker.done', handler)

    // export instances
    exportDoc = await promised(null, sandboxed(function() {
      const { Export } = org.objects
      return Export.insertOne({
        label: 'c_ctxapi_278',
        format: 'text/csv',
        exportFiles: true,
        objects: 'c_ctxapi_278s',
        storageId: 'c_ctxapi_278'
      }).lean(false).execute()
    }))

    while (1) {
      if (err || done) {
        break
      }
      await sleep(250)
    }
    server.events.removeListener('worker.done', handler)

    if (err) {
      throw err
    }

    exportDoc = await promised(null, sandboxed(function() {
      const { Export } = org.objects,
            { arguments: { exportId } } = script
      return Export.readOne({ _id: exportId }).execute()
    }, {
      runtimeArguments: {
        exportId: exportDoc._id
      }
    }))

    // check for the datafile
    fileExistsInBucket(`/${server.org._id}/exports/${exportDoc._id}/${exportDoc.dataFile.filename.replace('.csv', '.zip')}`).should.equal(true)

    // check for the file data
    fileExistsInBucket(`/${server.org._id}/exports/${exportDoc._id}/files/0000000000.c_ctxapi_278s.${fileDoc._id}.c_file.content`).should.equal(true)

  })

  it('simulate an orphaned export in the runnning stage and allow maintenance to restart it', async() => {

    let exportDoc, fileSz, done = false, err = null

    await createTestFile({ purge: true })

    const testId = server.mochaCurrentTestUuid,
          onStart = (instance) => {
            if (instance.message.mochaCurrentTestUuid === testId) {
              instance.message.cancel()
            }
          },
          onDone = (message, e) => {
            if (message.mochaCurrentTestUuid === testId) {
              if (message.worker === 'exporter') {
                done = true
              }
              err = e
            }
          }

    server.events.on('export.running', onStart)
    server.events.on('worker.done', onDone)

    // export instances.
    exportDoc = await promised(null, sandboxed(function() {
      const { Export } = org.objects
      return Export.insertOne({
        label: 'c_ctxapi_278',
        objects: 'c_ctxapi_278s'
      }).lean(false).execute()
    }))

    // the message will be cancelled and the export left in a running state.
    while (1) {
      if (err || done) {
        break
      }
      await sleep(250)
    }

    server.events.removeListener('export.running', onStart)

    if (err) {
      throw err
    }

    exportDoc = await promised(null, sandboxed(function() {
      const { Export } = org.objects,
            { arguments: { exportId } } = script
      return Export.readOne({ _id: exportId }).execute()
    }, {
      runtimeArguments: {
        exportId: exportDoc._id
      }
    }))

    done = false

    exportDoc.state.should.equal('error')

    // trick export maintenance into running against the export by updating its start time to at least 10 minutes in the past
    await promised(db, 'sequencedUpdate', db.models.Export, { _id: exportDoc._id }, { $set: { state: 'running', started: new Date(Date.now() - (60000 * 10)) } })

    // run export-maintenance and wait for the export to restart.
    workers.runNow('export-maintenance')

    done = false

    while (1) {
      if (err || done) {
        break
      }
      await sleep(250)
    }

    server.events.removeListener('worker.done', onDone)

    if (err) {
      throw err
    }

    exportDoc = await promised(null, sandboxed(function() {
      const { Export } = org.objects,
            { arguments: { exportId } } = script
      return Export.readOne({ _id: exportId }).execute()
    }, {
      runtimeArguments: {
        exportId: exportDoc._id
      }
    }))

    exportDoc.state.should.equal('ready')

    // check for the datafile
    fileSz = await promised(storage.create(null, exportDoc.dataFile, new AccessContext(server.principals.admin)), 'getSize')
    fileSz.should.be.greaterThan(0)

  })

})

async function createTestFile({ purge = false } = {}) {

  let doc, done = false, err = null

  const testId = server.mochaCurrentTestUuid,
        handler = (message, e) => {
          if (message.mochaCurrentTestUuid === testId) {
            if (message.worker === 'media-processor') {
              done = true
            }
            err = e
          }
        }

  server.events.on('worker.done', handler)

  doc = await promised(null, sandboxed(function() {

    const { c_ctxapi_278: Model } = org.objects,
          { arguments: { purge } } = script

    if (purge) {
      Model.deleteMany().execute()
    }

    return Model.insertOne({
      c_file: { content: { buffer: new Buffer('foo'), filename: 'bar.txt' } } // eslint-disable-line node/no-deprecated-api
    }).lean(false).execute()
  }, {
    runtimeArguments: { purge }
  }))

  while (1) {
    if (err || done) {
      break
    }
    await sleep(250)
  }
  server.events.removeListener('worker.done', handler)

  if (err) {
    throw err
  }

  return doc

}
