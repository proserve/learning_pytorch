const server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      loadScript = require('../../../lib/script.loader'),
      modules = require('../../../../lib/modules'),
      acl = require('../../../../lib/acl'),
      { promised } = require('../../../../lib/utils'),
      should = require('should')

describe('Expressions - Runtime Jobs', function() {

  before(async() => {
    const jobScript = loadScript('CTXAPI-661_RuntimeJob.js')
    await promised(null, sandboxed(function() {
      /* global script, org */
      const cache = require('cache')

      cache.set('661_job_is_on', false)

      org.objects.scripts.insertOne({
        label: 'CTXAPI-661 JobScript Library',
        name: 'c_ctxapi_661_jobscript_lib',
        description: 'Library for Jobs',
        type: 'library',
        script: script.arguments.jobScript,
        configuration: {
          export: 'c_ctxapi_661_jobscript_lib'
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
    const cache = require('cache')

    org.objects.scripts.deleteOne({ name: 'c_ctxapi_661_jobscript_lib' }).execute()
    cache.set('661_job_is_on', undefined)

  }))

  it('should run a runtime job if condition evaluates to true', async() => {

    const runtimeJob = await promised(null, sandboxed(function() {
      const cache = require('cache')
      cache.set('661_job_is_on', true)
      return org.read('runtime')
        .jobs
        .find(j => j.name === 'c_ctxapi661_job_conditional')
    }))

    return new Promise((resolve, reject) => {
      const handler = (message, err, result) => {
        if (message.worker === 'job-script-runner' && message.name === 'test-org.script#type(library).name(c_ctxapi_661_jobscript_lib).@job 7:2') {
          server.events.removeListener('worker.done', handler)
          if (err) {
            return reject(err)
          }
          modules.cache.get(server.org, 'CTXAPI-661-hello', (err, result) => {
            try {
              if (!err) {
                should.equal(result, 'hello from job ctx661')
              }
            } catch (e) {
              err = e
            }
            err ? reject(err) : resolve()
          })
        }
      }
      modules.workers.runScheduledJob(
        new acl.AccessContext(server.principals.admin).org,
        runtimeJob.metadata.resource
      )
      server.events.on('worker.done', handler)
    })
  })

  it('should not run a runtime job if condition evaluates false', async() => {

    const runtimeJob = await promised(null, sandboxed(function() {
      const cache = require('cache')
      cache.set('661_job_is_on', false)
      return org.read('runtime')
        .jobs
        .find(j => j.name === 'c_ctxapi661_job_conditional')
    }))

    return new Promise((resolve, reject) => {
      const handler = (message, err, result) => {
        if (message.worker === 'job-script-runner' && message.name === 'test-org.script#type(library).name(c_ctxapi_661_jobscript_lib).@job 7:2') {
          if (!err) {
            try {
              server.events.removeListener('worker.done', handler)
              should.not.exist(err)
              should.not.exist(result)
            } catch (e) {
              err = e
            }
          }
          err ? reject(err) : resolve()
        }
      }
      modules.workers.runScheduledJob(
        new acl.AccessContext(server.principals.admin).org,
        runtimeJob.metadata.resource
      )
      server.events.on('worker.done', handler)
    })
  })
})
