'use strict'

require('should')

/* global script, org */

const server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      should = require('should'),
      { v4 } = require('uuid'),
      { sleep, promised, isSet, equalIds } = require('../../../lib/utils'),
      sandboxed = require('../../lib/sandboxed')

describe('CTXAPI-322 - Headless Cursors', function() {

  afterEach(sandboxed(function() {
    if (org.objects.objects.find({ name: 'c_ctxapi_322_restart' }).count() === 1) {
      org.objects.objects.deleteOne({ name: 'c_ctxapi_322_restart' }).execute()
    }
    if (org.objects.oos.find().skipAcl().grant('read').count() > 0) {
      org.objects.oos.deleteMany().skipAcl().grant(8).execute()
    }
  }))

  it('simple headless aggregation', async function() {

    let op
    const cacheKey = `ctxapi-322-${v4()}`,
          cacheValue = 'ctxapi-322'

    op = await promised(null, sandboxed(function() {

      const { arguments: { cacheKey, cacheValue } } = script

      return org.objects.bulk()
        .add(

          // add a bogus projection to run headless
          org.objects.org.aggregate()
            .limit(1)
            .project({
              num: new Array(100).fill({ $number: 1 })
            })
            .unwind('num')
            .transform(
              {
                memo: {
                  cacheKey,
                  cacheValue
                },
                autoPrefix: true,
                script: `
                  // @todo. allow memos without bulk operations requiring a transform.
                  // here, add a stub just so the original memo will be picked up and we can
                  // pass along memo.cacheKey to the onComplete async handler below.                                            
                  afterAll(memo) {                                                   
                    memo.onCompleteCacheValue = memo.cacheValue                                             
                  }`
              })
        )

        // set an onComplete handler to be called when the async operation completes.
        .async({
          onComplete: `         
              
            const { arguments: {
                      operation,
                      err, // should be null
                      memo: { cacheKey, onCompleteCacheValue } } } = script,
                  cache = require('cache')
                                                              
            cache.set(cacheKey, onCompleteCacheValue)                        
          `
        }).next()

    }, {
      runtimeArguments: {
        cacheKey,
        cacheValue
      }
    }))

    op = modules.runtime.db.findOne({ uuid: op.uuid }).export()
    op.type.should.equal('db.bulk')

    while (1) {
      const cached = await promised(modules.cache, 'get', server.org, cacheKey)
      if (isSet(cached)) {
        cached.should.equal(cacheValue)
        break
      }
      await sleep(10)
    }

  })

  it('catch a headless error', async function() {

    const cacheKey = `ctxapi-322-${v4()}`

    await promised(null, sandboxed(function() {

      const { arguments: { cacheKey } } = script

      return org.objects.bulk()
        .add(

          // bad option
          org.objects.org.aggregate().limit(99999999999)

        )

        // handle error
        .async({
          onComplete: `                                
            const { arguments: { err } } = script,
                  cache = require('cache')
                                                              
            cache.set('${cacheKey}', err.errCode)                        
          `
        }).next()

    }, {
      runtimeArguments: {
        cacheKey
      }
    }))

    while (1) {
      const cached = await promised(modules.cache, 'get', server.org, cacheKey)
      if (isSet(cached)) {
        cached.should.equal('cortex.invalidArgument.query')
        break
      }
      await sleep(10)
    }

  })

  it('locking headless cursor should restart', async function() {

    let reportId, result

    const modelName = `c_ctxapi_322_restart`,
          outputName = `o_ctxapi_322_restart`,
          lockName = `c_ctxapi_322_lock_restart`,
          startedCacheKey = `c_ctxapi_322_started_restart`,
          restartedCacheKey = `c_ctxapi_322_restarted_restart`,
          completedCacheKey = `c_ctxapi_322_completed_restart`,
          totalItems = 100

    // create the parent definition and a report.
    reportId = await promised(null, sandboxed(function() {

      const { modelName, outputName } = script.arguments,
            {
              [modelName]: ReportModel,
              objects: Objects,
              oo: OutputObjects
            } = org.objects

      Objects.insertOne({
        label: modelName,
        name: modelName,
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'Report Data',
          name: 'c_report',
          type: 'String'
        }]
      }).lean(false).execute()

      // create a report instance. This will act as the parent context for the output object definition
      let reportId = ReportModel.insertOne({ c_report: outputName }).execute()

      // create an ephemeral output definition to receive intermediary data.
      OutputObjects.insertOne({
        label: outputName,
        name: outputName,

        // the parent context is required
        context: {
          _id: reportId,
          object: modelName
        },

        // setting this means that if the parent context is ever deleted, all output objects will also be cleand up.
        cascadeDelete: true,

        // clean up in case something went wrong and we could not delete the instance.
        // 15 minutes should be plenty of time for this stream to end.
        expiresAt: Date.now() + (1000 * 60 * 15),

        // List offers dynamic options, meaning the embedded 'list' of output instance data can be configured here
        listOptions: {

          // this is the level of access to the output _definition_ required to create instances without a bypassCreateAcl
          // wrapper. This makes it easy for the definition owner to create instances through the list.
          implicitCreateAccessLevel: 'delete',

          // allow write through but don't slow things down with lots of sideband updates on the definition.
          // note: readThrough is always true in an OO list property.
          writeThrough: true,
          updateOnWriteThrough: false,

          // since this is an ephemeral output object that won't be read from anywhere else, lets give
          // lots of access here to anyone who can access the list property itself.
          grant: 'update'

        },

        // the intermediary properties themselves. the initial stage will write data into these.
        // we're going to index both of these properties to illustrate using then in aggregations for the final read.
        properties: [{
          label: 'Increment',
          name: 'c_increment',
          type: 'Number',
          indexed: true,
          writable: false,
          defaultValue: {
            type: 'env', value: 'increment'
          }
        }, {
          label: 'Random',
          name: 'c_random',
          type: 'Number',
          indexed: true,
          writable: true
        }]
      }).bypassCreateAcl(true).execute()

      return reportId

    }, {
      runtimeArguments: {
        modelName,
        outputName
      }
    }))

    // with the output definition created, fire a bulk operation that, when restarted, will restart the operation.
    result = await promised(null, sandboxed(function() {

      const { modelName, outputName, reportId, lockName, startedCacheKey, restartedCacheKey, completedCacheKey, totalItems } = script.arguments,
            { sleep } = require('debug'),
            cache = require('cache'),
            {
              bulk
            } = org.objects,
            memo = {
              index: 0,
              total: totalItems,
              modelName,
              outputName,
              reportId
            },
            runBulk = () => {
              return bulk()
                .add(

                  // project phony records
                  org.objects.org.aggregate()
                    .limit(1)
                    .project({
                      num: new Array(memo.total).fill({ $number: 1 })
                    })
                    .unwind('num')
                    .transform({
                      memo,
                      autoPrefix: true,
                      script: `                                                       
                        beforeAll(memo) {      
                          require('cache').set('${startedCacheKey}', true)                                                                                                                   
                          org.objects[memo.outputName].deleteMany({_id: {$exists: true}}).skipAcl(true).grant('delete').execute()
                        }
                        each(object, memo, { cursor }) {                                                                                
                          org.objects.OOs.updateOne({
                            name: memo.outputName
                          },
                          {
                            $push: [{
                              c_random: this.randomInt(0, memo.total)
                            }]
                          }
                        )
                        .pathPrefix('list')
                        .execute()                                                                                                                                 
                      }                  
                      randomInt(min, max) {
                        min = Math.ceil(min)
                        max = Math.floor(max)
                        return Math.floor(Math.random() * (max - min + 1)) + min
                      }`
                    }),
                  { wrap: false }
                )
                .async({
                  lock: {
                    name: lockName,
                    restart: true,
                    onSignal: `           
                      if (script.arguments.signal === 'restart') {              
                        require('cache').set('${restartedCacheKey}', true)
                      }`
                  },
                  onComplete: `
                   require('cache').set('${completedCacheKey}', true)                
                `
                }).next()
            }

      let first, second

      // run the bulk operation
      first = runBulk()

      while (!cache.get(startedCacheKey)) {
        sleep(10)
      }

      // run it again. this time, the _id should not be there.
      second = runBulk()

      return {
        first,
        second
      }

    }, {
      runtimeArguments: {
        modelName,
        outputName,
        reportId,
        lockName,
        startedCacheKey,
        restartedCacheKey,
        completedCacheKey,
        totalItems
      }
    }))

    should.exist(result.first.lock._id)
    should.not.exist(result.second.lock._id)

    while (1) {
      const cached = await promised(modules.cache, 'get', server.org, restartedCacheKey)
      if (isSet(cached)) {
        cached.should.equal(true)
        break
      }
      await sleep(10)
    }

    while (1) {
      const cached = await promised(modules.cache, 'get', server.org, completedCacheKey)
      if (isSet(cached)) {
        cached.should.equal(true)
        break
      }
      await sleep(10)
    }

    result = await promised(null, sandboxed(function() {
      const { outputName } = script.arguments
      return org.objects.oos.find().pathPrefix(`${outputName}/list`).toArray().length
    }, {
      runtimeArguments: {
        outputName
      }
    }))

    should.equal(result, totalItems)

  })

  it('should throw lock exists error when attempting to acquire an existing lock with restart=false', async function() {
    let reportId, result, error

    const modelName = `c_ctxapi_322_restart`,
          outputName = `o_ctxapi_322_restart`,
          lockName = `c_ctxapi_322_lock_restart`,
          restartedCacheKey = `c_ctxapi_322_restarted_restart`,
          completedCacheKey = `c_ctxapi_322_completed_restart`,
          totalItems = 100

    // create the parent definition and a report.
    reportId = await promised(null, sandboxed(function() {

      const { modelName, outputName } = script.arguments,
            {
              [modelName]: ReportModel,
              objects: Objects,
              oo: OutputObjects
            } = org.objects

      Objects.insertOne({
        label: modelName,
        name: modelName,
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'Report Data',
          name: 'c_report',
          type: 'String'
        }]
      }).lean(false).execute()

      let reportId = ReportModel.insertOne({ c_report: outputName }).execute()

      OutputObjects.insertOne({
        label: outputName,
        name: outputName,
        context: {
          _id: reportId,
          object: modelName
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
          indexed: true
        }]
      }).bypassCreateAcl(true).execute()

      return reportId
    }, {
      runtimeArguments: {
        modelName,
        outputName
      }
    }))

    try {
      result = await promised(null, sandboxed(function() {

        const { modelName, outputName, reportId, lockName, restartedCacheKey, completedCacheKey, totalItems } = script.arguments,
              { sleep } = require('debug'),
              {
                bulk
              } = org.objects,
              memo = {
                index: 0,
                total: totalItems,
                modelName,
                outputName,
                reportId
              },
              runBulk = () => {
                return bulk()
                  .add(
                    org.objects.org.aggregate()
                      .limit(1)
                      .project({
                        num: new Array(memo.total).fill({ $number: 1 })
                      })
                      .unwind('num')
                      .transform({
                        memo,
                        autoPrefix: true,
                        script: `                                                       
                        beforeAll(memo) {                                                                                                                         
                          org.objects[memo.outputName].deleteMany({_id: {$exists: true}}).skipAcl(true).grant('delete').execute()
                        }
                        each(object, memo, { cursor }) {                                                                                
                          org.objects.OOs.updateOne({
                            name: memo.outputName
                          },
                          {
                            $push: [{
                              c_string: 'The number is: ' + this.randomInt(0, memo.total)
                            }]
                          }
                        )
                        .pathPrefix('list')
                        .execute()                                                                                                                                 
                      }                  
                      randomInt(min, max) {
                        min = Math.ceil(min)
                        max = Math.floor(max)
                        return Math.floor(Math.random() * (max - min + 1)) + min
                      }`
                      }),
                    { wrap: false }
                  )
                  .async({
                    lock: {
                      name: lockName,
                      restart: false,
                      onSignal: `
                      if (script.arguments.signal === 'restart') {              
                        require('cache').set('${restartedCacheKey}', true)
                      }`
                    },
                    onComplete: `
                   require('cache').set('${completedCacheKey}', true)                
                `
                  }).next()
              }

        let first, second
        first = runBulk()
        sleep(10)
        second = runBulk()

        return {
          first,
          second
        }
      }, {
        runtimeArguments: {
          modelName,
          outputName,
          reportId,
          lockName,
          restartedCacheKey,
          completedCacheKey,
          totalItems
        }
      }))
    } catch (e) {
      error = e
    }

    should.exist(error)
    should.not.exist(result)

    should.equal(error.name, 'error')
    should.equal(error.errCode, 'cortex.conflict.lockExists')
    should.equal(error.reason, 'Lock exists.')
    should.equal(error.statusCode, 409)
    should.equal(/env.operation.bulk.test-org.c_ctxapi_322_lock_restart'@\w*/.test(error.resource), true)

    while (1) {
      const cached = await promised(modules.cache, 'get', server.org, completedCacheKey)
      if (isSet(cached)) {
        cached.should.equal(true)
        break
      }
      await sleep(10)
    }
  })

  it('should cancel an operation gracefully', async function() {
    let reportId, result, op

    const modelName = `c_ctxapi_322_restart`,
          outputName = `o_ctxapi_322_restart`,
          lockName = `c_ctxapi_322_lock_restart`,
          restartedCacheKey = `c_ctxapi_322_restarted_restart`,
          completedCacheKey = `c_ctxapi_322_completed_restart`,
          totalItems = 100

    // create the parent definition and a report.
    reportId = await promised(null, sandboxed(function() {

      const { modelName, outputName } = script.arguments,
            {
              [modelName]: ReportModel,
              objects: Objects,
              oo: OutputObjects
            } = org.objects

      Objects.insertOne({
        label: modelName,
        name: modelName,
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'Report Data',
          name: 'c_report',
          type: 'String'
        }]
      }).lean(false).execute()

      let reportId = ReportModel.insertOne({ c_report: outputName }).execute()

      OutputObjects.insertOne({
        label: outputName,
        name: outputName,
        context: {
          _id: reportId,
          object: modelName
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
          indexed: true
        }]
      }).bypassCreateAcl(true).execute()

      return reportId
    }, {
      runtimeArguments: {
        modelName,
        outputName
      }
    }))

    op = await promised(null, sandboxed(function() {

      const { modelName, outputName, reportId, completedCacheKey, totalItems } = script.arguments,
            {
              bulk
            } = org.objects,
            memo = {
              index: 0,
              total: totalItems,
              modelName,
              outputName,
              reportId
            }

      return bulk()
        .add(
          org.objects.org.aggregate()
            .limit(1)
            .project({
              num: new Array(memo.total).fill({ $number: 1 })
            })
            .unwind('num')
            .transform({
              memo,
              autoPrefix: true,
              script: `
                each(object, memo, { cursor }) {
                  require('debug').sleep(100)
                }
              `
            }),
          { wrap: false }
        )
        .async({
          onComplete: `
             require('cache').set('${completedCacheKey}', true)
            `
        }).next()

    }, {
      runtimeArguments: {
        modelName,
        outputName,
        reportId,
        lockName,
        restartedCacheKey,
        completedCacheKey,
        totalItems
      }
    }))

    should.exist(op)
    should.exist(op._id)
    should.exist(op.uuid)
    should.exist(op.lock)
    should.not.exist(op.lock._id)
    should.equal(op.type, 'db.bulk')
    should.equal(op.cancelled, false)
    should.equal(op.state, 'started')
    should.equal(op.async, true)

    // We'll see if we can find the operation
    op = await promised(null, sandboxed(function() {
      const { arguments: { uuid } } = script,
            { operations: { find } } = require('runtime')

      return find({ uuid })
    }, {
      runtimeArguments: {
        uuid: op.uuid
      }
    }))

    should.exist(op)
    should.equal(op.length, 1)
    should.exist(op[0]._id)
    should.exist(op[0].uuid)
    should.exist(op[0].lock)
    should.not.exist(op[0].lock._id)
    should.equal(op[0].type, 'db.bulk')
    should.equal(op[0].cancelled, false)
    should.equal(op[0].state, 'started')
    should.equal(op[0].async, true)

    // Now we cancel the op
    result = await promised(null, sandboxed(function() {
      const { arguments: { uuid } } = script,
            { operations: { cancel } } = require('runtime')

      return cancel({ uuid })
    }, {
      runtimeArguments: {
        uuid: op[0].uuid
      }
    }))

    should.exist(result)
    should.equal(result.length, 1)
    should.equal(result[0].uuid, op[0].uuid)
    should.equal(true, equalIds(result[0]._id, op[0]._id))
    should.equal(result[0].type, 'db.bulk')
    should.equal(result[0].cancelled, true)
    should.equal(result[0].state, 'stopping')
    should.equal(result[0].async, true)
  })
})
