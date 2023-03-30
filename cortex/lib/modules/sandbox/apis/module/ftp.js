'use strict'

const Ftp = require('ftp'),
      dns = require('dns'),
      tls = require('tls'),
      _ = require('underscore'),
      net = require('net'),
      { tryCatch, is_ipv4: isIPv4, rInt, rString, rBool, ip4incidr, resolveOptionsCallback, createId, array: toArray } = require('../../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),

      validHostRegExp = /\./,

      blacklistedHosts = [
        /^api(.+?.)?\.medable\.com$/i,
        /^app(.+?.)?\.medable\.com$/i,
        'metadata.google.internal',
        'kubernetes',
        'unix'
      ],

      blacklistedPorts = [
        [-Infinity, 20],
        [22, 79],
        [65535, Infinity]
      ],

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

// ----------------------------------------------------------

class Connection {

  constructor(script, client) {
    this.__id = createId()
    this._client = client
    this._ftp = null
    this._object = 'connection.ftp'
    this._closed = false
    this._script = script
  }

  get _id() {
    return this.__id
  }

  get object() {
    return this._object
  }

  get client() {
    return this._client
  }

  get ftp() {
    return this._ftp
  }

  set ftp(ftp) {
    this._ftp = ftp
  }

  get closed() {
    return this._closed
  }

  close(callback = () => {}) {
    this._closed = true
    try {
      this._client.end()
    } catch (err) {
      void err
    }
    try {
      this._script.connectionClose(this._id, callback)
    } catch (err) {
      void err
      callback()
    }
  }

  toJSON() {
    return {
      _id: this._id,
      object: this.object
    }
  }

}

// ----------------------------------------------------------

module.exports = {

  version: '1.0.0',

  create: function(script, message, options, callback) {

    resolveOptionsCallback(options, callback)

    const servername = rString(options.host).trim().toLowerCase(),
          port = rInt(options.port, 21)

    // limit to 1 ftp connection
    if (script.numConnections > 0) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `too many open connections` }))
    }

    if (!script.ac.org.configuration.scripting.enableFtpModule) {
      return callback(Fault.create('cortex.accessDenied.unspecified', { reason: `FTP Module must be enabled, contact ${config('emailAddresses.support')} to enable the module.` }))
    }

    // no inline.
    if (script.configuration.isInline) {
      return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'ftp module is not available to inline triggers.' }))
    }

    // validate the host against obvious baddies.
    if (!validateHost(servername, script)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `access to host is prohibited (${servername})` }))
    }

    // validate the host port
    if (!validatePort(port)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `access to port is prohibited (${port})` }))
    }

    // no ipv6
    if (net.isIPv6(servername)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'ipv6 addresses are not currently supported.' }))
    }

    // trivial check against blacklist
    if (net.isIPv4(servername) && !validateHostIpV4Address(servername)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `invalid or prohibited host ip address (${servername})` }))
    }

    // resolve dns to ensure good ipv4 address.
    resolveDns(script, message, servername, (err, host) => {

      if (err) {
        return callback(err)
      }

      let done,
          secureContext

      try {
        secureContext = tls.createSecureContext(
          _.pick(
              options?.secureOptions,
              'ca', 'cert', 'sigalgs', 'ciphers', 'crl', 'dhparam', 'ecdhCurve', 'honorCipherOrder', 'key',
              'minVersion', 'maxVersion', 'passphrase', 'pfx', 'secureProtocol'
          )
        )
      } catch (err) {
        return callback(err)
      }

      // create connection options
      const client = new Ftp(),
            connection = new Connection(script, client),
            connectionOptions = {
              host,
              port,
              secure: true,
              user: rString(options.username),
              password: rString(options.password),
              secureOptions: {
                secureContext,
                servername,
                rejectUnauthorized: rBool(options?.secureOptions?.rejectUnauthorized, true)
              },
              connTimeout: rInt(options.connTimeout),
              pasvTimeout: rInt(options.pasvTimeout),
              keepalive: rInt(options.keepalive)
            },
            onReady = () => {
              connection.ftp = client
              done()
            },
            onError = (err) => {
              done(err)
            },
            onEnd = () => {
              done(Fault.create('cortex.error.unspecified', { reason: 'ftp connection closed' }))
            }

      done = _.once(err => {
        try {
          client
            .removeListener('ready', onReady)
            .removeListener('error', onError)
            .removeListener('end', onEnd)
        } catch (err) {
          void err
        }

        // ensure we dump the connection
        if (err) {

          connection.close()

        } else {

          script.registerConnection(connection)

          // ensure that we catch connection errors not associated with a callout
          connection.client
            .on('error', () => {
              connection.close()
            })
            .on('end', () => {
              connection.close()
            })
        }

        callback(err, !err && connection.toJSON())
      })

      client
        .on('ready', onReady)
        .on('error', onError)
        .on('end', onEnd)
        .on('error', (err) => {
          void err
        })

      try {
        client.connect(connectionOptions)
      } catch (err) {
        done(err)
      }

    })

  },

  list: function(script, message, callback) {

    callback(
      null,
      script.connections
        .filter(connection => connection.object === 'connection.ftp')
        .map(connection => connection.toJSON())
    )

  },

  instance: {

    close: function(script, message, client, callback) {

      try {
        getConnection(script, client).close(() => {
          callback()
        })
      } catch (err) {
        void err
        callback()
      }

    },

    // ------------------------------------------------------------------

    list: function(script, message, client, path, callback) {

      doAction(
        script,
        message,
        client,
        (connection, ftp, callback) => {
          ftp.list(
            rString(path),
            (err, list) => {
              if (!err && list) {
                list = list.map(item => {
                  return {
                    type: item.type,
                    name: item.name,
                    size: item.size,
                    modifyTime: item.date,
                    rights: {
                      user: item.rights?.user,
                      group: item.rights?.group,
                      other: item.rights?.other
                    },
                    owner: item.owner,
                    group: item.group,
                    target: item.target,
                    sticky: item.sticky
                  }
                })
              }
              callback(err, list)
            }
          )
        },
        callback
      )

    },

    get: function(script, message, client, path, options, callback) {

      [options, callback] = resolveOptionsCallback(options, callback)

      let closing = false,
          stream,
          sz = 0,
          buffer = null,
          opCallback

      function onError(err) {
        done(err)
      }
      function onData(data) {
        sz += data.length
        if (sz > script.configuration.limits.maxCalloutResponseSize) {
          done(Fault.create('cortex.tooLarge.unspecified', { reason: 'Maximum callout response size exceeded.' }))
        } else {
          buffer = buffer ? Buffer.concat([buffer, data]) : data
        }
      }

      function onEnd() {
        done()
      }

      function tryClose(err) {
        void err
        if (!closing) {
          closing = true
          tryCatch(() => stream.close())
          tryCatch(() => stream.removeListener('error', onError))
          tryCatch(() => stream.removeListener('data', onData))
          tryCatch(() => stream.removeListener('end', onEnd))
        }
      }

      function done(err) {
        tryClose(err)
        if (opCallback) {
          opCallback(err, !err && buffer)
        }
      }

      doAction(
        script,
        message,
        client,
        (connection, ftp, callback) => {
          opCallback = callback
          ftp.get(rString(path), (err, newStream) => {
            if (err) {
              done(err)
            } else {
              stream = newStream
              stream.on('error', onError)
              stream.on('data', onData)
              stream.on('end', onEnd)
            }
          })
        },
        {
          // if there is a timeout or other error resulting from the stream, ensure we close the stream.
          onError: err => {
            tryClose(err)
          }
        },
        callback
      )

    },

    put: function(script, message, client, path, input, options, callback) {

      [, callback] = resolveOptionsCallback(options, callback)

      let scriptStream = script.getStream(input)

      // check buffer size
      if (!scriptStream) {
        if (Buffer.isBuffer(input)) {
          if (input.length > script.configuration.limits.maxCalloutRequestSize) {
            throw Fault.create('cortex.tooLarge.unspecified', { reason: 'ftp max callout request size exceeded.' })
          }
        } else {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'ftp put requires a buffer' })
        }
      }

      doAction(
        script,
        message,
        client,
        (connection, ftp, callback) => {

          if (scriptStream) {
            input = scriptStream.detach()
          }

          ftp.put(
            input,
            rString(path),
            (err, result) => {
              try {
                scriptStream && script.registerStream(input)
              } catch (e) {}
              callback(err, result)
            }
          )

        },
        callback
      )

    },

    mkdir: function(script, message, client, path, recursive, callback) {

      doAction(
        script,
        message,
        client,
        (connection, ftp, callback) => {
          ftp.mkdir(
            rString(path),
            recursive,
            (err) => callback(err)
          )
        },
        callback
      )
    },

    delete: function(script, message, client, path, callback) {

      doAction(
        script,
        message,
        client,
        (connection, ftp, callback) => {
          ftp.delete(
            rString(path),
            (err) => callback(err)
          )
        },
        callback
      )
    },

    rename: function(script, message, client, path, to, callback) {

      doAction(
        script,
        message,
        client,
        (connection, ftp, callback) => {
          ftp.rename(
            rString(path),
            rString(to),
            (err) => callback(err)
          )
        },
        callback
      )
    },

    chmod: function(script, message, client, path, mode, callback) {

      doAction(
        script,
        message,
        client,
        (connection, ftp, callback) => {
          let command = `CHMOD ${mode} ${path}`
          ftp.site(
            command,
            (err) => callback(err)
          )
        },
        callback
      )
    }

  }

}

