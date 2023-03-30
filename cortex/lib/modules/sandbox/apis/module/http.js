'use strict'

// https://github.com/whoshuu/cpr
// getaddrinfo_a for non-blocking lookup.

// @todo support ipv6
// @todo
//  cookie jar?
//  how to get form data?

const Url = require('url'),
      tls = require('tls'),
      _ = require('underscore'),
      net = require('net'),
      request = require('request'),
      { rBool, path: pathTo, rInt, rString, ip4incidr } = require('../../../../utils'),
      config = require('cortex-service/lib/config'),
      { mimeToOptions } = require('cortex-service/lib/utils/output'),
      IterableCursor = require('../../../../classes/iterable-cursor'),
      domain = require('domain'), // eslint-disable-line node/no-deprecated-api
      Fault = require('cortex-service/lib/fault'),

      MAX_HTTP_TIMEOUT = 30000,

      methods = ['get', 'head', 'patch', 'post', 'put', 'delete', 'options'],

      // @todo better hostname validator (also allow ip address),
      validHostRegExp = /\./,

      blacklistedHosts = [
        /^app(.+?.)?\.medable\.com$/i,
        'metadata.google.internal',
        'kubernetes',
        'unix'
      ],

      restrictedHosts = [
        /^api((?:(?!-ws).)+.)?\.medable\.com$/i
      ],

      blacklistedPorts = [
        [-Infinity, 79],
        [65535, Infinity]
      ],

      blacklistedHeaders = new Set([
        'accept-charset',
        'accept-encoding',
        'access-control-request-headers',
        'access-control-request-method',
        'connection',
        'content-length',
        'content-transfer-encoding',
        'cookie',
        'cookie2',
        'date',
        'expect',
        'host',
        'keep-alive',
        'origin',
        'referer',
        'te',
        'trailer',
        'transfer-encoding',
        'upgrade',
        'via'
      ]),

      // https://en.wikipedia.org/wiki/Reserved_IP_addresses
      blacklistedIpV4Ranges = [
        '0.0.0.0/8', // source-only
        '10.0.0.0/8', // non-routable
        '100.64.0.0/10', // isp / nat
        '127.0.0.0/8', // loopback
        '169.254.0.0/16', // APIPA - also happens to be an open kimono gcp internal service address (169.254.169.254)
        '172.16.0.0/12', // non-routable
        '192.0.0.0/24', // ietf protocol assignments
        '192.0.2.0/24', // TEST-NET-1
        '192.88.99.0/24', // reserved (was ipv6 -> ipv4 relay block)
        '192.168.0.0/16', // non-routable
        '198.18.0.0/15', // inter-network benchmark testing
        '198.51.100.0/24', // TEST-NET-2
        '203.0.113.0/24', // TEST-NET-3
        '224.0.0.0/4', // IP multicast
        '240.0.0.0/4', // Reserved
        '255.255.255.255/32' // Reserved for limited broadcast
      ],

      blacklistedIpV4s = new Set([
        '127.0.0.1',
        '169.254.169.254'
      ])

function testHost(test, host) {
  if (_.isRegExp(test)) {
    return test.test(host)
  }
  if (test === host) {
    return true
  }
}

function validateHost(host, script) {
  if (!(_.isString(host) && host.length > 0 && ~host.indexOf('.') && validHostRegExp.test(host))) {
    return false
  }
  for (let i = 0; i < blacklistedHosts.length; i++) {
    if (testHost(blacklistedHosts[i], host)) {
      return false
    }
  }
  if (!script.ac.org.configuration.scripting.enableRestrictedCallouts) {
    for (let i = 0; i < restrictedHosts.length; i++) {
      if (testHost(restrictedHosts[i], host)) {
        return false
      }
    }
  }
  return true
}

function validateHostIpV4Address(ip) {
  for (let i = 0; i < blacklistedIpV4Ranges.length; i++) {
    if (ip4incidr(ip, blacklistedIpV4Ranges[i])) {
      return false
    }
  }
  return !blacklistedIpV4s.has(ip)
}

