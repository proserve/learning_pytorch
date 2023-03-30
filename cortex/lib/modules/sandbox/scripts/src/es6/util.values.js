
const Undefined = void 0,
      TRUEY = ['y', 'yes', 'true', '1'],
      FALSY = ['n', 'no', 'false', '0'],
      isPrimitiveRegex = /^[sbn]/,
      ObjectToString = Object.prototype.toString

function isFunction(v) {
  return ObjectToString.call(v) === '[object Function]'
}

function isDate(v) {
  return ObjectToString.call(v) === '[object Date]'
}

function isString(v) {
  return ObjectToString.call(v) === '[object String]'
}

function isArray(v) {
  return Array.isArray(v)
}

function isNumber(v) {
  return ObjectToString.call(v) === '[object Number]'
}

function isRegExp(v) {
  return ObjectToString.call(v) === '[object RegExp]'
}

function isError(v) {
  return ObjectToString.call(v) === '[object Error]'
}

function isObject(v) {
  const type = typeof v
  return type === 'function' || (type === 'object' && !!v)
}

function isSet(value) {
  return value !== null && value !== Undefined
}

exports = module.exports = {

  isFunction,
  isDate,
  isString,
  isArray,
  isNumber,
  isRegExp,
  isObject,
  isError,

  option(options, option, defaultValue, fnTest, fnTransform) {
    if (exports.hasValue(options) && options[option] !== Undefined) {
      if (fnTest && isFunction(fnTest)) {
        if (!fnTest(options[option])) {
          return defaultValue
        }
      }
      if (fnTransform && isFunction(fnTransform)) {
        return fnTransform(options[option])
      }
      return options[option]
    }
    return defaultValue
  },

  hasNoValue(v = null) {
    return v === null
  },

  hasValue(v = null) {
    return v !== null
  },

  stringToBoolean: function stringToBoolean(val = null, defaultVal = Undefined) {
    if (val !== null) {
      if (~FALSY.indexOf(String(val).toLowerCase())) {
        return false
      } if (~TRUEY.indexOf(String(val).toLowerCase())) {
        return true
      }
    }
    return defaultVal
  },

  within(number, min, max) {
    number = parseFloat(number)
    return number >= min && number <= max
  },

  array(val, wrap) {
    return isArray(val) ? val : (wrap ? [val] : [])
  },

  rVal(val, defaultVal) {
    if (val === Undefined) return defaultVal
    return val
  },

  isSet,

  rNum(val, defaultVal) {
    if (val === Undefined) return defaultVal
    if (exports.isNumeric(val)) return parseFloat(val)
    return defaultVal
  },

  rInt(val, defaultVal) {
    if (val === Undefined) return defaultVal
    if (exports.isInteger(val)) return parseInt(val)
    return defaultVal
  },

  rString(val, defaultVal) {
    if (val === Undefined) return defaultVal
    if (isString(val)) return val
    return defaultVal
  },

  rBool(boolValue = null, defaultValue = false) {
    return Boolean(boolValue === null ? defaultValue : boolValue)
  },

  isPrimitive(value = null) {
    return value === null || isPrimitiveRegex.test(typeof value)
  },

  isInt(n) {
    return typeof n === 'number' && parseFloat(n) === parseInt(n, 10) && !isNaN(n)
  },

  isNumeric(obj) {
    return !isArray(obj) && (obj - parseFloat(obj) + 1) >= 0
  },

  isInteger(a) {
    let b
    return isFinite(a) && ((b = String(a)) == parseInt(b)) // eslint-disable-line eqeqeq
  },

  getValidDate(d = null, defaultValue = null) {
    if (d === null) {
      return defaultValue === null ? null : exports.getValidDate(defaultValue)
    }
    if (isDate(d)) {
      if (isNaN(d.getTime())) {
        return null
      }
      return d
    }
    try {
      d = new Date(Date.parse(d))
      if (exports.isValidDate(d)) {
        return d
      }
    } catch (e) {}
    return defaultValue === Undefined ? null : exports.getValidDate(defaultValue)

  },

  isValidDate(d) {
    if (!isDate(d)) {
      return false
    }
    return !isNaN(d.getTime())
  },

  dateToAge(birthDate) {
    if (!isDate(birthDate)) return 0
    const today = new Date(),
          m = today.getMonth() - birthDate.getMonth()
    let age = today.getFullYear() - birthDate.getFullYear()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  },

  /**
     * pad(text, size, [char]): Left padding
     * pad(size, text, [char]): Right padding
     * @param string
     * @param size
     * @param character
     * @returns {string}
     */
  pad(string, size, character = null) {
    let pad,
        i,
        sz
    if (character === null) {
      character = ' '
    }
    if (typeof string === 'number') {
      sz = size
      size = string
      string = sz
    }
    string = string.toString()
    pad = ''
    size -= string.length
    for (i = 0; size >= 0 ? i < size : i > size; size >= 0 ? ++i : --i) {
      pad += character
    }
    if (sz) {
      return pad + string
    }
    return string + pad

  },

  escapeRegex(s) {
    return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  },

  clamp(number, min, max) {
    if (isNumber(number) && number > min) {
      return (number > max) ? max : number
    }
    return min
  },

  nullFunc() {

  },

  ensureCallback: function ensureCallback(fn) {
    return isFunction(fn) ? fn : exports.nullFunc
  },

  tryCatch: function tryCatch(fn = () => {}, callback = () => {}, waitLoop = false) {

    let err,
        result
    try {
      result = isFunction(fn) ? fn() : Undefined
    } catch (e) {
      err = e
    }
    if (isFunction(callback)) {
      if (waitLoop) {
        setImmediate(callback, err, result)
      } else {
        callback(err, result)
      }
    }
    return [err, result]

  },

  naturalCmp(str1, str2) {

    if (str1 === str2) return 0
    if (!str1) return -1
    if (!str2) return 1

    const cmpRegex = /(\.\d+|\d+|\D+)/g,
          tokens1 = String(str1).match(cmpRegex),
          tokens2 = String(str2).match(cmpRegex),
          count = Math.min(tokens1.length, tokens2.length)

    for (let i = 0; i < count; i++) {

      const a = tokens1[i],
            b = tokens2[i]

      if (a !== b) {
        const num1 = +a,
              num2 = +b
        if (num1 === num1 && num2 === num2) { // eslint-disable-line no-self-compare
          return num1 > num2 ? 1 : -1
        }
        return a < b ? -1 : 1
      }
    }

    if (tokens1.length !== tokens2.length) { return tokens1.length - tokens2.length }

    return str1 < str2 ? -1 : 1
  },

  compact(object, ...values) {
    if (isObject(object) && values.length) {
      Object.keys(object).forEach((key) => {
        if (values.includes((object[key]))) {
          delete object[key]
        }
      })
    }
    return object
  },

  matchesEnvironment(value, defaultValue = '*') {

    /* global script */

    if (!isSet(value)) {
      value = defaultValue
    }
    return value === '*' || (script.env && value === script.env.name)
  },

  getAllProperties: function(obj) {
    const allProps = []
    let curr = obj
    do {
      const props = Object.getOwnPropertyNames(curr)
      props.forEach(function(prop) {
        if (allProps.indexOf(prop) === -1) { allProps.push(prop) }
      })
      curr = Object.getPrototypeOf(curr)
    } while (curr)
    return allProps
  }

}
