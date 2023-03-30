'use strict'

const _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      IterableCursor = require('../../../../classes/iterable-cursor'),
      ap = require('../../../../access-principal'),
      acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      { option: getOption, queryLimit, extend, getIdOrNull } = require('../../../../utils')

function gate(script) {

  if (config('app.env') === 'production' && !script.ac.principal.isOrgAdmin()) {
    throw Fault.create('cortex.invalidArgument.accessDenied')
  } else if (!script.ac.principal.isDeveloper()) {
    throw Fault.create('cortex.invalidArgument.accessDenied')
  }

}

module.exports = config('app.env') !== 'development' ? undefined : {

  version: '1.0.0',

  sessions: {

    logout: function(script, message, account, callback) {

      ap.create(script.ac.org, account, (err, principal) => {
        if (err) {
          return callback(err)
        }
        modules.sessions.logoutAccounts(principal._id, script.ac.orgId, callback)
      })

    }

  },

  locations: {

    list: function(script, message, payloadOptions, callback) {

      gate(script)

      const options = extend(script.allowedOptions(payloadOptions, 'where', 'map', 'group', 'sort', 'skip', 'pipeline', 'limit'), {
              req: script.ac.req,
              script,
              parserExecOptions: {
                maxTimeMS: config('query.defaultMaxTimeMS')
              },
              grant: acl.AccessLevels.Script
            }),
            find = { org: script.ac.orgId }

      options.limit = queryLimit(options.limit, script)

      modules.db.models.Location.nodeList(script.ac.principal, find, options, function(err, docs) {
        callback(err, docs)
      })

    },

    remove: function(script, message, _id, callback) {

      gate(script)

      const { ac: { orgId: org } } = script

      _id = getIdOrNull(_id)

      if (!_id) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid locationId' })
      }

      modules.db.models.Location.collection.findOneAndDelete({ org, _id }, function(err, result) {

        const doc = result && result.value
        if (!err && !doc) {
          err = Fault.create('cortex.notFound.unspecified')
        }
        if (err) {
          return callback(err)
        }
        modules.db.models.Callback.deleteMany({ handler: consts.callbacks.ver_location, targetId: doc.accountId, 'data.locationId': _id }, function(err) {
          callback(err, doc)
        })
      })

    }

  },

  environment: {

    /**
     *
     * @param script
     * @param message
     * @param options
     *  manifest
     *  preferUrls
     *  silent
     *  package
     * @param callback
     */
    export: function(script, message, options, callback) {

      gate(script)

      const environmentOptions = _.pick(options || {}, 'manifest', 'preferUrls', 'silent', 'package')

      modules.developer.exportEnvironment(script.ac, environmentOptions, (err, cursor) => {
        callback(err, cursor)
      })

    },

    /**
     *
     * @param script
     * @param message
     * @param payload
     * @param options
     *  backup: default false
     *  triggers: default false
     *  production: default false
     * @param callback
     * @returns {*}
     */
    import: function(script, message, payload, options, callback) {

      gate(script)

      const environmentOptions = {
              backup: getOption(options, 'backup'),
              triggers: getOption(options, 'triggers'),
              production: getOption(options, 'production')
            },
            cursor = script.getCursor(payload),
            array = Array.isArray(payload) && payload

      if (!array && !cursor) {
        return callback(Fault.create('cortex.invalidArgument.cursorOrArrayExpected'))
      }

      modules.developer.importEnvironment(
        script.ac,
        new IterableCursor({
          iterable: cursor || array
        }),
        environmentOptions,
        (err, cursor) => {
          callback(err, cursor)
        }
      )

    }

  }

}
