'use strict'

const should = require('should'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      sandboxed = require('../../lib/sandboxed'),
      { promised, sleep } = require('../../../lib/utils'),
      loadScript = require('../../lib/script.loader'),
      acl = require('../../../lib/acl')

// TODO: refine the log search to not depend on the order
describe('Issues - CTXAPI-802 avoid overlapping jobs', function() {

  before(async() => {
    const jobScript = loadScript('CTXAPI-802_OverlappingJob.js')
    await promised(null, sandboxed(function() {
      /* global org,script */
      org.objects.scripts.insertOne({
        label: 'CTXAPI-802 Overlapping Job Library',
        name: 'c_ctxapi_802_overlapping_job_lib',
        description: 'Library for Jobs',
        type: 'library',
        script: script.arguments.jobScript,
        configuration: {
          export: 'c_ctxapi_802_overlapping_job_lib'
        }
      }).execute()
    }, {
      runtimeArguments: {
        jobScript
      }
    }))
  })

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_802_overlapping_job_lib' }).execute()
  }))

  after((done) => {
    server.updateOrg(done)
  })

  it('check overlapping message in logs', async() => {
    const runtime = await promised(null, sandboxed(function() {
            return org.read('runtime')
          })),
          options = {
            limit: 1,
            total: false,
            where: { src: 1 }
          }

    await promised(modules.workers, 'runNow', runtime.jobs[0].metadata.resource)
    await sleep(250)
    await promised(modules.workers, 'runNow', runtime.jobs[0].metadata.resource)
    await sleep(250)
    // Do check the logs
    const result = await promised(modules.db.models.log, 'nodeList', server.principals.admin, { org: server.org._id }, options)
    result.data[0].dat.message.should.equal('skipping already running job test-org.script#type(library).name(c_ctxapi_802_overlapping_job_lib).@job 7:4')
    return true
  })

})
