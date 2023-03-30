/* global ObjectID */
/* eslint-disable no-useless-escape */

let Undefined

const OBJECT_ID_REGEXP = /^[0-9a-fA-F]{24}$/,
      dig = module.exports = {

        READ_PART_MATCH: /^([^\[]+)($|(\[(\d+|[0-9a-fA-F]{24})\]$))/, // id or index
        WRITE_PART_MATCH: /^([^\[]+)($|(\[([0-9a-fA-F]{24})\]$))/, // id
        LAST_WRITE_PART_MATCH: /^([^\[]+)($|(\[(|[0-9a-fA-F]{24})\]$))/, // id or blank to push into array

        get(obj, path) {

          if (obj === null || obj === Undefined) {
            return Undefined
          }

          const isString = (path && typeof path === 'string'),
                isArray = !isString && Array.isArray(path),
                p = isArray ? path : path.split('.')

          if (!isString && !isArray) {
            return Undefined
          }

          for (let i = 0, j = p.length; i < j; i++) {

            const part = p[i],
                  match = part.match(dig.READ_PART_MATCH),
                  property = match ? match[1] : part,
                  id = match && isIdFormat(match[4]) ? new ObjectID(match[4]) : null,
                  idx = match && isInteger(match[4]) ? parseInt(match[4]) : null

            if (obj !== null && obj !== Undefined) {
              obj = obj[property]
              if (obj !== null && obj !== Undefined) {
                if (id !== null) {
                  obj = obj.find((v) => v && v._id && id.equals(v._id))
                } else if (idx !== null) {
                  obj = obj[idx]
                }
              }
            }
          }

          return obj

        },

        /**
     *
     * @param obj
     * @param path
     * @param value
     * @param options
     *  returnTop: false
     *  extend: false
     *  clone input: false
     * @returns {{}}
     */
        set(obj, path, value, options) {

          options = options || {}

          const top = (obj === null || obj === Undefined) ? (obj = {}) : obj,
                isString = (path && typeof path === 'string'),
                isArray = !isString && Array.isArray(path)

          if (isString || isArray) {

            const p = isArray ? path : path.split('.')

            for (let i = 0, j = p.length - 1; i < j; i++) {

              const part = p[i],
                    match = part.match(dig.WRITE_PART_MATCH),
                    property = match ? match[1] : part,
                    id = match && isIdFormat(match[4]) ? new ObjectID(match[4]) : null

              if (obj[property] === null || obj[property] === Undefined) {
                obj[property] = id ? [] : {}
              }
              obj = obj[property]

              if (id) {
                let el
                if (Array.isArray(obj)) {
                  el = obj.find((v) => v && v._id && id.equals(v._id))
                  if (!el) {
                    el = { _id: id }
                    obj.push(el)
                  }
                  obj = el
                } else {
                  throw new TypeError(`array expected at ${p.slice(0, i + 1).join('.')}`)
                }
              } else {
                obj = obj[property]
              }

            }

            let part = p[p.length - 1],
                match = part.match(dig.LAST_WRITE_PART_MATCH),
                property = match ? match[1] : part,
                id = match && isIdFormat(match[4]) ? new ObjectID(match[4]) : null,
                push = (match && match[4] === ''),
                shouldBeArray = id !== null || push

            if (shouldBeArray) {

              if (obj[property] === null || obj[property] === Undefined) {
                obj[property] = []
              } else if (!Array.isArray(obj[property])) {
                throw new TypeError(`array expected at ${p.join('.')}`)
              }

              if (id) {
                if (value === null) {
                  let len = obj[property].length
                  while (len--) {
                    const v = obj[property][len]
                    if (v && v._id && id.equals(v._id)) {
                      obj[property].splice(len, 1)
                    }
                  }
                } else {
                  let idx = -1,
                      el = obj[property].find((v, i) => { idx = i; return v && v._id && id.equals(v._id) })
                  if (!el) {
                    if (options.clone) {
                      value = clone(value)
                    }
                    value._id = id
                    el = value
                    obj[property].push(el)
                  } else {
                    if (options.clone) {
                      value = clone(value)
                    }
                    if (options.merge) {
                      deepExtend(el, value)
                    } else {
                      obj[property].splice(idx, 1)
                      value._id = id
                      el = value
                      obj[property].push(el)
                    }

                  }
                  obj = el
                }
              } else {
                if (options.clone) {
                  value = clone(value)
                }
                obj[property].push(value)
                obj = obj[property]
              }

            } else {
              if (options.clone) {
                value = clone(value)
              }
              obj[property] = value
            }

          }
          return options.returnTop ? top : obj

        }

      }

function isIdFormat(id) {
  return id && (typeof id === 'string') && OBJECT_ID_REGEXP.test(id)
}

function isInteger(a) {
  let b
  return isFinite(a) && ((b = String(a)) === parseInt(b).toString())
}

function deepExtend(...args) {
  return require('util.deep-extend')(...args)
}

function clone(...args) {
  return require('clone')(...args)
}
