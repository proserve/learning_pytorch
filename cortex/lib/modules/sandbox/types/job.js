'use strict'

const BaseScriptType = require('./base'),
      util = require('util'),
      cronParser = require('cron-parser'),
      { rNum, isValidDate, matchesEnvironment, array: toArray } = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      later = require('later'),
      { pick, findIndex } = require('underscore')

function JobScriptType() {
  BaseScriptType.call(this)
}

util.inherits(JobScriptType, BaseScriptType)

JobScriptType.prototype.parseResources = async function(ac, doc, { includeSelf = true } = {}) {

  const resources = await BaseScriptType.prototype.parseResources.call(this, ac, doc)

  if (includeSelf) {
    resources.push({
      metadata: {
        runtime: false,
        scriptId: doc._id,
        scriptHash: doc.compiledHash,
        resource: `${ac.org.code}.${ac.getResource()}`,
        requires: doc.requires,
        roles: [],
        serviceAccounts: doc.serviceAccounts
      },
      ...pick(doc, 'active', 'type', 'label', 'name', 'principal', 'environment', 'weight', 'if'),
      configuration: pick(doc.configuration, 'cron')
    })
  }

  return resources
}

JobScriptType.prototype.buildRuntime = async function(ac, runtime, scripts) {

  // look for jobs and order them by script.weight.
  // if there are any with matching names, store only the one with a higher script.weight.
  for (const script of scripts) {

    const jobs = toArray(script.resources).filter(doc => doc.type === 'job')

    for (const insert of jobs) {

      if (insert.active && matchesEnvironment(insert.environment)) {

        const pos = findIndex(runtime.jobs, v => v.name && insert.name && v.name === insert.name),
              existing = runtime.jobs[pos]

        if (!existing) {
          runtime.jobs.push(insert)
        } else {

          if (rNum(insert.weight, 0) > rNum(existing.weight, 0)) {
            runtime.jobs.splice(pos, 1, insert)
          }
        }
      }

    }

  }

}

JobScriptType.prototype.getTypeProperties = function() {

  return [{
    label: 'Cron',
    name: 'cron',
    type: 'String',
    writable: true,
    trim: true,
    validators: [{
      name: 'required'
    }, {
      name: 'adhoc',
      definition: {
        message: 'A valid schedule in cron format.',
        validator: function(ac, node, cron) {

          const parts = String(cron).split(' ')
          let parsed, schedule
          if (parts.length === 5) {
            try {
              cronParser.parseExpression(cron) // to guard against possible cron parsing bugs in later.js
              parsed = later.parse.cron(cron, false)
              schedule = later.schedule(parsed)
            } catch (e) {}
          }
          if (schedule && schedule.isValid()) {
            // simplistic validation for catch obvious errors for scheduling too many in a day.
            const maxJobs = Math.max(config('sandbox.limits.minAllowedJobRunsPerDay'), ac.org.configuration.scripting.maxJobRunsPerDay),
                  occurrences = schedule.next(maxJobs + 1),
                  first = occurrences[0],
                  last = occurrences[occurrences.length - 1]
            if (occurrences.length === maxJobs + 1 && isValidDate(last)) {
              if (last - first < 86400000) {
                throw Fault.create('cortex.accessDenied.maxJobsPerDay')
              }
            }

            return true
          }
          return false

        }
      }
    }]
  }]
}

module.exports = JobScriptType