function validatePort(port = null) {
  if (port !== null) {
    for (let i = 0; i < blacklistedPorts.length; i++) {
      const blacklisted = blacklistedPorts[i]
      if (Array.isArray(blacklisted)) {
        if (port >= blacklisted[0] && port <= blacklisted[1]) {
          return false
        }
      } else if (blacklisted === port) {
        return false
      }
    }
  }
  return true
}

function doCall(method, script, message, url, options, callback) {

  const done = _.once((err, result) => {
    if (err) {
      if (err.code === 'ETIMEDOUT') {
        err = Fault.create('cortex.timeout.unspecified', { reason: 'Callout timed out.' })
      }
    }
    callback(err, result)
  })

  if (script.stats.callouts++ >= script.configuration.limits.maxCallouts) {
    return done(Fault.create('cortex.accessDenied.unspecified', { reason: 'Callout limit exceeded.' }))
  }

  if (script.configuration.isInline && !script.ac.org.configuration.scripting.enableHttpInInlineTriggers) {
    return done(Fault.create('cortex.accessDenied.unspecified', { reason: 'http module is not available to inline triggers.' }))
  }

  doValidate(script, message, url, function(err, url, hostname, parsed) {

    if (err) {
      return done(err)
    }

    let req

    const d = domain.create()

    d.on('error', err => {
      done(err)
      if (req) {
        try {
          req.abort()
        } catch (e) {}
        try {
          req.destroy()
        } catch (e) {}
      }
    })
    d.run(() => {

      const asBuffer = rBool(options?.buffer, false),
            asStream = !asBuffer && rBool(options?.stream, false),
            asCursor = !asBuffer && !asStream && rBool(options?.cursor, false)

      req = performRequest(script, message, url, method, hostname, parsed, options, function(err, response, body) {

        const result = {
          ..._.pick(response || {}, 'headers', 'statusCode', 'statusMessage'),
          body
        }

        if (err) {
          done(err)
        } else if (asStream) {
          if (_.isFunction(response.pause)) {
            const stream = response
            try {
              const scriptStream = script.registerStream(stream)
              result.stream = scriptStream.toJSON()
            } catch (e) {
              err = e
              try { stream.destroy(err) } catch (e) { }
            }
          }
          done(err, result)
        } else if (asCursor) {
          IterableCursor.fromHttp(response)
            .catch(e => {
              if (err) {
                err.add(e)
              } else {
                err = e
              }
            })
            .then(cursor => {
              if (!err && cursor) {
                try {
                  const scriptCursor = script.registerCursor(cursor)
                  result.cursor = {
                    _id: scriptCursor._id,
                    object: 'cursor'
                  }
                } catch (e) {
                  err = e
                  try { cursor.close(() => {}) } catch (e) { }
                }
              }
              done(err, result)
            })
        } else {
          done(
            null,
            result
          )
        }

      })
    })
  })

}

function doValidate(script, message, url, callback) {

  let parsed

  // validate the url format
  try {
    parsed = Url.parse(String(url))
  } catch (err) {
    return callback(err)
  }

  // validate the host
  if (!parsed.hostname || !parsed.protocol) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid url format.' }))
  }

  // validate the protocol
  if (!~['http:', 'https:'].indexOf(parsed.protocol)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'unsupported protocol' }))
  }

  if (config('sandbox.debug.skipHttpHostValidation')) {
    return callback(null, url, parsed.hostname, parsed.hostname, parsed)
  }

  // validate the host against obvious baddies.
  if (!validateHost(parsed.hostname, script)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `access to host is prohibited (${parsed.hostname})` }))
  }

  // validate the host port
  if (!validatePort(parsed.port)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `access to port is prohibited (${parsed.port})` }))
  }

  if (net.isIPv6(parsed.hostname)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'ipv6 addresses are not currently supported.' }))
  }

  if (net.isIPv4(parsed.hostname) && !validateHostIpV4Address(parsed.hostname)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `invalid or prohibited host ip address (${parsed.hostname})` }))
  }

  url = parsed.protocol + '//'
  if (parsed.auth) { url += parsed.auth + '@' }
  url += parsed.hostname
  if (parsed.port) { url += ':' + parsed.port }
  if (parsed.pathname) { url += parsed.pathname }
  if (parsed.query) { url += '?' + parsed.query }
  if (parsed.hash) { url += parsed.hash }

  callback(null, url, parsed.hostname, parsed)

}

