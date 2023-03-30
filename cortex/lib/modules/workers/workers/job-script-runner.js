'use strict'

const Worker = require('../worker'),
      util = require('util'),
      acl = require('../../../acl'),
      ap = require('../../../access-principal'),
      modules = require('../../../modules'),
      consts = require('../../../consts'),
      { promised, equalIds } = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config')

function JobScriptRunner() {
  Worker.call(this)
}

util.inherits(JobScriptRunner, Worker)

async function assertJobCanRun(org) {

  if (!org.configuration.scripting.scriptsEnabled) {
    throw Fault.create('cortex.accessDenied.scriptsDisabled')
  }

  const { Stat: { collection } } = modules.db.models,
        startingPeriod = new Date(Date.now() - 86400000),
        endingPeriod = new Date(Date.now()),
        maxJobs = Math.max(config('sandbox.limits.minAllowedJobRunsPerDay'), org.configuration.scripting.maxJobRunsPerDay)

  startingPeriod.setMinutes(0, 0, 0)
  endingPeriod.setMinutes(59, 59, 999)

  let results = await collection.aggregate([{
    $match: {
      org: org._id,
      code: consts.stats.sources.scripts,
      scriptType: 'job',
      starting: { $gte: startingPeriod },
      ending: { $lte: endingPeriod }
    }
  }, {
    $group: {
      _id: null,
      count: { $sum: '$count' }
    }
  }], { cursor: {} }).toArray()

  if (results && results[0] && results[0].count > maxJobs) {
    throw Fault.create('cortex.accessDenied.maxJobsPerDay')
  }

}

/**
 * @param message
 * @param payload
 * @param options
 * @param callback
 * @private
 */
JobScriptRunner.prototype._process = function(message, payload, options, callback) {

  modules.db.models.Org.loadOrg(message.org || payload.org, (err, org) => {

    if (err) {
      return callback()
    }

    const { req } = message

    let ac,
        poolScript

    Promise.resolve(null)
      .then(async() => {

        void message
        void payload
        void options

        let principal,
            scriptModel

        const { script: scriptIdentifier } = payload,
              runtime = await org.getRuntime(),
              { jobs } = runtime,
              job = jobs.find(job => {
                if (equalIds(job.metadata.scriptId, scriptIdentifier)) { // legacy payload.script === _id
                  return true
                } else if (job.metadata.resource === scriptIdentifier) {
                  return true
                }

              })

        if (!job) {
          throw Fault.create('cortex.notFound.script', { resource: scriptIdentifier })
        }

        principal = await promised(
          ap,
          'create',
          org,
          job.principal || acl.AnonymousIdentifier
        )
        ac = new acl.AccessContext(principal, null, { req })

        // check for conditions before max jobs check.
        if (await modules.sandbox.fulfillsConditions(ac, job, { runtime })) { // { parentScript, context, runtimeArguments } - none here

          await assertJobCanRun(org)

          scriptModel = await modules.sandbox.getRuntimeModel(org, runtime, job)

          // capture pool script instance for possible error logging
          return new Promise((resolve, reject) => {
            modules.sandbox.executeModel(
              ac,
              null,
              scriptModel,
              { runtime },
              {},
              (err, { results, script } = {}) => {
                poolScript = script
                err ? reject(err) : resolve(results)
              })
          })

        }

      })
      .then(
        results => callback(null, results)
      )
      .catch(err => {

        // don't requeue jobs
        modules.db.models.Log.logApiErr(
          'scripts',
          err,
          ac || new acl.AccessContext(ap.synthesizeAnonymous(org), null, { req: message.req }),
          poolScript
        )

        callback(null)
      })

  })

}

module.exports = JobScriptRunner
