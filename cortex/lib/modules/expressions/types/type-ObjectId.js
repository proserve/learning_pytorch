const Type = require('../type'),
      Fault = require('cortex-service/lib/fault'),
      { isSet, equalIds, isId, getIdOrNull, timestampToId } = require('../../../utils')

class Type$ObjectId extends Type {

  static isA(value) {

    return isId(value)
  }

  static cast(value, { ac, path } = {}) {

    if (!isSet(value)) {
      return value
    }

    let casted = getIdOrNull(value, true)

    if (!casted) {
      if (typeof value === 'string') {
        casted = new Date(value)
      } else if (typeof value === 'number') {
        casted = new Date(value)
      } else if (value instanceof Date) {
        casted = value
      }
      if (casted) {
        if (casted.toString() === 'Invalid Date') {
          casted = null
        } else {
          casted = timestampToId(casted)
        }
      }
    }

    if (casted == null) {
      throw Fault.create('cortex.invalidArgument.castError', { resource: ac && ac.getResource(), reason: `Could not cast "${value}" to ObjectId.`, path })
    }
    return casted
  }

  static $eq(a, b) {

    return this.isA(a) && this.isA(b) && equalIds(a, b)

  }

}

module.exports = Type$ObjectId
