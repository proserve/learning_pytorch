'use strict'

const ap = require('../../../../access-principal'),
      modules = require('../../../../modules'),
      config = require('cortex-service/lib/config'),
      utils = require('../../../../utils')

module.exports = {

  version: '1.0.0',

  currentActivity: function(script, message, callback) {

    modules.services.api.clusterGetActivity(script.ac.orgId, { verbose: true }, callback)

  },

  closeOutputStream(script, message, _id, options, callback) {

    options = options || {}

    modules.services.api.clusterCloseRequest(_id, { force: false, org: script.ac.orgId }, callback)

  },

  principal: {

    create: function(script, message, data, callback) {
      ap.create(script.ac.org, data, function(err, principal) {
        callback(err, principal ? principal.toObject() : null)
      })
    }

  },

  stats: function(script, message, payloadOptions, callback) {

    const options = utils.extend(script.allowedOptions(payloadOptions, 'where', 'map', 'group', 'sort', 'skip', 'pipeline', 'limit', 'crossOrg'), {
            req: script.ac.req,
            script,
            parserExecOptions: {
              maxTimeMS: config('query.defaultMaxTimeMS'),
              engine: payloadOptions && payloadOptions.engine,
              explain: payloadOptions && payloadOptions.explain
            }
          }),
          find = (script.ac.principal.isSysAdmin() && options.crossOrg) ? null : { org: script.ac.orgId }

    options.limit = utils.queryLimit(options.limit, script)

    modules.db.models.Stat.nodeList(script.ac.principal, find, options, function(err, docs) {
      callback(err, docs)
    })

  },

  logs: function(script, message, payloadOptions, callback) {

    const options = utils.extend(script.allowedOptions(payloadOptions, 'where', 'map', 'group', 'sort', 'skip', 'pipeline', 'limit'), {
      req: script.ac.req,
      script,
      parserExecOptions: {
        maxTimeMS: config('query.defaultMaxTimeMS'),
        engine: payloadOptions && payloadOptions.engine,
        explain: payloadOptions && payloadOptions.explain
      }
    })
    options.limit = utils.queryLimit(options.limit, script)

    modules.db.models.Log.nodeList(script.ac.principal, { org: script.ac.orgId }, options, function(err, docs) {
      callback(err, docs)
    })
  }

}
