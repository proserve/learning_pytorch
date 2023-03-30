'use strict'

const server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      { sleep, promised } = require('../../../lib/utils'),
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

describe('Issues - CTXAPI-673 Import/Export when non localized object definition', function() {

  let legacyAuditHistoryValues

  before(async() => {

    await sandboxed(function() {

      /* global org */

      org.objects.objects.insertOne({
        name: 'ctxapi__673_ref',
        label: 'ctxapi__673_ref',
        createAcl: 'account.public',
        defaultAcl: 'owner.delete'
      }).execute()

      org.objects.objects.insertOne({
        name: 'ctxapi__673',
        label: 'ctxapi__673',
        createAcl: 'account.public',
        defaultAcl: 'owner.delete',
        properties: [{
          label: 'c_ref',
          name: 'c_ref',
          type: 'Reference',
          history: true,
          sourceObject: 'ctxapi__673_ref'
        }]
      }).execute()

    })()

    legacyAuditHistoryValues = await getLegacyAuditHistoryValues()

  })

  after(async() => {

    await setLegacyAuditHistoryValues(legacyAuditHistoryValues)

  })

  it('reference history should exist', async() => {

    let _id, ref1, ref2, result

    await setLegacyAuditHistoryValues(false)

    ;[_id, ref1, ref2] = await sandboxed(function() {
      const { ctxapi__673_ref: RefModel, ctxapi__673: Model } = org.objects,
            ref1 = RefModel.insertOne({}).execute(),
            ref2 = RefModel.insertOne({}).execute(),
            _id = Model.insertOne({ c_ref: ref1 }).execute()

      Model.updateOne({ _id }, { $set: { c_ref: ref2 } }).execute()
      return [_id, ref1, ref2]

    })()

    await processHistory()

    result = await sandboxed(function() {
      /* global script */
      return org.objects.History.find({ 'context._id': script.arguments._id }).sort({ 'context.sequence': 1 }).skipAcl().grant('script').toArray()
    }, { runtimeArguments: { _id } })()

    // current document values.
    should(result[0].document.c_ref._id.toString()).equal(ref1.toString())
    should(result[1].document.c_ref._id.toString()).equal(ref2.toString())

    // ops
    result[0].ops[0].path.should.equal('c_ref._id')
    should(result[0].ops[0].value).be.undefined() // new behaviour, value is undefined when there is no previous value
    result[1].ops[0].path.should.equal('c_ref._id')
    result[1].ops[0].value.toString().should.equal(ref1.toString())

  })

})
