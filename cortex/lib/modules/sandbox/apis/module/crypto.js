'use strict'

const crypto = require('crypto'),
      NodeRSA = require('node-rsa'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      utils = require('../../../../utils'),
      _ = require('underscore'),
      hashAlgos = ['md5', 'sha1', 'sha256', 'sha512'],
      CHUNK_SIZE = 8192

function runHash(h, string, pos, size, callback) {
  const chunk = string.substr(pos, size)
  pos += size
  try {
    h.update(chunk)
  } catch (err) {
    callback(Fault.create('cortex.error.unspecified', { reason: 'Error during hash operation.' }))
    return
  }
  if (chunk.length === 0 || chunk.length < size) {
    callback(null, h.digest('hex'))
  } else {
    setImmediate(runHash, h, string, pos, size, callback)
  }
}
function doHash(algo, value, callback) {

  if (!_.isString(value)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'String expected for hashing function.' }))
  }
  let h
  try {
    h = crypto.createHash(algo)
  } catch (err) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Unsupported hash algorithm.' }))
  }
  runHash(h, value, 0, CHUNK_SIZE, callback)
}

function doHmac(algo, secret, value, callback) {

  if (!_.isString(secret) || !_.isString(value)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Strings expected for hmac function.' }))
  }
  let h
  try {
    h = crypto.createHmac(algo, secret)
  } catch (err) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Unsupported hash algorithm.' }))
  }
  runHash(h, value, 0, CHUNK_SIZE, callback)
}

function findClientKeyPair(org, apiKey) {

  let client

  if (apiKey === config('webApp.apiKey')) {
    throw Fault.create('cortex.notFound.unspecified', { reason: 'Invalid ApiKey.' })
  }
  for (let app of utils.array(org.apps)) {
    if (app.name === apiKey) {
      client = app.clients[0]
    } else {
      for (let c of utils.array(app.clients)) {
        if (c.key === apiKey) {
          client = c
          break
        }
      }
    }
    if (client) {
      break
    }
  }
  if (!client) {
    throw Fault.create('cortex.notFound.unspecified', { reason: `ApiKey ${apiKey} not found.` })
  }
  if (!client.rsa || !client.rsa.private) {
    throw Fault.create('cortex.notFound.unspecified', { reason: `ApiKey ${apiKey} does not have a valid RSA key pair.` })
  }
  return client.rsa
}

function getEncoding(valid, encoding) {
  if (!valid.includes(encoding)) {
    throw new TypeError(`Invalid encoding. Expected ${valid}`)
  }
  return encoding
}

