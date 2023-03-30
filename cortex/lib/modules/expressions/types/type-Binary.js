const Type = require('../type'),
      Fault = require('cortex-service/lib/fault')

class Type$Binary extends Type {

  static isA(value) {

    return Buffer.isBuffer(value)
  }

  static cast(value, { ac, path, forceEncoding = false } = {}) {

    if (value === null || value === undefined) {
      return value
    }
    if (Buffer.isBuffer(value)) {
      return value
    }

    let casted = null

    try {

      const type = typeof value
      if (type === 'number') {
        value = [value]
      }
      if (Array.isArray(value)) {
        casted = Buffer.from(value)
      } else if (type === 'string') {
        if (forceEncoding === 'base64') {
          casted = Buffer.from(value, 'base64')
        } else if (forceEncoding === 'hex') {
          casted = Buffer.from(value, 'hex')
        } else if (/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/.test(value)) {
          casted = Buffer.from(value, 'base64')
        } else if ((value.length % 2 === 0) && /^[0-9A-Fa-f]+$/.test(value)) {
          casted = Buffer.from(value, 'hex')
        }
      }
    } catch (err) {

    }

    if (casted === null) {
      throw Fault.create('cortex.invalidArgument.castError', { resource: ac && ac.getResource(), reason: 'Could not cast value to Binary.', path })
    }
    return casted

  }

  static $eq(a, b) {

    return a.equals(b)

  }

}

module.exports = Type$Binary
