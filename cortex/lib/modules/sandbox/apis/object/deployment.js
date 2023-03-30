
'use strict'

const Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      async = require('async'),
      modules = require('../../../../modules'),
      utils = require('../../../../utils'),
      crypto = require('crypto')

function encrypt(data) {
  const cipher = crypto.createCipher('aes256', config('sessions.secret'))
  return cipher.update(JSON.stringify(data), 'utf8', 'base64') + cipher.final('base64')
}

function decrypt(data) {
  const decipher = crypto.createDecipher('aes256', config('sessions.secret'))
  return JSON.parse(decipher.update(data, 'base64', 'utf8') + decipher.final('utf8'))
}

function isSupportLogin(script) {
  return script.ac.option('deployment.isSupportLogin') || script.ac.principal.isSupportLogin
}

module.exports = {

  instance: {

    /**
         *
         * @param script
         * @param message
         * @param _id
         * @param options
         *   email
         *   password
         *   loginAs for support login
         *   token <-- auth token
         *
         * @param callback
         * @returns {*}
         */
    authenticate: function(script, message, _id, options, callback) {
      if (!script.ac.principal.isOrgAdmin()) {
        return callback(Fault.create('cortex.accessDenied.role'))
      }
      try {
        modules.deployment.sourceCheck(script.ac.org)
      } catch (err) {
        return callback(err)
      }

      options = script.allowedOptions(options, 'email', 'password', 'loginAs', 'token')
      options.isSupportLogin = isSupportLogin(script)

      modules.deployment.authWithTarget(script.ac.principal, _id, options, (err, deploymentSession) => {
        if (!err) {
          deploymentSession = encrypt(deploymentSession)
        }
        callback(err, deploymentSession)
      })
    },

    refreshMappings: function(script, message, _id, callback) {
      if (!script.ac.principal.isOrgAdmin()) {
        return callback(Fault.create('cortex.accessDenied.role'))
      }
      try {
        modules.deployment.sourceCheck(script.ac.org)
      } catch (err) {
        return callback(err)
      }
      modules.deployment.refreshMappings(script.ac, _id, function(err, doc) {
        callback(err, utils.path(doc, 'mappings'))
      })

    },

    updateMappings: function(script, message, _id, token, callback) {
      if (!script.ac.principal.isOrgAdmin()) {
        return callback(Fault.create('cortex.accessDenied.role'))
      }
      try {
        modules.deployment.sourceCheck(script.ac.org)
        token = decrypt(token)
      } catch (err) {
        return callback(err)
      }
      modules.deployment.updateMappings(script.ac, _id, { token: token }, function(err, doc) {
        callback(err, utils.path(doc, 'mappings'))
      })
    },

    guessMappings: function(script, message, _id, token, options, callback) {

      if (!script.ac.principal.isOrgAdmin()) {
        return callback(Fault.create('cortex.accessDenied.role'))
      }
      try {
        modules.deployment.sourceCheck(script.ac.org)
      } catch (err) {
        return callback(err)
      }

      options = script.allowedOptions(options, 'force')

      async.waterfall([
        callback => {
          module.exports.instance.refreshMappings(script, message, _id, err => callback(err))
        },
        callback => {
          module.exports.instance.updateMappings(script, message, _id, token, (err, mappings) => callback(err, mappings))
        },
        (mappings, callback) => {

          try {
            mappings = mappings.map(mapping => {
              if (mapping.targets.length > 1 && !options.force) {
                throw Fault.create('cortex.invalidArgument.ambiguousDeploymentMapping', { path: `${mapping.type}.${mapping._id.toString()}` })
              }
              return {
                _id: mapping._id,
                target: mapping.targets.length === 0 ? consts.emptyId : mapping.targets[0]._id
              }
            })
          } catch (err) {
            return callback(err)
          }

          modules.db.models.deployment.aclUpdatePath(script.ac.principal, _id, 'mappings', mappings, { method: 'put', req: script.ac.req }, err => {
            callback(err, mappings)
          })
        }

      ], callback)

    },

    deploy: function(script, message, _id, token, options, callback) {

      options = script.allowedOptions(options, 'session', 'payload')

      if (!script.ac.principal.isOrgAdmin()) {
        return callback(Fault.create('cortex.accessDenied.role'))
      }
      try {
        modules.deployment.sourceCheck(script.ac.org)
        token = decrypt(token)
      } catch (err) {
        return callback(err)
      }

      modules.deployment.deploy(script.ac, _id, { token: token, userdata: { session: options.session, payload: options.payload } }, function(err, lastRunId) {
        callback(err, lastRunId)
      })

    },

    logs: function(script, message, _id, token, options, callback) {

      if (!script.ac.principal.isOrgAdmin()) {
        return callback(Fault.create('cortex.accessDenied.role'))
      }
      try {
        modules.deployment.sourceCheck(script.ac.org)
        token = decrypt(token)
      } catch (err) {
        return callback(err)
      }

      options = utils.extend(script.allowedOptions(options, 'skip', 'limit', 'runId'), {
        token
      })

      modules.deployment.logs(new acl.AccessContext(script.ac.principal, null, { req: script.ac.req }), _id, options, function(err, results) {
        callback(err, results)
      })

    }

  }
}
