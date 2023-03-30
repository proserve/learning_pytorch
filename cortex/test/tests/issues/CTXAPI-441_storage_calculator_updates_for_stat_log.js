'use strict'

const sandboxed = require('../../lib/sandboxed'),
      modules = require('../../../lib/modules'),
      server = require('../../lib/server'),
      config = require('cortex-service/lib/config'),
      { promised, sleep, equalIds } = require('../../../lib/utils'),
      consts = require('../../../lib/consts'),
      { docStorage, fileStorage } = consts.operations.codes,
      moment = require('moment'),
      should = require('should')

describe('Issues - CTXAPI-441 - storage calculator updates', function() {

  before(async() => {

    await (sandboxed(
      function() {

        /* global org */

        const { Objects, Scripts } = org.objects

        Objects.insertOne({
          label: 'c_ctxapi_441',
          name: 'c_ctxapi_441',
          defaultAcl: 'owner.delete',
          createAcl: 'account.public',
          properties: [{
            label: 'file',
            name: 'c_file',
            type: 'File',
            processors: [{
              allowUpload: true,
              label: 'Content',
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

        Scripts.insertOne({
          label: 'c_ctxapi_441',
          name: 'c_ctxapi_441',
          type: 'library',
          configuration: {
            export: 'c_ctxapi_441'
          },
          script: `                  
          const { trigger } = require('decorators')                          
          class Lib {           
            @trigger('file.process.after', {object: 'c_ctxapi_441'})
            static processed() {
              const { context } = script
              require('debug').emit('c_ctxapi_441.processed', { context })                              
            }
          }          
        `
        }).execute()
      }
    )())

  })

  it('should only run a single instance of the storage calculator', async() => {

    // turn off altogether - CTXAPI-778
    return true

    // let lockDone = false, workerDone = false, err = null, lock = null, signal = null
    //
    // const testId = server.mochaCurrentTestUuid,
    //       onLock = ({ err: e, uniqueIdentifier, lock: l }) => {
    //         if (uniqueIdentifier === 'StorageCalculatorWorker') {
    //           lockDone = true
    //           err = e
    //           lock = l
    //         }
    //       },
    //       onSignal = ({ lock: l, uniqueIdentifier, signal: s }) => {
    //         if (uniqueIdentifier === 'StorageCalculatorWorker') {
    //           lockDone = true
    //           signal = s
    //           if (lock !== l) {
    //             err = err || new Error('expected signalled lock to be local lock.')
    //           }
    //         }
    //       },
    //       onRestart = ({ err: e, uniqueIdentifier, lock: l }) => {
    //         if (uniqueIdentifier === 'StorageCalculatorWorker') {
    //           err = err || e
    //           if (l) {
    //             err = new Error('expected other lock to be signalled but acquired lock.')
    //           }
    //           if (err) {
    //             lockDone = true
    //           }
    //         }
    //       },
    //       onWorkerDone = (message, e) => {
    //         if (message.mochaCurrentTestUuid === testId && message.worker === 'storage-calculator') {
    //           workerDone = true
    //           err = err || e
    //         }
    //       },
    //       { workers } = modules
    //
    // server.events.on('worker.done', onWorkerDone)
    //
    // // run and acquire lock.
    // server.events.on('lock.createOrRestart', onLock)
    // workers.runNow('storage-calculator')
    // workers.mq.poll()
    // while (!lockDone) { // eslint-disable-line no-unmodified-loop-condition
    //   await sleep(1)
    // }
    // server.events.removeListener('lock.createOrRestart', onLock)
    // should.not.exist(err)
    // should.exist(lock, 'lock should have been acquired.')
    //
    // // run and detect restart signal and that lock could not be acquired locally.
    // // if onRestart detects a lock, it sets err
    // lockDone = false
    // server.events.on('lock.createOrRestart', onRestart)
    // server.events.on('lock.signal', onSignal)
    // workers.runNow('storage-calculator')
    // workers.mq.poll()
    //
    // while (!lockDone) { // eslint-disable-line no-unmodified-loop-condition
    //   await sleep(1)
    //   if (err) {
    //     break
    //   }
    // }
    // server.events.removeListener('lock.createOrRestart', onRestart)
    // server.events.removeListener('lock.signal', onSignal)
    //
    // should.not.exist(err)
    // should.equal(signal, consts.Transactions.Signals.Restart, 'signal should be a restart.')
    //
    // while (!workerDone) { // eslint-disable-line no-unmodified-loop-condition
    //   await sleep(250)
    // }
    // server.events.removeListener('worker.done', onWorkerDone)
    // should.not.exist(err)

  })

  it('stats should record doc and facet storage additions and deletions in stats deltas, then integrate into stats.', async() => {

    // turn off altogether - CTXAPI-778
    return true

  //   let fileProcessed = false, reapDone = false, workerDone = false, err = null, doc = null, stats
  //
  //   const testId = server.mochaCurrentTestUuid,
  //         { Stat } = modules.db.models,
  //         onProcessed = ({ context } = {}) => {
  //           if (equalIds(context && context._id, doc && doc._id)) {
  //             fileProcessed = true
  //           }
  //         },
  //         onReaped = (message, e) => {
  //           if (message.mochaCurrentTestUuid === testId) {
  //             if (message.worker === 'instance-reaper') {
  //               reapDone = true
  //             }
  //             err = e
  //           }
  //         },
  //         onWorkerDone = (message, e) => {
  //           if (message.mochaCurrentTestUuid === testId && message.worker === 'storage-calculator') {
  //             workerDone = true
  //             err = err || e
  //           }
  //         },
  //         { workers } = modules,
  //         now = new Date(),
  //         starting = moment(now).utc().startOf('day').toDate(),
  //         ending = moment(now).utc().endOf('day').toDate()
  //
  //   // ----------------------------------
  //
  //   server.events.on('c_ctxapi_441.processed', onProcessed)
  //
  //   doc = await (sandboxed(function() {
  //     const { c_ctxapi_441: Model } = org.objects
  //     return Model.insertOne({
  //       c_file: { content: { buffer: new Buffer('foo'), filename: 'bar.txt' } } // eslint-disable-line node/no-deprecated-api
  //     }).lean(false).execute()
  //   })())
  //
  //   // wait for file to be processed. the script defined in before() emits() c_ctxapi_441.processed
  //   // once processed, ensure there are deltas for the current period.
  //   while (!fileProcessed) { // eslint-disable-line no-unmodified-loop-condition
  //     await sleep(250)
  //   }
  //   server.events.removeListener('c_ctxapi_441.processed', onProcessed)
  //   should.not.exist(err)
  //
  //   stats = await Stat.collection.find({
  //     code: { $in: [docStorage, fileStorage] },
  //     org: server.org._id,
  //     starting,
  //     ending,
  //     s_object: 'c_ctxapi_441',
  //     'delta.count': 1
  //   }).toArray()
  //
  //   stats.filter(v => v.code === docStorage).length.should.equal(1)
  //   stats.find(v => v.code === docStorage).delta.count.should.equal(1)
  //   stats.filter(v => v.code === fileStorage).length.should.equal(1)
  //   stats.find(v => v.code === fileStorage).delta.count.should.equal(1)
  //
  //   // ----------------------------------
  //   // delete the doc and wait until the instance reaper triggers, then re-calculate deltas.
  //   reapDone = false
  //   server.events.on('worker.done', onReaped)
  //
  //   await (sandboxed(function() {
  //
  //     /* global org, script */
  //
  //     const { c_ctxapi_441: Model } = org.objects,
  //           { doc: { _id } } = script.arguments
  //
  //     return Model.deleteOne({ _id }).execute()
  //
  //   }, {
  //     runtimeArguments: { doc }
  //   })())
  //
  //   while (!reapDone) { // eslint-disable-line no-unmodified-loop-condition
  //     await sleep(250)
  //   }
  //   server.events.removeListener('worker.done', onReaped)
  //   should.not.exist(err)
  //
  //   stats = await Stat.collection.find({
  //     code: { $in: [docStorage, fileStorage] },
  //     org: server.org._id,
  //     starting,
  //     ending,
  //     s_object: 'c_ctxapi_441',
  //     'delta.count': 0
  //   }).toArray()
  //
  //   stats.filter(v => v.code === docStorage).length.should.equal(1)
  //   stats.find(v => v.code === docStorage).delta.size.should.equal(0)
  //   stats.filter(v => v.code === fileStorage).length.should.equal(1)
  //   stats.find(v => v.code === fileStorage).delta.size.should.equal(0)
  //
  //   // ----------------------------------
  //
  //   server.events.on('worker.done', onWorkerDone)
  //
  //   workers.runNow('storage-calculator')
  //   workers.mq.poll()
  //   while (!workerDone) { // eslint-disable-line no-unmodified-loop-condition
  //     await sleep(100)
  //   }
  //   server.events.removeListener('worker.done', onWorkerDone)
  //   should.not.exist(err)
  //
  //   stats = await Stat.collection.find({
  //     code: { $in: [docStorage, fileStorage] },
  //     org: server.org._id,
  //     starting,
  //     ending,
  //     s_object: 'c_ctxapi_441',
  //     delta: { $exists: false },
  //     count: 0,
  //     size: 0
  //   }).toArray()
  //
  //   if (!config('scheduled.storage-calculator.reconcile')) {
  //
  //     stats.filter(v => v.code === docStorage).length.should.equal(0)
  //     stats.filter(v => v.code === fileStorage).length.should.equal(0)
  //
  //     await promised(Stat, 'reconcile', server.org._id)
  //
  //     stats = await Stat.collection.find({
  //       code: { $in: [docStorage, fileStorage] },
  //       org: server.org._id,
  //       starting,
  //       ending,
  //       s_object: 'c_ctxapi_441',
  //       delta: { $exists: false },
  //       count: 0,
  //       size: 0
  //     }).toArray()
  //
  //   }
  //
  //   stats.filter(v => v.code === docStorage).length.should.equal(1)
  //   stats.filter(v => v.code === fileStorage).length.should.equal(1)
  //
  })

})