module.exports = {

  version: '1.0.0',

  rsa: {

    /**
     *
     * @param script
     * @param message
     * @param apiKey
     * @param payload
     * @param outputEncoding
     * @param inputEncoding
     * @param options
     * extended: false. if true, returns { kid, encrypted }
     * @param callback
     */
    encrypt: function(script, message, apiKey, payload, outputEncoding, inputEncoding, options, callback) {
      options = options || {}
      const rsa = findClientKeyPair(script.ac.org, apiKey),
            publicKey = new NodeRSA(rsa.public),
            encrypted = publicKey.encrypt(
              payload,
              getEncoding(['hex', 'base64', 'buffer', 'binary'], outputEncoding || 'buffer'),
              getEncoding(['hex', 'base64', 'utf8'], inputEncoding || 'utf8')
            )

      callback(
        null,
        options.extended
          ? { kid: rsa.timestamp.getTime(), encrypted }
          : encrypted
      )

    },

    /**
     *
     * @param script
     * @param message
     * @param apiKey
     * @param payload
     * @param outputEncoding
     * @param options
     *  kid: null. if present, decrypts using a specific kid. if '*', tries all keys.
     *  extended: false. if true, returns { kid, decrypted }
     * @param callback
     */
    decrypt: function(script, message, apiKey, payload, outputEncoding, options, callback) {
      options = options || {}

      const rsa = findClientKeyPair(script.ac.org, apiKey)

      let docs
      if (options.kid === '*') {
        docs = [rsa, ...rsa.rotated]
      } else if (utils.isInteger(options.kid)) {
        const timestamp = parseInt(options.kid)
        docs = [rsa, ...rsa.rotated].filter(v => v.timestamp.getTime() === timestamp)
      } else {
        docs = [rsa]
      }

      if (docs.length === 0) {
        throw Fault.create('cortex.notFound.unspecified', { reason: `ApiKey ${apiKey} kid not found.` })
      }

      Promise.resolve(null)
        .then(async() => {
          let err, kid, decrypted
          for (const doc of docs) {
            kid = doc.timestamp.getTime()
            try {
              const privateKey = new NodeRSA(doc.private)
              decrypted = privateKey.decrypt(
                payload,
                getEncoding(['buffer', 'json', 'base64', 'utf8', 'hex', 'binary'], outputEncoding || 'utf8')
              )
              err = null
              break
            } catch (e) {
              err = e
            }
            await utils.sleep(0)
          }

          if (err) {
            throw err
          }
          return options.extended ? { kid, decrypted } : decrypted

        })
        .then(result => callback(null, result))
        .catch(err => callback(err))

    }
  },

  /**
   * @todo. make async and process in chunks.
   */
  aes: {

    encrypt: function(script, message, key_, iv_, payload, options, callback) {

      const { key, iv, algo } = checkOptions(key_, iv_, payload, options),
            encipher = crypto.createCipheriv(algo, key, iv),
            buffer = Buffer.concat([encipher.update(payload, _.isString(payload) ? 'utf8' : undefined), encipher.final()])

      callback(null, buffer)

    },

    decrypt: function(script, message, key_, iv_, payload, options, callback) {

      const { key, iv, algo } = checkOptions(key_, iv_, payload, options),
            decipher = crypto.createDecipheriv(algo, key, iv),
            buffer = Buffer.concat([decipher.update(payload, _.isString(payload) ? 'utf8' : undefined), decipher.final()])

      callback(null, buffer)

    }

  },

  randomBytes: function(script, message, size, callback) {

    size = utils.rInt(size, 0)

    if (size <= 0) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Size must be > 0' })
    } else if (size > 8192) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Size must be <= 8192' })
    }

    crypto.randomBytes(size, callback)
  }

}

function checkOptions(key, iv, payload, options) {

  options = options || {}

  const algo = utils.rString(options.algo, 'aes-256-cbc').toLowerCase().trim(),
        parts = algo.split('-'),
        bits = Number(parts[1]),
        bytes = bits / 8

  if (parts[0] !== 'aes') {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid algorithm. Only AES is current supported' })
  }
  if (![128, 256].includes(bits)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid algorithm. Only 128/256 is current supported' })
  }
  if (!['ctr', 'cbc'].includes(parts[2])) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid algorithm. Only CTR/CBC mode is current supported' })
  }

  if (_.isString(key)) {
    key = Buffer.from(key, 'utf8')
  }
  if (!Buffer.isBuffer(key) || key.length !== bytes) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: `Invalid key. Expected a ${bytes}-byte string or buffer.` })
  }

  if (_.isString(iv)) {
    iv = Buffer.from(iv, 'utf8')
  }
  if (!Buffer.isBuffer(iv) || iv.length !== 16) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid initialization vector. Expected a 16-byte string or buffer.' })
  }

  if (!(_.isString(payload) || Buffer.isBuffer(payload))) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid payload. Expected a string or buffer.' })
  }

  return { key, iv, algo }

}

hashAlgos.forEach(function(algo) {
  module.exports[algo] = function(script, message, value, callback) {
    doHash(algo, value, callback)
  }
  module.exports[`${algo}Hmac`] = function(script, message, secret, value, callback) {
    doHmac(algo, secret, value, callback)
  }
})
