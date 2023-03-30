'use strict'

const ssh2 = require('ssh2'),
      dns = require('dns'),
      _ = require('underscore'),
      net = require('net'),
      { tryCatch, is_ipv4: isIPv4, rInt, rString, ip4incidr, resolveOptionsCallback, createId, array: toArray } = require('../../../../utils'),
      Fault = require('cortex-service/lib/fault'),

      MAX_SFTP_TIMEOUT = 20000,

      validHostRegExp = /\./,

      blacklistedHosts = [
        /^api(.+?.)?\.medable\.com$/i,
        /^app(.+?.)?\.medable\.com$/i,
        'metadata.google.internal',
        'kubernetes',
        'unix'
      ],

      blacklistedPorts = [
        [-Infinity, 21],
        [23, 79],
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
    this._sftp = null
    this._object = 'connection.sftp'
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

  get sftp() {
    return this._sftp
  }

  set sftp(sftp) {
    this._sftp = sftp
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

    const host = rString(options.host).trim().toLowerCase(),
          port = rInt(options.port, 22)

    // limit to 1 sftp connection
    if (script.numConnections > 0) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `too many open connections` }))
    }

    if (!script.ac.org.configuration.scripting.enableSftpModule) {
      return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'sftp module is disabled' }))
    }

    // no inline.
    if (script.configuration.isInline) {
      return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'sftp module is not available to inline triggers.' }))
    }

    // validate the host against obvious baddies.
    if (!validateHost(host, script)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `access to host is prohibited (${host})` }))
    }

    // validate the host port
    if (!validatePort(port)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `access to port is prohibited (${port})` }))
    }

    // no ipv6
    if (net.isIPv6(host)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'ipv6 addresses are not currently supported.' }))
    }

    // trivial check against blacklist
    if (net.isIPv4(host) && !validateHostIpV4Address(host)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `invalid or prohibited host ip address (${host})` }))
    }

    // resolve dns to ensure good ipv4 address.
    resolveDns(script, message, host, (err, host) => {

      if (err) {
        return callback(err)
      }

      let done

      // create connection options
      const client = new ssh2.Client(),
            connection = new Connection(script, client),
            connectionOptions = {
              host,
              port,
              forceIPv4: true,
              algorithms: options.algorithms,
              username: rString(options.username),
              password: rString(options.password),
              privateKey: rString(options.privateKey),
              passphrase: rString(options.passphrase),
              localHostname: rString(options.localHostname),
              localUsername: rString(options.localUsername),
              hostHash: rString(options.hostHash, 'md5'),
              hostVerifier: function(key) {

                const expected = rString(options.hostFingerprint, '').replace(/[:]/g, '').toLowerCase(),
                      received = String(key).replace(/[:]/g, '').toLowerCase()

                return (expected === '' || expected === received)

              },
              tryKeyboard: false,
              keepaliveInterval: 0,
              readyTimeout: Math.max(1, Math.min(MAX_SFTP_TIMEOUT, getTimeLeft(script, message)))
            },
            onTcpConnection = (details, accept, reject) => {
              accept()
            },
            onReady = () => {
              client.sftp((err, sftp) => {
                if (!err) {
                  connection.sftp = sftp
                }
                done(err)
              })
            },
            onUnixConnection = (details, accept, reject) => {
              reject()
            },
            onError = (err) => {
              done(err)
            },
            onEnd = () => {
              done(Fault.create('cortex.error.unspecified', { reason: 'sftp connection closed' }))
            }

      done = _.once(err => {
        try {
          client
            .removeListener('tcp connection', onTcpConnection)
            .removeListener('ready', onReady)
            .removeListener('tcp connection', onTcpConnection)
            .removeListener('unix connection', onUnixConnection)
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
        .on('tcp connection', onTcpConnection)
        .on('ready', onReady)
        .on('tcp connection', onTcpConnection)
        .on('unix connection', onUnixConnection)
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
        .filter(connection => connection.object === 'connection.sftp')
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
        (connection, sftp, callback) => {
          const reg = /-/gi
          sftp.readdir(
            rString(path),
            (err, list) => {
              if (!err && list) {
                list = list.map(item => {
                  return {
                    type: item.longname.substr(0, 1),
                    name: item.filename,
                    size: item.attrs.size,
                    modifyTime: item.attrs.mtime * 1000,
                    accessTime: item.attrs.atime * 1000,
                    rights: {
                      user: item.longname.substr(1, 3).replace(reg, ''),
                      group: item.longname.substr(4, 3).replace(reg, ''),
                      other: item.longname.substr(7, 3).replace(reg, '')
                    },
                    owner: item.attrs.uid,
                    group: item.attrs.gid
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

    exists: function(script, message, client, path, callback) {

      doAction(
        script,
        message,
        client,
        (connection, sftp, callback) => {

          sftp.stat(
            rString(path),
            (err, stats) => {
              if (err && err.code === ssh2.SFTP_STATUS_CODE.NO_SUCH_FILE) {
                err = null
                stats = null
              }
              callback(err, !err && !!stats)
            }
          )
        },
        callback
      )

    },

    stat: function(script, message, client, path, callback) {

      doAction(
        script,
        message,
        client,
        (connection, sftp, callback) => {

          sftp.stat(
            rString(path),
            (err, stats) => {
              if (!err && stats) {
                stats = {
                  mode: stats.mode,
                  permissions: stats.permissions,
                  owner: stats.uid,
                  group: stats.guid,
                  size: stats.size,
                  accessTime: stats.atime * 1000,
                  modifyTime: stats.mtime * 1000
                }
              }
              callback(err, stats)
            }
          )
        },
        callback
      )

    },

    get: function(script, message, client, path, options, callback) {

      [, callback] = resolveOptionsCallback(options, callback)

      doAction(
        script,
        message,
        client,
        (connection, sftp, callback) => {

          let streamOptions = {},
              stream = sftp.createReadStream(rString(path), streamOptions),
              sz,
              buffer

          stream.on('error', onError)
          stream.on('data', onData)
          stream.on('end', done)

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

          function done(err) {
            tryCatch(() => stream?.close())
            tryCatch(() => stream?.removeListener('error', onError))
            tryCatch(() => stream?.removeListener('data', onData))
            tryCatch(() => stream?.removeListener('end', done))
            callback(err, buffer)
          }

        },
        callback
      )

    },

    put: function(script, message, client, path, input, options, callback) {

      [, callback] = resolveOptionsCallback(options, callback)

      let readStream,
          scriptStream = script.getStream(input)

      // check buffer size
      if (!scriptStream) {
        if (Buffer.isBuffer(input)) {
          if (input.length > script.configuration.limits.maxCalloutRequestSize) {
            throw Fault.create('cortex.tooLarge.unspecified', { reason: 'sftp max callout request size exceeded.' })
          }
        } else {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'sftp put requires a buffer' })
        }
      }

      doAction(
        script,
        message,
        client,
        (connection, sftp, callback) => {

          const writeStream = sftp.createWriteStream(rString(path))
          writeStream.on('error', err => {
            done(err)
          })
          writeStream.on('close', () => {
            done()
          })

          if (scriptStream) {
            readStream = scriptStream.detach()
            scriptStream ? readStream.pipe(writeStream) : writeStream.end(input)
          } else {
            writeStream.end(input)
          }

          function done(err) {
            try {
              readStream && script.registerStream(readStream) // re-attach responsibility to script.
            } catch (e) {}
            try {
              writeStream && writeStream.close()
            } catch (e) {}
            callback(err)
          }

        },
        callback
      )

    },

    mkdir: function(script, message, client, path, callback) {

      doAction(
        script,
        message,
        client,
        (connection, sftp, callback) => {
          sftp.mkdir(
            rString(path),
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
        (connection, sftp, callback) => {
          sftp.unlink(
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
        (connection, sftp, callback) => {
          sftp.rename(
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
        (connection, sftp, callback) => {
          sftp.chmod(
            rString(path),
            String(mode),
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
        sftp = connection.client,
        timer = setTimeout(() => {
          done(Fault.create('cortex.timeout.unspecified', { reason: 'script timed out during sftp operation.' }))
        }, getTimeLeft(script, message)),
        onError = err => {
          done(err)
        },
        onEnd = () => {
          done(Fault.create('cortex.notFound.unspecified', { reason: 'connection closed or not found' }))
        }

  try {
    handler(connection, connection.sftp, (err, result) => {
      errHandler = null
      done(err, result)
    })
  } catch (err) {
    done(err)
  }

  function done(err, result) {
    clearTimeout(timer)
    try {
      sftp.removeListener('error', onError)
    } catch (e) {}
    try {
      sftp.removeListener('end', onEnd)
    } catch (e) {}
    if (err) {
      connection.close()
    }
    if (err && errHandler) {
      try {
        errHandler(err)
      } catch (e) {}
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

  const connection = client && client.object === 'connection.sftp' && script.getConnection(client._id)
  if (!connection) {
    throw Fault.create('cortex.notFound.unspecified', { reason: 'connection closed or not found' })
  }
  if (connection.object !== 'connection.sftp') {
    throw Fault.create('cortex.notFound.unspecified', { reason: 'not an sftp connection' })
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
