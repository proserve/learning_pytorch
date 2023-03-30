
/* global ObjectID */

const base64 = require('base64'),
      { isId } = require('util.id'),
      { isPrimitive, isDate, isFunction } = require('util.values'),
      { isPlainObject } = require('util.object'),
      escapeChar = ';',
      specialChar = '~',
      escapedSpecialChar = '~;',
      specialCharSplitRG = /~(?!;)/,
      specialCharRG = /~/g,
      escapedSpecialCharRG = /~;/g,
      typeChar = '^',
      escapedTypeChar = '^;',
      typeCharRG = /\^/g,
      escapedTypeCharRG = /\^;/g,
      dateMarker = 'd',
      bufferMarker = 'b',
      idMarker = 'i',
      regExpMarker = 'r',
      __proto__ = '__proto__', // eslint-disable-line no-underscore-dangle
      constructor = 'constructor',
      Undefined = undefined

class MJSON {

  static stringify(value, options) {

    const { hydration = false, replacer } = options || {}

    let { indent = '' } = options || {}

    if (typeof indent === 'number') {
      let newIndent = ''
      for (let i = 0; i < indent; i += 1) {
        newIndent += ' '
      }
      indent = newIndent
    }

    return JSON.stringify(
      value,
      MJSON.createSerializer({ replacer, hydration }),
      indent
    )

  }

  static parse(value, options) {

    const { hydration = false, reviver } = options || {}

    return value && JSON.parse(
      value,
      MJSON.createDeserializer({ hydration, reviver })
    )

  }

  static isSerializable(value) {

    return isDate(value) || isId(value) || value instanceof RegExp || Buffer.isBuffer(value) || value instanceof Uint8Array
  }

  static createSerializer(options) {

    let path, all, seen, mapP, last, lvl, top = true

    const { replacer, hydration = false } = options || {}

    return function(key, value) {
      const root = top && key === ''
      if (root) {
        top = false
        if (hydration) {
          path = []
          all = [value]
          seen = [value]
          mapP = [specialChar]
          last = value
          lvl = 1
        }
      }
      if (key === __proto__ || key === constructor) {
        return Undefined
      }
      let is = false
      if (this[key] && typeof this[key] === 'object') {
        if (isDate(this[key])) {
          value = typeChar + dateMarker + value
          is = true
        } else if (isId(this[key])) {
          value = typeChar + idMarker + value
          is = true
        } else if ((this[key] instanceof RegExp)) {
          value = typeChar + regExpMarker + value.toString()
          is = true
        } else if (Buffer.isBuffer(this[key])) {
          value = typeChar + bufferMarker + base64.encode(this[key])
          is = true
        } else if (this[key] instanceof Uint8Array) {
          value = typeChar + bufferMarker + base64.encode(Buffer.from(this[key]))
          is = true
        }
      }
      if (hydration && !root) {
        if (last !== this) {
          lvl -= lvl - all.indexOf(this) - 1
          all.splice(lvl, all.length)
          path.splice(lvl - 1, path.length)
          last = this
        }
        if (typeof value === 'object' && value) {
          if (all.indexOf(value) < 0) {
            all.push(last = value)
          }
          lvl = all.length
          let i = seen.indexOf(value)
          if (i < 0) {
            i = seen.push(value) - 1
            path.push(('' + key).replace(specialCharRG, escapedSpecialChar))
            mapP[i] = specialChar + path.join(specialChar)
          } else {
            value = mapP[i]
          }
          return value
        }
      }
      if (!is && typeof value === 'string') {
        if (hydration && value.charAt(0) === specialChar) {
          value = value.replace(specialCharRG, escapedSpecialChar)
        }
        if (value.charAt(0) === typeChar) {
          value = value.replace(typeCharRG, escapedTypeChar)
        }
      }

      return replacer ? replacer.call(this, key, value) : value

    }

  }

  static createDeserializer(options) {

    const { reviver, hydration = false } = options

    let top = true

    return function(key, value) {

      const root = top && key === '',
            isString = typeof value === 'string'

      if (root) {
        top = false
      }
      if (key === __proto__ || key === constructor) {
        return Undefined
      }
      if (isString) {
        if (value.charAt(0) === typeChar) {
          if (value.charAt(1) === dateMarker) {
            return new Date(value.slice(2))
          } else if (value.charAt(1) === idMarker) {
            return new ObjectID(value.slice(2))
          } else if (value.charAt(1) === regExpMarker) {
            const str = value.slice(2), pos = str.lastIndexOf('/')
            if (~pos) { // invalid regexp otherwise
              return new RegExp(str.slice(1, pos), str.slice(pos + 1))
            }
          } else if (value.charAt(1) === bufferMarker) {
            return base64.decode(value.slice(2), true)
          } else if (value.charAt(1) === escapeChar) {
            value = value.replace(escapedTypeCharRG, typeChar)
          }
        }
      }
      if (hydration && root) {
        value = hydrate(value, value, {})
      }
      if (reviver) {
        value = reviver(key, value)
      }
      return value
    }

  }

}

