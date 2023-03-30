'use strict'

const utils = require('../../../../utils'),
      _ = require('underscore'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      cookieParser = require('cookie-parser')(config('sessions.secret')),
      blacklistedHeaders = new Set(),
      allowedScriptTypes = ['policy', 'route', 'transform', 'trigger'],
      { IncomingMessage, OutgoingMessage } = require('http')

blacklistedHeaders.add('access-control-allow-origin')
blacklistedHeaders.add('connection')
blacklistedHeaders.add('date')
blacklistedHeaders.add('proxy-authenticate')
blacklistedHeaders.add('public-key-pins')
blacklistedHeaders.add('server')
blacklistedHeaders.add('set-cookie')
blacklistedHeaders.add('strict-transport-security')
blacklistedHeaders.add('trailer')
blacklistedHeaders.add('tsv')
blacklistedHeaders.add('upgrade')
blacklistedHeaders.add('vary')
blacklistedHeaders.add('via')
blacklistedHeaders.add('warning')

function isAllowedScriptType(type) {
  return allowedScriptTypes.includes(type)
}

function getRequest(script) {
  const ac = script && script.ac,
        req = ac && ac.req
  return (req instanceof IncomingMessage) ? req : null
}

function getResponse(script) {
  const req = getRequest(script),
        res = req && req.res
  return (res instanceof OutgoingMessage) ? res : null
}

function setHeader(script, message, header, value) {

  const res = getResponse(script)
  if (res) {
    if (!isAllowedScriptType(script.configuration.type) || value === undefined) {
      return false
    }
    if (res.headersSent) {
      throw Fault.create('script.error.headersWritten')
    }
    if (!_.isString(header) || !(header = header.trim().toLowerCase())) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid response header name: ' + header })
    }
    if (blacklistedHeaders.has(header) || header.indexOf('medable-') === 0 || header.indexOf('md-') === 0) {
      throw Fault.create('cortex.accessDenied.unspecified', { reason: 'Header ' + header + ' cannot be set.' })
    }
    res.setHeader(header, value)
  }
  return !!res

}

module.exports = {

  version: '1.0.0',

  setHeader: async function(script, message, header, value) {

    return setHeader(script, message, header, value)

  },

  setHeaders: async function(script, message, headers) {

    for (const [header, value] of Array.isArray(headers) ? headers : Object.entries(headers || {})) {
      setHeader(script, message, header, value)
    }

    void 0

  },

  setStatusCode: function(script, message, statusCode, callback) {

    const res = getResponse(script)
    if (res) {
      if (!isAllowedScriptType(script.configuration.type)) {
        return callback(null, false)
      }
      if (res.headersSent) {
        return callback(Fault.create('script.error.headersWritten'))
      }
      res.statusCode = utils.clamp(utils.rInt(statusCode, 200), 100, 999)
    }
    callback(null, !!res)

  },

  writeContinue: async function(script) {

    const res = getResponse(script)
    if (res) {
      res.writeContinue()
    }
    return !!res
  },

  write: function(script, message, buffer, callback) {

    callback = _.once(callback)

    let err, result
    try {
      if (!isAllowedScriptType(script.configuration.type)) {
        return callback(null, false)
      }
      result = script.writeToResponseBuffer(buffer)
    } catch (e) {
      err = e
    }
    callback(err, result)

  },

  end: function(script, message, buffer, callback) {

    callback = _.once(callback)

    let err, result
    try {
      if (!isAllowedScriptType(script.configuration.type)) {
        return callback(null, false)
      }
      result = script.endResponse(buffer)
    } catch (e) {
      err = e
    }
    callback(err, result)

  },

  clearCookie: function(script, message, name, options, callback) {

    const params = {
      name: name,
      value: null,
      signed: utils.option(options, 'signed'),
      secure: utils.option(options, 'secure'),
      maxAge: utils.option(options, 'maxAge'),
      httpOnly: utils.option(options, 'httpOnly')
    }
    _setCookie(script, params, callback)
  },

  setCookie: function(script, message, name, value, options, callback) {

    const params = {
      name: name,
      value: value,
      signed: utils.option(options, 'signed'),
      secure: utils.option(options, 'secure'),
      maxAge: utils.option(options, 'maxAge'),
      httpOnly: utils.option(options, 'httpOnly')
    }
    _setCookie(script, params, callback)
  }
}

module.exports.write.$trace = false
module.exports.write.$stats = false

function _setCookie(script, params, callback) {

  const req = utils.path(script, 'ac.req'),
        res = utils.path(req, 'res'),
        name = utils.rString(params.name, '').trim()

  if (!res || !_.isFunction(res.cookie)) {
    return callback(null, false)
  }

  if (res.headersSent) {
    return callback(Fault.create('script.error.headersWritten'))
  }

  if (!name) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing cookie name' }))
  }

  if (name.toLowerCase().indexOf('md') === 0 || name.toLowerCase().indexOf('medable') === 0) {
    return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'md and medable cookies are reserved.' }))
  }

  cookieParser(req, req.res, function(err) {

    if (err) {
      return callback(err)
    }

    try {

      const configuration = {
              signed: utils.rBool(params.signed, false),
              path: '/' + req.orgCode,
              secure: utils.rBool(params.secure, false),
              httpOnly: utils.rBool(params.httpOnly, false)
            },
            // defaults to browser session cookie
            maxAge = utils.rInt(params.maxAge, null)
      if (maxAge !== null) {
        configuration.maxAge = maxAge
      }

      if (params.value === null || params.value === undefined) {
        res.clearCookie(name, configuration)
      } else {
        res.cookie(name, String(params.value), configuration)
      }

    } catch (e) {
      err = e
    }
    callback(err, true)

  })

}
