/* global ObjectID */

const pathTo = require('util.paths.to')

exports = module.exports = {

  OBJECT_ID_REGEXP: /^[0-9a-fA-F]{24}$/,

  isIdFormat(id) {
    return ((typeof id === 'string') && exports.OBJECT_ID_REGEXP.test(id))
  },

  couldBeId(id) {
    return exports.isId(id) || exports.isIdFormat(id)
  },

  equalIds(a, varArgs) {
    a = exports.getIdOrNull(a)
    if (!a) return false
    let len = arguments.length
    while (len-- > 1) {
      const b = exports.getIdOrNull(arguments[len])
      if (!b || !a.equals(b)) {
        return false
      }
    }
    return true
  },
  timestampToId(timestamp) {

    if (typeof timestamp === 'string') {
      timestamp = (new Date(timestamp)).getTime()
    }
    return new ObjectID(timestamp)
  },

  idToTimestamp(id) {
    id = exports.getIdOrNull(id)
    return id ? id.getTimestamp() : 0
  },

  createId(value = null) {
    return new ObjectID(value)
  },

  getIdOrNull(value, anyObject) {

    if (!value) {
      return null
    } if (exports.isId(value)) {
      return value
    } if (exports.isIdFormat(value)) {
      try {
        return new ObjectID(value)
      } catch (e) {
        return null
      }
    }
    if (anyObject && value._id) {
      return exports.getIdOrNull(value._id, false)
    }
    return null
  },

  indexOfId(ids, id) {
    id = exports.getIdOrNull(id)
    if (id && Array.isArray(ids)) {
      for (let i = 0, j = ids.length; i < j; i++) {
        if (exports.equalIds(ids[i], id)) return i
      }
    }
    return -1
  },

  inIdArray(ids, id) {
    return exports.indexOfId(ids, id) > -1
  },

  getIdArray(ids, convertToStrings, fnEach) {
    if (!Array.isArray(ids)) ids = [ids]
    const isFunction = (typeof fnEach === 'function')
    for (let i = ids.length - 1; i >= 0; i--) {
      const id = exports.getIdOrNull(isFunction ? fnEach(ids[i]) : ids[i])
      if (id) {
        ids[i] = convertToStrings ? id.toString() : id
      } else {
        ids.splice(i, 1)
      }
    }
    return ids
  },

  uniqueIdArray(ids) {
    if (Array.isArray(ids)) {
      ids = ids.slice()
    } else {
      ids = [ids]
    }
    ids = exports.getIdArray(ids)
    return ids.filter((id, i, a) => i === exports.indexOfId(a, id))
  },

  lookupId(obj, id) {
    let out = null
    const type = typeof obj,
          lookFor = exports.getIdOrNull(id)

    if (lookFor && (type === 'function' || (type === 'object' && !!obj))) {
      Object.keys(obj).forEach((key) => {
        if (!out && exports.equalIds(id, key)) {
          out = obj[key]
        }
      })
    }
    return out
  },

  findIdPos(array, path, id) {
    if (Array.isArray(array)) {
      for (let i = 0, j = array.length; i < j; i++) {
        const item = array[i]
        if (item) {
          const _id = pathTo(item, path)
          if (exports.equalIds(_id, id)) {
            return i
          }
        }
      }
    }
    return -1
  },

  findIdInArray(array, path, id) {
    const pos = exports.findIdPos(array, path, id)
    return pos === -1 ? undefined : array[pos]
  },

  diffIdArrays(array, ...rest) {
    return exports.uniqueIdArray(array).filter((item) => rest.every((other) => !exports.inIdArray(other, item)))
  },

  intersectIdArrays(array, ...rest) {
    return exports.uniqueIdArray(array).filter((item) => rest.every((other) => exports.inIdArray(other, item)))
  },

  isId(id) {
    return id instanceof ObjectID
  }

}
