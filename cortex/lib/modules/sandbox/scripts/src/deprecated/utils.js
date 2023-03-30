/* global ObjectID */

try {
  require('logger').warn('The utils module is deprecated.')
} catch (err) {
}

let Undefined

const _ = require('underscore'),
      OBJECT_ID_REGEXP = /^[0-9a-fA-F]{24}$/,
      TRUEY = ['y', 'yes', 'true', '1'],
      FALSY = ['n', 'no', 'false', '0'],
      isPrimitiveRegex = /^[sbn]/,
      utils = {

        array(val, wrap) {
          return _.isArray(val) ? val : (wrap ? [val] : [])
        },

        clamp(number, min, max) {
          if (_.isNumber(number) && number > min) {
            return (number > max) ? max : number
          }
          return min
        },

        path: function path(obj, path, value, returnTopOnWrite) {
          if (obj === null || obj === Undefined) return Undefined
          if (!path || !_.isString(path)) return undefined
          let p = path.split('.'),
              write = arguments.length > 2,
              i,
              j
          if (write) {
            const top = obj
            for (i = 0, j = p.length - 1; i < j; i++) {
              if (obj[p[i]] === null || obj[p[i]] === Undefined) {
                obj[p[i]] = {}
              }
              obj = obj[p[i]]
            }
            obj[p[p.length - 1]] = value
            if (returnTopOnWrite) return top
          } else {
            for (i = 0, j = p.length; i < j; i++) {
              if (obj != null) {
                obj = obj[p[i]]
              }
            }
          }
          return obj
        },

        stringToBoolean: function stringToBoolean(val, defaultVal) {
          if (val != null) {
            if (~FALSY.indexOf(String(val).toLowerCase())) {
              return false
            } if (~TRUEY.indexOf(String(val).toLowerCase())) {
              return true
            }
          }
          return defaultVal
        },

        getIdOrNull(value) {
          if (utils.isId(value)) {
            return value
          }
          if (utils.isIdFormat(value)) {
            return new ObjectID(value)
          }
          return null
        },

        indexOfId(ids, id) {
          id = utils.getIdOrNull(id)
          if (id && _.isArray(ids)) {
            for (let i = 0, j = ids.length; i < j; i++) {
              if (utils.equalIds(ids[i], id)) return i
            }
          }
          return -1
        },

        equalIds(a, varArgs) {
          a = utils.getIdOrNull(a)
          if (!a) return false
          let b,
              len = arguments.length
          while (len-- > 1) {
            b = utils.getIdOrNull(arguments[len])
            if (!b) {
              return false
            } if (!a.equals(b)) {
              return false
            }
          }
          return true
        },

        timestampToId(timestamp) {
          return new ObjectID(new Date(utils.rInt(timestamp, 0)))
        },

        idToTimestamp(id) {
          id = utils.getIdOrNull(id)
          return id ? id.toDate().getTime() : 0
        },

        inIdArray(ids, id) {
          return utils.indexOfId(ids, id) > -1
        },

        isIdFormat(id) {
          return (_.isString(id) && OBJECT_ID_REGEXP.test(id))
        },

        couldBeId(id) {
          return utils.isId(id) || utils.isIdFormat(id)
        },

        getIdArray(ids, convertToStrings, fnEach) {
          if (!_.isArray(ids)) ids = [ids]
          const isFunction = _.isFunction(fnEach)
          for (let i = ids.length - 1; i >= 0; i--) {
            let id = isFunction ? fnEach(ids[i]) : ids[i]
            id = utils.getIdOrNull(id)
            if (id) {
              ids[i] = convertToStrings ? id.toString() : id
            } else {
              ids.splice(i, 1)
            }
          }
          return ids
        },

        uniqueIdArray(ids) {
          ids = utils.getIdArray(ids)
          return ids.filter((id, i, a) => i === utils.indexOfId(a, id))
        },

        lookupId(obj, id) {
          let out = null
          if (_.isObject(obj) && (id = utils.getIdOrNull(id))) {
            Object.keys(obj).forEach((key) => {
              if (!out && utils.equalIds(id, key)) {
                out = obj[key]
              }
            })
          }
          return out
        },

        findIdPos(array, path, id, useGetter) {
          if (_.isArray(array)) {
            let item,
                _id
            for (let i = 0, j = array.length; i < j; i++) {
              item = array[i]
              if (item != null) {
                _id = (useGetter && _.isFunction(item.get)) ? item.get(path) : utils.path(item, path)
                if (utils.equalIds(_id, id)) {
                  return i
                }
              }
            }
          }
          return -1
        },

        findIdInArray(array, path, id, useGetter) {
          const pos = utils.findIdPos(array, path, id, useGetter)
          return pos === -1 ? undefined : array[pos]
        },

        diffIdArrays(array) {
          const rest = Array.prototype.slice.call(arguments, 1)
          return _.filter(utils.uniqueIdArray(array), (item) => _.every(rest, (other) => !utils.inIdArray(other, item)))
        },

        intersectIdArrays(array) {
          const rest = Array.prototype.slice.call(arguments, 1)
          return _.filter(utils.uniqueIdArray(array), (item) => _.every(rest, (other) => utils.inIdArray(other, item)))
        },

        isId(id) {
          return (id instanceof ObjectID)
        },

        rVal(val, defaultVal) {
          if (val === undefined) return defaultVal
          return val
        },

        rInt(val, defaultVal) {
          if (val === undefined) return defaultVal
          if (utils.isInteger(val)) return parseInt(val)
          return defaultVal
        },

        rString(val, defaultVal) {
          if (val === undefined) return defaultVal
          if (_.isString(val)) return val
          return defaultVal
        },

        rBool(val, defaultVal) {
          if (val === undefined) return defaultVal
          return !!val
        },

        isPrimitive(value) {
          return value == null || isPrimitiveRegex.test(typeof value)
        },

        pad(string, size, character) {
          let pad,
              _i,
              _size
          if (character == null) {
            character = ' '
          }
          if (typeof string === 'number') {
            _size = size
            size = string
            string = _size
          }
          string = string.toString()
          pad = ''
          size -= string.length
          for (_i = 0; size >= 0 ? _i < size : _i > size; size >= 0 ? ++_i : --_i) {
            pad += character
          }
          if (_size) {
            return pad + string
          }
          return string + pad

        },

        isCircular(obj, seen) {
          if (_.isObject(obj)) {
            seen = seen || []
            if (~seen.indexOf(obj)) {
              return true
            }
            seen.push(obj)
            const keys = Object.keys(obj)
            for (let i = 0; i < keys.length; i++) {
              if (utils.isCircular(obj[keys[i]], seen.slice(0))) {
                return true
              }
            }
          }
          return false
        },

        isInt(n) {
          return typeof n === 'number' && parseFloat(n) == parseInt(n, 10) && !isNaN(n) // eslint-disable-line eqeqeq
        },

        isNumeric(obj) {
          return !_.isArray(obj) && (obj - parseFloat(obj) + 1) >= 0
        },

        isInteger(a) {
          let b
          return isFinite(a) && ((b = String(a)) == parseInt(b)) // eslint-disable-line eqeqeq
        },

        getValidDate(d, defaultValue) {

          if (d == null) {
            return defaultValue === undefined ? null : utils.getValidDate(defaultValue)
          }
          if (_.isDate(d)) {
            if (isNaN(d.getTime())) {
              return null
            }
            return d
          }
          try {
            d = new Date(Date.parse(d))
            if (utils.isValidDate(d)) {
              return d
            }
          } catch (e) {}

          return defaultValue === undefined ? null : utils.getValidDate(defaultValue)

        },

        isValidDate(d) {
          if (!_.isDate(d)) {
            return false
          }
          return !isNaN(d.getTime())
        },

        dateToAge(birthDate) {
          if (!_.isDate(birthDate)) return 0
          let today = new Date(),
              age = today.getFullYear() - birthDate.getFullYear(),
              m = today.getMonth() - birthDate.getMonth()
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--
          }
          return age
        }

      }

module.exports = utils
