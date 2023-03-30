const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      loadScript = require('../../lib/script.loader'),
      server = require('../../lib/server'),
      acl = require('../../../lib/acl'),
      modules = require('../../../lib/modules'),
      { promised } = require('../../../lib/utils')

describe('Features -Object Script Jobs', function() {

  before(async() => {
    const jobScript = loadScript('CTXAPI-340_Jobs.js')
    await promised(null, sandboxed(function() {
      /* global script, org */
      org.objects.objects.insertOne({
        label: 'JobObject',
        name: 'c_ctxapi_340_job',
        defaultAcl: ['owner.delete'],
        createAcl: ['account.public'],
        properties: [{
          label: 'Date',
          name: 'time',
          type: 'Date',
          indexed: true
        }]
      }).execute()

      org.objects.scripts.insertOne({
        label: 'CTXAPI-340 JobScript Library',
        name: 'c_ctxapi_340_jobscript_lib',
        description: 'Library for Jobs',
        type: 'library',
        script: script.arguments.jobScript,
        configuration: {
          export: 'c_ctxapi_340_jobscript_lib'
        }
      }).execute()
    }, {
      runtimeArguments: {
        jobScript
      }
    }))
  })

  after((done) => {
    server.updateOrg(done)
  })

  after(sandboxed(function() {

    org.objects.scripts.deleteOne({ name: 'c_ctxapi_340_jobscript_lib' }).execute()
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_340_jobscript_v2_lib' }).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_340_job' }).execute()

  }))

  it('check if job run properly', async() => {

    const runtime = await promised(null, sandboxed(function() {
      return org.read('runtime')
    }))
    return new Promise((resolve, reject) => {
      const handler = (message, err, result) => {
        if (message.worker === 'job-script-runner') {
          if (err) {
            return reject(err)
          }
          try {
            server.events.removeListener('worker.done', handler)
            should.equal(result.runtime.configuration.cron, '*/1 * * * *')
            should.equal(result.runtime.metadata.className, 'JobTest')
            should.equal(result.value, 'hello from job')
            resolve()
          } catch (e) {
            reject(e)
          }
        }
      }
      modules.workers.runScheduledJob(new acl.AccessContext(server.principals.admin).org, runtime.jobs[0].metadata.resource)
      server.events.on('worker.done', handler)
    })
  })

  it('check if job gets overwritten', async() => {
    const jobScript = loadScript('CTXAPI-340_JobsOverwrite'),
          runtime = await promised(null, sandboxed(function() {
            org.objects.scripts.insertOne({
              label: 'CTXAPI-340 v2 JobScript Library',
              name: 'c_ctxapi_340_jobscript_v2_lib',
              description: 'Library for Jobs v2',
              type: 'library',
              script: script.arguments.jobScript,
              configuration: {
                export: 'c_ctxapi_340_jobscript_lib_v2'
              }
            }).execute()
            return org.read('runtime')
          }, {
            runtimeArguments: {
              jobScript
            }
          }))

    return new Promise((resolve, reject) => {
      const handler = (message, err, result) => {
        if (message.worker === 'job-script-runner') {
          if (err) {
            return reject(err)
          }
          try {
            server.events.removeListener('worker.done', handler)
            should.equal(result.runtime.configuration.cron, '*/2 * * * *')
            should.equal(result.runtime.metadata.className, 'JobTest')
            should.equal(result.value, 'hello from overwritten job')
            resolve()
          } catch (e) {
            reject(e)
          }
        }
      }
      modules.workers.runScheduledJob(new acl.AccessContext(server.principals.admin).org, runtime.jobs[0].metadata.resource)
      server.events.on('worker.done', handler)
    })
  })

})