function getTimeLeft(script, message) {

  // use ms from either stats or local start time. ms from sandbox stats more accurately reflects the "fair" start time.
  const ms = rInt(pathTo(message, 'stats.ms'), new Date() - script.start_time)
  return Math.max(0, script.configuration.timeoutMs - ms)
}

function createRequestOptions(script, message, url, method, host, options) {

  options = options || {}

  const requestOptions = {

          method: method,
          url: url,
          headers: {
            'user-agent': 'Medable HTTP/' + module.exports.version,
            'host': host
          },
          timeout: Math.max(1, Math.min(MAX_HTTP_TIMEOUT, getTimeLeft(script, message))),

          gzip: rBool(options.gzip, true),

          // ssl options
          rejectUnauthorized: rBool(options.rejectUnauthorized, true),
          servername: rString(options.servername, undefined),
          ciphers: rString(options.ciphers, undefined),
          passphrase: rString(options.passphrase, undefined),
          minDHSize: Math.max(512, rInt(options.minDHSize, 1024)),
          pfx: rString(options.pfx, undefined),
          ca: rString(options.ca, undefined),
          cert: rString(options.cert, undefined),
          key: rString(options.key, undefined),
          secureProtocol: rString(options.secureProtocol, undefined)
        },
        userTimeout = rInt(options.timeout, null)

  if (config('sandbox.enableNonStrictSSL')) {
    requestOptions.strictSSL = rBool(options.strictSSL, true)
  } else {
    requestOptions.strictSSL = true
  }

  if (userTimeout !== null) {
    requestOptions.timeout = Math.max(1, Math.min(userTimeout, requestOptions.timeout))
  }
  requestOptions.timeout = Math.max(1, Math.min(script.configuration.limits.maxCalloutRequestTimeout, requestOptions.timeout))

  if (_.isObject(options.headers)) {

    const { ac: { org: { configuration: { scripting: { allowedRestrictedHttpHeaders = [] } } } } } = script,
          headers = Object.entries(options.headers).reduce((headers, [key, value]) => {
            const adjusted = key.toLowerCase().trim()
            if (!blacklistedHeaders.has(adjusted) || allowedRestrictedHttpHeaders.includes(adjusted)) {
              headers[adjusted] = { key, value }
            }
            return headers
          }, {})
    requestOptions.headers = Object.entries(headers).reduce((headers, [lowercase, entry]) => {
      const { key, value } = entry
      headers[key] = value
      return headers
    }, requestOptions.headers)
  }

  if (~['POST', 'PATCH', 'PUT'].indexOf(method) && (_.isString(options.body) || Buffer.isBuffer(options.body))) {
    if (options.body.length > script.configuration.limits.maxCalloutRequestSize) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'maxCalloutRequestSize exceeded.' })
    }
    requestOptions.body = options.body
  }

  return requestOptions
}