/**
 * @param value
 * @param format
 * @param options
 *    json
 *      handleCircular {Boolean=false}
 *      replacer {Function=undefined}
 *      indent {String|Number=undefined}
 *    mjson
 *      hydration {Boolean=false}
 *      handleCircular {Boolean=false}
 *      replacer {Function=undefined}
 *      indent {String|Number=undefined}
 * @return {string|*}
 */
function stringify(value, format = 'json', options) {

  options = options || {}
  if (value instanceof Error) {
    value = toJSON(value)
  }
  if (value === Undefined) return 'null'

  const indent = options.indent,
        handleCircular = options.handleCircular

  let replacer = isFunction(options.replacer) ? options.replacer : null
  if (handleCircular) {
    replacer = getSerialize(replacer, () => Undefined)
  }

  switch (format) {

    case 'mjson':
      return MJSON.stringify(
        value,
        {
          hydration: options.hydration,
          replacer,
          indent
        }
      )

    case 'json':
    default:
      return JSON.stringify(
        value,
        replacer,
        indent
      )
  }

}

/**
 * @param value
 * @param format
 * @param options
 *    json
 *      reviver {Function=undefined}
 *    mjson
 *      hydration {Boolean=false}
 *      reviver {Function=undefined}
 * @return {any}
 */
function parse(value, format = 'json', options) {

  options = options || {}
  switch (format) {

    case 'mjson':
      return MJSON.parse(
        value,
        {
          hydration: options.hydration,
          reviver: options.reviver
        }
      )

    case 'json':
    default:
      return JSON.parse(
        value,
        options.reviver
      )
  }

}

exports = module.exports = {

  serialize: function(value, hydration = false) {
    return stringify(value, 'mjson', { hydration })
  },
  serializeObject: function(value, hydration = false) {
    return stringify(value, 'mjson', { hydration })
  },

  deserialize: function(value, hydration = false) {
    return parse(value, 'mjson', { hydration })
  },
  deserializeObject: function(value, hydration = false) {
    return parse(value, 'mjson', { hydration })
  },

  stringify,
  parse,
  isSerializable,
  toJSON,
  MJSON

}

function hydrate(root, current, retrieve) {
  const type = typeof current
  if (type === 'string') {
    if (current.charAt(0) === specialChar) {
      if (current.length === 1) {
        return root // root has length of 1.
      } else if (current.charAt(1) === escapeChar) {
        return current.replace(escapedSpecialCharRG, specialChar) // plain escaped string
      }
      if (!retrieve.hasOwnProperty(current)) {
        const keys = current.slice(1).split(specialCharSplitRG)
        let level = root
        for (let i = 0, length = keys.length; i < length; level = level[keys[i++].replace(escapedSpecialChar, specialChar)]) {
        }
        retrieve[current] = level
      }
      return retrieve[current]
    }
  } else if (type === 'object') {
    if (Array.isArray(current)) {
      for (let i = 0, length = current.length; i < length; i++) {
        current[i] = hydrate(root, current[i], retrieve)
      }
      return current
    }
    for (let key in current) {
      if (current.hasOwnProperty(key)) {
        current[key] = hydrate(root, current[key], retrieve)
      }
    }
    return current
  }
  return current
}

function matchPseudoPrimitve(value) {
  return value === Undefined || value === isPrimitive(value) || Array.isArray(value) || isPlainObject(value)
}

function toJSON(obj, ...args) {
  return (obj && isFunction(obj.toJSON)) ? obj.toJSON(...args) : obj
}

function isSerializable(value, as = 'json') {

  switch (as) {

    case 'json':
      return true

    case 'mjson':
      return matchPseudoPrimitve(value) || MJSON.isSerializable(value)

  }

}

function getSerialize(replacer, cycleReplacer) {

  const stack = [], keys = []

  if (cycleReplacer == null) {
    cycleReplacer = function(key, value) {
      if (stack[0] === value) return '[Circular ~]'
      return '[Circular ~.' + keys.slice(0, stack.indexOf(value)).join('.') + ']'
    }
  }

  return function(key, value) {
    if (stack.length > 0) {
      var thisPos = stack.indexOf(this)
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this)
      ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key)
      if (~stack.indexOf(value)) value = cycleReplacer.call(this, key, value)
    } else stack.push(value)

    return replacer == null ? value : replacer.call(this, key, value)
  }
}