// ------------------------------------------------------------------

/**
 *
 * @param script
 * @param message
 * @param client
 * @param handler
 * @param options
 *   onError optional sync function that is called if there is an error generated by the socket or a local timeout.
 * @param callback
 */
function doAction(script, message, client, handler, options, callback) {

  [options, callback] = resolveOptionsCallback(options, callback)

  let errHandler = _.isFunction(options.onError) ? options.onError : null

  const connection = getConnection(script, client),
        ftp = connection.client,
        timer = setTimeout(() => {
          done(Fault.create('cortex.timeout.unspecified', { reason: 'script timed out during ftp operation.' }))
          connection.close()
        }, getTimeLeft(script, message)),
        onError = err => {
          done(err)
        },
        onEnd = () => {
          connection.close()
          done(Fault.create('cortex.notFound.unspecified', { reason: 'connection closed or not found' }))
        }

  handler(connection, connection.ftp, (err, result) => {
    errHandler = null
    enhanceFtpErrorMessage(err)
    done(err, result)
  })

  function done(err, result) {
    clearTimeout(timer)
    try {
      ftp.removeListener('error', onError)
    } catch (err) {
      void err
    }
    try {
      ftp.removeListener('end', onEnd)
    } catch (err) {
      void err
    }
    if (err) {
      connection.close()
    }
    if (err && errHandler) {
      try {
        errHandler(err)
      } catch (err) {
        void err
      }
    }
    setImmediate(callback, err, result)
  }

}

