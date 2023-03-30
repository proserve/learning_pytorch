'use strict'

const { isSet, deserializeObject, serializeObject } = require('../../../../utils'),
      pathTo = require('../../../../classes/pather').sandbox,
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      sandboxScriptSessionVariable = '__script__',
      { IncomingMessage } = require('http'),
      { isFunction } = require('underscore')

function getSession(script) {
  const ac = script && script.ac,
        req = ac && ac.req
  return req instanceof IncomingMessage ? req.session : null
}

module.exports = {

  version: '1.0.0',

  get: function(script, message, path, callback) {

    let value
    const session = getSession(script)

    if (session && session[sandboxScriptSessionVariable]) {
      try {
        const container = deserializeObject(session[sandboxScriptSessionVariable])
        if (isSet(path)) {
          path = path.toString().trim()
        }
        value = path ? pathTo(container, path) : container

      } catch (err) {}
    }
    callback(null, value)

  },

  set: function(script, message, path, value, callback) {

    const session = getSession(script)

    let serialized, container

    if (session) {

      if (session[sandboxScriptSessionVariable]) {
        try {
          container = deserializeObject(session[sandboxScriptSessionVariable])
        } catch (err) {
          void err
        }
      }

      if (!container) {
        container = {}
      }

      try {

        if (isSet(path)) {
          path = path.toString().trim()
        }
        if (path) {
          pathTo(container, path, value)
        } else if (!isSet(value)) {
          container = {}
        } else {
          container = value
        }

      } catch (err) {
        return callback(err)
      }

      try {
        serialized = serializeObject(container)
      } catch (err) {
        return callback(err)
      }

      const limit = config('sandbox.limits.sessionStorageMaxBytes')
      if (serialized.length > limit) {
        return callback(Fault.create('cortex.tooLarge.unspecified', { reason: 'Breached maximum sandbox session storage limit of ' + limit + ' bytes by ' + (serialized.length - limit) }))
      }

      session[sandboxScriptSessionVariable] = serialized

    }
    callback()

  }

}

Object.values(module.exports).forEach(fn => {
  if (isFunction(fn)) {
    fn.$trace = fn.$stats = false
  }
})
