'use strict'

/* global org, script */

const server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      { sleep, promised } = require('../../../lib/utils'),
      consts = require('../../../lib/consts'),
      should = require('should'),
      sandboxed = require('../../lib/sandboxed')

async function getLegacyAuditHistoryValues() {

  return server.org.configuration.legacyAuditHistoryValues

}

async function setLegacyAuditHistoryValues(active) {

  await promised(modules.db, 'sequencedUpdate', server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.legacyAuditHistoryValues': active } })
  await promised(server, 'updateOrg')

}

async function processHistory() {

  let workerDone = false,
      err = null

  const testId = server.mochaCurrentTestUuid,
        onDone = (message, e) => {
          if (message.mochaCurrentTestUuid === testId) {
            if (message.worker === 'history-processor') {
              workerDone = true
            }
            err = e
          }
        }

  server.events.on('worker.done', onDone)

  modules.workers.runNow('history-processor')

  while (1) {
    if (err || workerDone) {
      break
    }
    await sleep(250)
  }

  server.events.off('worker.done', onDone)

  if (err) {
    throw err
  }

}

describe('Issues - CTXAPI-655 legacyAuditHistoryValues', function() {

  let legacyAuditHistoryValues

  before(async() => {

    await sandboxed(function() {

      org.objects.objects.insertOne({
        localized: true,
        name: 'ctxapi__655',
        label: 'ctxapi__655',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'String',
          name: 'c_string',
          type: 'String',
          history: true,
          removable: true
        }, {
          label: 'String Array',
          name: 'c_string_array',
          type: 'String',
          array: true,
          history: true
        }, {
          label: 'String',
          name: 'c_string_no_history',
          type: 'String',
          history: false
        }]
      }).execute()

    })()

    legacyAuditHistoryValues = await getLegacyAuditHistoryValues()

  })

  after(async() => {

    await setLegacyAuditHistoryValues(legacyAuditHistoryValues)

  })

  it('insert legacyAuditHistoryValues', async() => {

    async function insertTest() {
      return sandboxed(function() {
        const { ctxapi__655: Model } = org.objects,
              _id = Model.insertOne().execute()
        Model.updateOne({ _id }, { $set: { c_string: 'ABC' } }).execute()
        Model.updateOne({ _id }, { $set: { c_string: 'DEF' } }).execute()
        Model.updateOne({ _id }, { $set: { c_string: 'DEF' } }).execute()
        Model.updateOne({ _id }, { $set: { c_string: 'DEF', c_string_no_history: 'abc' } }).execute()
        Model.updateOne({ _id }, { $set: { c_string: 'DEF', c_string_no_history: 'def' } }).execute()
        return _id
      })()
    }

    let _id, result

    await setLegacyAuditHistoryValues(true)

    _id = await insertTest()

    await processHistory()

    result = await sandboxed(function() {
      return org.objects.History.find({ 'context._id': script.arguments._id }).sort({ 'context.sequence': 1 }).skipAcl().grant('script').toArray()
    }, { runtimeArguments: { _id } })()

    // current document values.
    should(result[0].document.c_string).equal('ABC')
    should(result[1].document.c_string).equal('DEF')
    should(result[2].document.c_string).equal('DEF')
    should(result[3].document.c_string).equal('DEF')

    // ops
    result[0].ops[0].path.should.equal('c_string')
    result[0].ops[0].value.should.equal('ABC') // legacy sets initial value if undefined.
    result[1].ops[0].path.should.equal('c_string')
    result[1].ops[0].value.should.equal('ABC') // previous value is indeed ABC.
    result[2].ops[0].path.should.equal('c_string')
    result[2].ops[0].value.should.equal('DEF') // previous value is indeed ABC.
    result[3].ops[0].path.should.equal('c_string')
    result[3].ops[0].value.should.equal('DEF') // previous value is indeed ABC.

    await setLegacyAuditHistoryValues(false)

    _id = await insertTest()

    await processHistory()

    result = await sandboxed(function() {
      return org.objects.History.find({ 'context._id': script.arguments._id }).sort({ 'context.sequence': 1 }).skipAcl().grant('script').toArray()
    }, { runtimeArguments: { _id } })()

    // current document values.
    should(result[0].document.c_string).equal('ABC')
    should(result[1].document.c_string).equal('DEF')
    should(result[2].document.c_string).equal('DEF')
    should(result[3].document.c_string).equal('DEF')

    // ops
    result[0].ops[0].path.should.equal('c_string')
    should(result[0].ops[0].value).be.undefined() // new behaviour, value is undefined when there is no previous value
    result[1].ops[0].path.should.equal('c_string')
    result[1].ops[0].value.should.equal('ABC') // previous value is indeed ABC.
    result[2].ops[0].path.should.equal('c_string')
    result[2].ops[0].value.should.equal('DEF') // previous value is indeed ABC.
    result[3].ops[0].path.should.equal('c_string')
    result[3].ops[0].value.should.equal('DEF') // previous value is indeed ABC.

  })

  it('unset legacyAuditHistoryValues', async() => {

    async function unsetTest() {
      return sandboxed(function() {
        const { ctxapi__655: Model } = org.objects,
              _id = Model.insertOne().execute()
        Model.updateOne({ _id }, { $set: { c_string: 'ABC' } }).execute()
        Model.updateOne({ _id }, { $unset: { c_string: 1 } }).execute()
        return _id
      })()
    }

    let _id, result

    await setLegacyAuditHistoryValues(true)

    _id = await unsetTest()

    await processHistory()

    result = await sandboxed(function() {
      return org.objects.History.find({ 'context._id': script.arguments._id }).sort({ 'context.sequence': 1 }).skipAcl().grant('script').toArray()
    }, { runtimeArguments: { _id } })()

    // current document values.
    should(result[0].document.c_string).equal('ABC')
    result[1].document.deleted.should.containEql('c_string')
    should(result[1].document.c_string).be.undefined()

    // ops
    result[0].ops[0].path.should.equal('c_string')
    result[0].ops[0].value.should.equal('ABC') // legacy sets initial value if undefined.
    result[1].ops[0].path.should.equal('c_string')
    result[1].ops[0].value.should.equal('ABC') // previous value is indeed ABC.
    result[1].ops[0].type.should.equal(consts.audits.operations.remove) // previous value is indeed ABC.

    await setLegacyAuditHistoryValues(false)

    _id = await unsetTest()

    await processHistory()

    result = await sandboxed(function() {
      return org.objects.History.find({ 'context._id': script.arguments._id }).sort({ 'context.sequence': 1 }).skipAcl().grant('script').toArray()
    }, { runtimeArguments: { _id } })()

    // current document values.
    should(result[0].document.c_string).equal('ABC')
    result[1].document.deleted.should.containEql('c_string')
    should(result[1].document.c_string).be.undefined()

    // ops
    result[0].ops[0].path.should.equal('c_string')
    should(result[0].ops[0].value).be.undefined() // new behaviour, value is undefined when there is no previous value
    result[1].ops[0].path.should.equal('c_string')
    result[1].ops[0].value.should.equal('ABC') // previous value is indeed ABC.
    result[1].ops[0].type.should.equal(consts.audits.operations.remove) // previous value is indeed ABC.

  })

  it('pull legacyAuditHistoryValues', async() => {

    async function unsetTest() {
      return sandboxed(function() {
        const { ctxapi__655: Model } = org.objects,
              _id = Model.insertOne().execute()
        Model.updateOne({ _id }, { $set: { c_string_array: ['1'] } }).execute()
        Model.updateOne({ _id }, { $set: { c_string_array: ['2'] } }).execute()
        return _id
      })()
    }

    let _id, result

    await setLegacyAuditHistoryValues(true)

    _id = await unsetTest()

    await processHistory()

    result = await sandboxed(function() {
      return org.objects.History.find({ 'context._id': script.arguments._id }).sort({ 'context.sequence': 1 }).skipAcl().grant('script').toArray()
    }, { runtimeArguments: { _id } })()

    // current document values.
    should(result[0].document.c_string_array[0]).equal('1')
    should(result[1].document.c_string_array[0]).equal('2')

    // ops
    result[0].ops[0].path.should.equal('c_string_array')
    result[0].ops[0].value.should.equal('1')
    result[0].ops[0].type.should.equal(consts.audits.operations.push)
    result[1].ops.length.should.equal(2)
    result[1].ops[0].path.should.equal('c_string_array')
    result[1].ops[0].value.should.equal('1')
    result[1].ops[0].type.should.equal(consts.audits.operations.pull)
    result[1].ops[1].path.should.equal('c_string_array')
    result[1].ops[1].value.should.equal('2')
    result[1].ops[1].type.should.equal(consts.audits.operations.push)

    await setLegacyAuditHistoryValues(false)

    _id = await unsetTest()

    await processHistory()

    result = await sandboxed(function() {
      return org.objects.History.find({ 'context._id': script.arguments._id }).sort({ 'context.sequence': 1 }).skipAcl().grant('script').toArray()
    }, { runtimeArguments: { _id } })()

    // current document values.
    should(result[0].document.c_string_array[0]).equal('1')
    should(result[1].document.c_string_array[0]).equal('2')

    // ops
    result[0].ops[0].path.should.equal('c_string_array')
    result[0].ops[0].value.should.equal('1')
    result[0].ops[0].type.should.equal(consts.audits.operations.push)
    result[1].ops.length.should.equal(2)
    result[1].ops[0].path.should.equal('c_string_array')
    result[1].ops[0].value.should.equal('1')
    result[1].ops[0].type.should.equal(consts.audits.operations.pull)
    result[1].ops[1].path.should.equal('c_string_array')
    result[1].ops[1].value.should.equal('2')
    result[1].ops[1].type.should.equal(consts.audits.operations.push)

  })

})