function resolveDns(script, message, host, callback) {

  if (isIPv4(host)) {
    return resolved(null, host)
  } else {
    dns.resolve4(host, (err, addresses) => {
      resolved(err, toArray(addresses)[0])
    })
  }

  function resolved(err, address) {
    if (!err) {
      if (getTimeLeft(script, message) === 0) {
        err = Fault.create('cortex.timeout.unspecified', { reason: 'script timed out during dns lookup' })
      } else if (!address) {
        err = Fault.create('cortex.notFound.unspecified', { reason: `server dns address could not be found for host (${host}).` })
      } else if (!isIPv4(address) || !validateHostIpV4Address(address)) {
        err = Fault.create('cortex.invalidArgument.unspecified', { reason: `invalid or prohibited host ip address for host (${host}, ${address}).` })
      }
    }
    callback(err, address)
  }
}

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
  return true
}

function validateHostIpV4Address(ip) {
  if (config('__is_mocha_test__') && ip === '127.0.0.1') {
    return true
  }

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

function getTimeLeft(script, message) {

  // use ms from either stats or local start time. ms from sandbox stats more accurately reflects the "fair" start time.
  const stats = message.stats,
        ms = rInt(stats && stats.ms, new Date() - script.start_time)
  return Math.max(0, script.configuration.timeoutMs - ms)
}

function getConnection(script, client) {

  const connection = client && client.object === 'connection.ftp' && script.getConnection(client._id)
  if (!connection) {
    throw Fault.create('cortex.notFound.unspecified', { reason: 'connection closed or not found' })
  }
  if (connection.object !== 'connection.ftp') {
    throw Fault.create('cortex.notFound.unspecified', { reason: 'not an ftp connection' })
  }
  if (connection.closed) {
    connection.close()
    try {
      script.connectionClose(connection._id, () => {})
    } catch (err) {
      void err
    }
    return null
  }
  return connection

}

function enhanceFtpErrorMessage(error) {
  if (!error) return

  const ftpErrors = [
          { code: 421, reason: 'FTP: Service not available, closing control connection. This may be a reply to any command if the service knows it must shut down.' },
          { code: 425, reason: 'FTP: Can\'t open data connection.' },
          { code: 426, reason: 'FTP: Connection closed; transfer aborted.' },
          { code: 430, reason: 'FTP: Invalid username or password' },
          { code: 434, reason: 'FTP: Requested host unavailable.' },
          { code: 450, reason: 'FTP: Requested file action not taken.' },
          { code: 451, reason: 'FTP: Requested action aborted. Local error in processing.' },
          { code: 452, reason: 'FTP: Requested action not taken. Insufficient storage space in system. File unavailable (e.g., file busy).' },
          { code: 501, reason: 'FTP: Syntax error in parameters or arguments.' },
          { code: 502, reason: 'FTP: Command not implemented.' },
          { code: 503, reason: 'FTP: Bad sequence of commands.' },
          { code: 504, reason: 'FTP: Command not implemented for that parameter.' },
          { code: 530, reason: 'FTP: Permission denied.' },
          { code: 532, reason: 'FTP: Need account for storing files.' },
          { code: 534, reason: 'FTP: Could Not Connect to Server - Policy Requires SSL' },
          { code: 550, reason: 'FTP: Requested action not taken. File unavailable (e.g., file not found, no access).' },
          { code: 551, reason: 'FTP: Requested action aborted. Page type unknown.' },
          { code: 552, reason: 'FTP: Requested file action aborted. Exceeded storage allocation (for current directory or dataset).' },
          { code: 553, reason: 'FTP: Requested action not taken. File name not allowed.' }
        ],

        ftpError = ftpErrors.find(ftpError => ftpError.code === error.code)

  if (ftpError) {
    error.message = ftpError.reason
  }
}
