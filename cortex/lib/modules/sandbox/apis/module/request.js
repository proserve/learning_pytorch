'use strict'

const { rString, rVal } = require('../../../../utils'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      cookieParser = require('cookie-parser')(config('sessions.secret')),
      { IncomingMessage } = require('http')

function getRequest(script) {
  const ac = script && script.ac,
        req = ac && ac.req
  return (req instanceof IncomingMessage) ? req : null
}

function getMemoApi(script) {
  const req = getRequest(script)
  return req && req.memo.getScriptApi()
}

module.exports = {

  version: '1.0.0',

  getCookie: function(script, message, name, callback) {

    const req = getRequest(script)
    if (!req) {
      return callback(null, null)
    }

    name = rString(name, '').trim()
    if (!name) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing cookie name' }))
    }

    if (name.toLowerCase().indexOf('md') === 0 || name.toLowerCase().indexOf('medable') === 0) {
      return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'md and medable cookies are reserved.' }))
    }

    cookieParser(req, req.res, function(err) {
      if (err) {
        callback(err)
      } else {
        let value
        if (req.cookies) {
          value = req.cookies[name]
        }
        if ((value === null || value === undefined) && req.signedCookies) {
          value = req.signedCookies[name]
        }
        callback(null, rVal(value, null))
      }
    })

  },

  memo: {

    get: function(script, message, path, callback) {

      const api = getMemoApi(script)
      callback(null, api && api.get(script, message, path, callback))
    },

    set: function(script, message, path, value, callback) {

      const api = getMemoApi(script)
      callback(null, api && api.set(script, message, path, value, callback))
    }

  }

}
