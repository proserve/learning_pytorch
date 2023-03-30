'use strict'

const { isDate } = require('underscore'),
      { isSet, array: toArray, rString } = require('cortex-service/lib/utils/values'),
      isPlainObject = require('cortex-service/lib/utils/objects.is_plain_object'),
      { isId } = require('cortex-service/lib/utils/ids'),
      { isBSONTypeOf } = require('cortex-service/lib/utils/bson'),
      hasOwnProperty = Object.prototype.hasOwnProperty,
      lazy = require('cortex-service/lib/lazy-loader').from({
        MediaPointer: `${__dirname}/../modules/storage/pointer`,
        acl: `${__dirname}/../acl`
      }),
      classPrivates = require('./privates').createAccessor(),
      isPrimitiveRegex = /^[sbn]/

let Undefined

class Pather {

  constructor({ checkHasOwnProperty = true, limitToPrimitives = false, allowSerializableObjects = true, allowAccessSubjects = false, filter = ['__proto__'] } = {}) {
    Object.assign(classPrivates(this), {
      checkHasOwnProperty: !!checkHasOwnProperty,
      limitToPrimitives: !!limitToPrimitives,
      allowSerializableObjects: !!allowSerializableObjects,
      allowAccessSubjects: !!allowAccessSubjects,
      filter: toArray(filter, isSet(filter)).map(v => rString(v)).filter(v => v)
    })

  }

  get pathTo() {

    const privates = classPrivates(this)

    return privates.pathTo || (privates.pathTo = this.createPathFunction())
  }

  createPathFunction() {

    const { checkHasOwnProperty, limitToPrimitives, filter } = classPrivates(this)

    return (...args) => {

      let [obj, path, value, returnTopOnWrite] = args,
          parts

      if (obj === null || obj === Undefined) {
        return Undefined
      }

      const isString = typeof path === 'string',
            isArray = !isString && Array.isArray(path),
            write = args.length > 2

      parts = ((isArray && path) || (isString && path.split('.')))

      if (!isString && !isArray) {
        return Undefined
      }

      if (write) {

        if (obj === null || obj === Undefined) {
          obj = {}
        }

        const top = obj

        for (let i = 0, j = parts.length; i < j; i += 1) {

          const key = parts[i]

          // check filters
          if (filter.includes(key)) {
            return Undefined
          }

          // don't allow paths into non-primitives.
          if (limitToPrimitives) {
            if (!isPrimitiveRegex.test(typeof obj) && !Array.isArray(obj) && !isPlainObject(obj)) {
              return Undefined
            }
          }

          // on the last part, make the assignment. do not allow.
          if (i === j - 1) {

            obj[key] = value

          } else {

            // set new property on object.
            if (obj[key] === null || obj[key] === Undefined) {
              obj[key] = {}
            }
            obj = obj[key]

          }

        }

        if (returnTopOnWrite) {
          obj = top
        }

      } else {

        for (let i = 0, j = parts.length; i < j; i += 1) {

          const key = parts[i]

          if (obj === null || obj === Undefined) {
            break
          }

          // check for hasOwnProperty
          if (checkHasOwnProperty && !hasOwnProperty.call(obj, key)) {
            return Undefined
          }

          // check filters
          if (filter.includes(key)) {
            return Undefined
          }

          // don't allow paths into non-primitives.
          if (!this.canPathInto(obj)) {
            return Undefined
          }

          obj = obj[key]

        }

      }

      // don't allow non-primitives. fetching some serializable object may be ok.
      return this.canOutput(obj) ? obj : Undefined

    }

  }

  canPathInto(obj) {

    const { limitToPrimitives } = classPrivates(this)

    if (limitToPrimitives) {
      if (!isPrimitiveRegex.test(typeof obj) && !Array.isArray(obj) && !isPlainObject(obj)) {
        return false
      }
    }

    return true

  }

  canOutput(obj) {

    const { limitToPrimitives, allowSerializableObjects, allowAccessSubjects } = classPrivates(this)

    if (limitToPrimitives) {
      if (obj !== null && !isPrimitiveRegex.test(typeof obj) && !Array.isArray(obj) && !isPlainObject(obj)) {

        if (allowSerializableObjects && this.isSerializable(obj)) {
          return true
        } else if (allowAccessSubjects && lazy.acl.isAccessSubject(obj)) {
          return true
        }
        return false
      }
    }
    return true

  }

  isSerializable(value) {

    return (value instanceof RegExp) ||
      isDate(value) ||
      isId(value) ||
      Buffer.isBuffer(value) ||
      isBSONTypeOf(value, 'Binary') ||
      value instanceof lazy.MediaPointer

  }

}

module.exports = {
  Pather,
  permissive: new Pather({ checkHasOwnProperty: false, limitToPrimitives: false, allowSerializableObjects: true, filter: [] }).pathTo,
  legacy: new Pather({ checkHasOwnProperty: false, limitToPrimitives: false, allowSerializableObjects: true, filter: ['__proto__'] }).pathTo,
  sandbox: new Pather({ checkHasOwnProperty: true, limitToPrimitives: true, allowSerializableObjects: true, filter: [] }).pathTo
}
