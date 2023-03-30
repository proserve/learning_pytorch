'use strict'

const sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      server = require('../../../lib/server'),
      { promised, sleep } = require('../../../../lib/utils'),
      { counters } = require('../../../../lib/modules')

describe('Issues - CTXAPI-1246 - Deleted property counters', function() {

  it('should clean up counters when properties are removed.', async function() {

    async function createObject() {
      return sandboxed(function() {
        const modelName = 'c_ctxapi_1246'
        return global.org.objects.objects.insertOne({
          label: modelName,
          name: modelName,
          defaultAcl: 'owner.delete',
          createAcl: 'account.public',
          objectTypes: [
            {
              label: 'One',
              name: 'c_one'
            },
            {
              label: 'Two',
              name: 'c_two'
            }
          ]
        }).execute()
      })()
    }

    async function deleteObject() {
      return sandboxed(function() {
        return global.org.objects.objects.deleteOne({ name: 'c_ctxapi_1246' }).execute()
      })()
    }

    async function setProperties() {
      return sandboxed(function() {
        global.org.objects.objects.updateOne({
          name: 'c_ctxapi_1246'
        }, {
          $push: {
            properties: [
              { label: 'Prop', name: 'c_number_increment', type: 'Number', writable: false, defaultValue: { type: 'env', value: 'increment' } },
              {
                label: 'DocArray',
                name: 'c_doc_array',
                array: true,
                type: 'Document',
                properties: [
                  { label: 'Prop', name: 'c_number_increment', type: 'Number', writable: false, defaultValue: { type: 'env', value: 'increment' } }
                ]
              },
              {
                label: 'Doc',
                name: 'c_sub_doc',
                array: false,
                type: 'Document',
                properties: [
                  { label: 'Prop', name: 'c_number_increment', type: 'Number', writable: false, defaultValue: { type: 'env', value: 'increment' } }
                ]
              }
            ],
            objectTypes: [{
              name: 'c_one',
              properties: [
                {
                  label: 'Prop',
                  name: 'c_inc',
                  type: 'Number',
                  defaultValue: {
                    type: 'env',
                    value: 'increment'
                  }
                }
              ]
            }, {
              name: 'c_two',
              properties: [
                {
                  label: 'Prop',
                  name: 'c_inc',
                  type: 'Number',
                  defaultValue: {
                    type: 'env',
                    value: 'increment'
                  }
                }
              ]
            }]
          }
        })
          .execute()
      })()
    }

    async function testCounterValues(runIndex = 0) {
      return sandboxed(function() {
        const should = require('should'),
              {
                org: {
                  objects: {
                    c_ctxapi_1246: Model
                  }
                },
                script: {
                  arguments: {
                    runIndex
                  }
                }
              } = global,
              insertedIds = [{
                type: 'c_one',
                c_doc_array: [{}]
              }, {
                type: 'c_two',
                c_doc_array: [{}]
              }, {
                type: 'c_one',
                c_doc_array: [{}]
              }, {
                type: 'c_two',
                c_doc_array: [{}]
              }].map(doc => Model.insertOne(doc).execute()), // maintain insertion order
              docs = Model.find({ _id: { $in: insertedIds } }).sort({ _id: 1 }).paths('c_inc', 'c_number_increment', 'c_doc_array.c_number_increment', 'c_sub_doc.c_number_increment').toArray(),
              at = index => docs[index],
              idx = (value, add = 4) => (value + (runIndex * add))

        should.equal(at(0).c_inc, idx(1, 2))
        should.equal(at(1).c_inc, idx(1, 2))
        should.equal(at(2).c_inc, idx(2, 2))
        should.equal(at(3).c_inc, idx(2, 2))

        should.equal(at(0).c_number_increment, idx(1))
        should.equal(at(1).c_number_increment, idx(2))
        should.equal(at(2).c_number_increment, idx(3))
        should.equal(at(3).c_number_increment, idx(4))

        should.equal(at(0).c_doc_array[0].c_number_increment, idx(1))
        should.equal(at(1).c_doc_array[0].c_number_increment, idx(2))
        should.equal(at(2).c_doc_array[0].c_number_increment, idx(3))
        should.equal(at(3).c_doc_array[0].c_number_increment, idx(4))

        should.equal(at(0).c_sub_doc.c_number_increment, idx(1))
        should.equal(at(1).c_sub_doc.c_number_increment, idx(2))
        should.equal(at(2).c_sub_doc.c_number_increment, idx(3))
        should.equal(at(3).c_sub_doc.c_number_increment, idx(4))

      }, {
        runtimeArguments: {
          runIndex
        }
      })()
    }

    async function waitForWorker(worker, fn) {

      let err,
          done = false

      const testId = server.mochaCurrentTestUuid,
            handler = (message, e) => {
              if (message.mochaCurrentTestUuid === testId) {
                if (message.worker === worker) {
                  done = true
                }
                err = e
              }
            }
      server.events.on('worker.done', handler)
      await fn()
      while (!err && !done) { // eslint-disable-line no-unmodified-loop-condition
        await sleep(25)
      }
      server.events.removeListener('worker.done', handler)
      if (err) {
        throw err
      }
    }

    await createObject()
    await setProperties()
    await testCounterValues(0)
    await testCounterValues(1)

    // delete property and ensure counters are in order. counters are removed immediately.
    await waitForWorker('property-reaper', sandboxed(function() {
      global.org.objects.objects.updateOne(
        { name: 'c_ctxapi_1246' },
        { $pull: { 'objectTypes.c_one.properties': ['c_inc'] } }
      ).execute()
    }))

    should.equal(4, await promised(counters, 'get', null, `number.increment.${server.org._id}.c_ctxapi_1246#c_two.c_inc`))
    should.equal(false, await promised(counters, 'has', null, `number.increment.${server.org._id}.c_ctxapi_1246#c_one.c_inc`))

    // add it back in and increment until we reach parity
    await sandboxed(function() {
      global.org.objects.objects.updateOne(
        { name: 'c_ctxapi_1246' },
        {
          $push: {
            objectTypes: [{
              name: 'c_one',
              properties: [
                {
                  label: 'Prop',
                  name: 'c_inc',
                  type: 'Number',
                  defaultValue: {
                    type: 'env',
                    value: 'increment'
                  }
                }
              ]
            }]
          }
        }
      ).execute()
    })()
    should.equal(1, await promised(counters, 'next', null, `number.increment.${server.org._id}.c_ctxapi_1246#c_one.c_inc`))
    should.equal(2, await promised(counters, 'next', null, `number.increment.${server.org._id}.c_ctxapi_1246#c_one.c_inc`))
    should.equal(3, await promised(counters, 'next', null, `number.increment.${server.org._id}.c_ctxapi_1246#c_one.c_inc`))
    should.equal(4, await promised(counters, 'next', null, `number.increment.${server.org._id}.c_ctxapi_1246#c_one.c_inc`))

    await testCounterValues(2)

    // remove them all
    await waitForWorker('property-reaper', sandboxed(function() {
      const { org: { objects: { Objects } } } = global
      Objects.updateOne(
        { name: 'c_ctxapi_1246' },
        { $pull: {
          'objectTypes.c_one.properties': ['c_inc'],
          'objectTypes.c_two.properties': ['c_inc'],
          'properties': ['c_number_increment', 'c_doc_array', 'c_sub_doc']
        } }
      ).execute()
    }))

    should.equal(false, await promised(counters, 'has', null, `number.increment.${server.org._id}.c_ctxapi_1246#c_one.c_inc`))
    should.equal(false, await promised(counters, 'has', null, `number.increment.${server.org._id}.c_ctxapi_1246#c_two.c_inc`))
    should.equal(false, await promised(counters, 'has', null, `number.increment.${server.org._id}.c_ctxapi_1246.c_number_increment`))
    should.equal(false, await promised(counters, 'has', null, `number.increment.${server.org._id}.c_ctxapi_1246.c_sub_doc.c_number_increment`))
    should.equal(false, await promised(counters, 'has', null, `number.increment.${server.org._id}.c_ctxapi_1246.c_doc_array[].c_number_increment`))

    await setProperties()
    await testCounterValues(0)

    await waitForWorker('instance-reaper', deleteObject)

    should.equal(false, await promised(counters, 'has', null, `number.increment.${server.org._id}.c_ctxapi_1246#c_one.c_inc`))
    should.equal(false, await promised(counters, 'has', null, `number.increment.${server.org._id}.c_ctxapi_1246#c_two.c_inc`))
    should.equal(false, await promised(counters, 'has', null, `number.increment.${server.org._id}.c_ctxapi_1246.c_number_increment`))
    should.equal(false, await promised(counters, 'has', null, `number.increment.${server.org._id}.c_ctxapi_1246.c_sub_doc.c_number_increment`))
    should.equal(false, await promised(counters, 'has', null, `number.increment.${server.org._id}.c_ctxapi_1246.c_doc_array[].c_number_increment`))

    await createObject()
    await setProperties()
    await testCounterValues(0)
    await testCounterValues(1)

  })

})