function performRequest(script, message, url, method, host, parsed, options, callback) {

  const start = Date.now(),
        asBuffer = rBool(options?.buffer, false),
        asStream = !asBuffer && rBool(options?.stream, false),
        asCursor = !asBuffer && !asStream && rBool(options?.cursor, false)

  let onResponse,
      streaming = asStream || asCursor,
      redirectTo,
      done,
      req,
      sz = 0,
      buffer = asBuffer ? [] : ''

  function closeRequest(err) {
    try {
      req.abort()
    } catch (e) {}
    try {
      req.destroy(err)
    } catch (e) {}
  }

  done = _.once(function(err, response) {
    if (err || !streaming) {
      closeRequest(err)
    }
    script.stats.bytesIn += rInt(pathTo(response, 'connection.bytesRead'), 0)
    script.stats.bytesOut += rInt(pathTo(response, 'connection.bytesWritten'), 0)
    script.stats.calloutsMs += (Date.now() - start)

    callback(
      err,
      response,
      err ? null : (asBuffer ? Buffer.concat(buffer, buffer.reduce((len, b) => len + b.length, 0)) : buffer)
    )

  })

  try {
    req = request(createRequestOptions(script, message, url, method, host, options), function(err, response) {
      done(err, response)
    })
  } catch (err) {
    done(err)
  }
  if (streaming) {
    req.on('response', reqOnResponse)
  }
  req.on('data', reqOnData)
  req.on('error', reqOnErr)
  req.on('socket', reqOnSocket)

  // patch redirects to allow async operation.
  onResponse = req._redirect.onResponse
  req._redirect.onResponse = function(response) {

    const self = this

    // do not redirect if the script cannot continue.
    if (getTimeLeft(script, message) === 0) {
      return false
    }

    // not redirecting?
    redirectTo = self.redirectTo(response)
    if (!redirectTo) {
      return false
    }

    if (self.redirectsFollowed >= self.maxRedirects) {
      self.request.emit('error', Fault.create('cortex.error.unspecified', { reason: 'Maximum redirects exceeded' }))
      return false
    }

    if (!/^https?:/.test(redirectTo)) {

      continueRedirection() // this is a redirection to a path. allow this through.

    } else {

      // ensure the redirect host is okay, asynchronously.
      doValidate(script, message, redirectTo, function(err, url, hostname, parsed) {

        // re-run the request response and place the error in there, cancelling any redirect.
        if (err) {

          // hijack the final callback, placing the error in there.
          const cb = done
          done = function() {
            cb(err)
          }
          req._redirect.onResponse = function() {
            return false
          }
          req.onRequestResponse(response)
          return
        }

        // replace the redirection url and host header.
        // the host header will be removed so we have to put it back.
        response.caseless.set('location', url, true)
        req.once('redirect', function() {
          this.setHeader('host', hostname)
        })

        continueRedirection()

      })
    }

    function continueRedirection() {

      // if this returns false, we didn't end up redirecting after all. dammit.
      if (!onResponse.call(self, response)) {
        // wait, what?
      }
    }

    // return true so request ignores the rest of the response.
    return true

  }

  return req

  function reqOnResponse(result) {

    // don't attempt to stream a cursor if the content type is unsupported. force a raw result.
    if (asCursor) {
      const contentType = rString(result.headers['content-type'], '').toLowerCase(),
            mimeOptions = mimeToOptions(contentType)

      if (!mimeOptions.supported) {
        streaming = false
        return
      }
    }
    done(null, result)

  }

  function reqOnData(data) {
    sz += data.length
    if (sz > script.configuration.limits.maxCalloutResponseSize) {
      const err = Fault.create('cortex.tooLarge.unspecified', { reason: 'Maximum callout response size exceeded.' })
      done(err)
      closeRequest(err)
    } else {
      asBuffer ? buffer.push(data) : (buffer += data.toString('utf8'))
    }
  }

  function reqOnErr(err) {
    done(err)
  }

  function reqOnSocket(socket) {
    socket.on('lookup', socketOnLookup)
  }

  function socketOnLookup(err, ip, family, host) {
    if (err && err.code === 'ENOTFOUND') {
      throw Fault.create('cortex.notFound.unspecified', { reason: `server DNS address could not be found for host (${host}).` })
    }
    if (!err) {
      if (getTimeLeft(script, message) === 0) {
        throw Fault.create('cortex.timeout.unspecified', { reason: 'Script timed out during http callout.' })
      } else if (!config('sandbox.debug.skipHttpHostValidation')) {
        if (family !== 4 || !net.isIPv4(ip) || !validateHostIpV4Address(ip)) {
          throw Fault.create('cortex.accessDenied.unspecified', { reason: `invalid or prohibited host ip address for host (${host}, ${ip}).` })
        }
      }
    }
  }

}

module.exports = {

  version: '1.0.0',

  getCiphers: function(script, message, callback) {
    callback(null, tls.getCiphers())
  }

}

methods.forEach(function(method) {
  module.exports[method] = function(script, message, url, options, callback) {
    doCall(method.toUpperCase(), script, message, url, options, callback)
  }
})
