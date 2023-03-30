
const hasOwn = Object.prototype.hasOwnProperty,
      { toString } = Object.prototype

let Undefined

function isPlainObject(obj) {

  if (!obj || toString.call(obj) !== '[object Object]') {
    return false
  }

  const hasOwnConstructor = hasOwn.call(obj, 'constructor'),
        hasIsPropertyOfMethod = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf')

  // Not own constructor property must be Object
  if (obj.constructor && !hasOwnConstructor && !hasIsPropertyOfMethod) {
    return false
  }

  // Own properties are enumerated firstly, so to speed up,
  // if last one is own, then all properties are own.
  let key
  for (key in obj) {}
  return key === Undefined || hasOwn.call(obj, key)

}

function extend() {

  let options,
      name,
      src,
      copy,
      copyIsArray,
      clone,
      target = arguments[0],
      i = 1,
      { length } = arguments,
      deep = false

  // Handle a deep copy situation
  if (typeof target === 'boolean') {
    deep = target
    target = arguments[1] || {}
    // skip the boolean and the target
    i = 2
  } else if ((typeof target !== 'object' && typeof target !== 'function') || target === null || target === Undefined) {
    target = {}
  }

  for (; i < length; ++i) {
    options = arguments[i]
    // Only deal with non-null/undefined values
    if (options !== null && options !== Undefined) {
      // Extend the base object
      for (name in options) {
        if (options.hasOwnProperty(name)) {
          src = target[name]
          copy = options[name]

          // Prevent never-ending loop
          if (target === copy) {
            continue
          }

          // Recurse if we're merging plain objects or arrays
          if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
            if (copyIsArray) {
              copyIsArray = false
              clone = src && Array.isArray(src) ? src : []
            } else {
              clone = src && isPlainObject(src) ? src : {}
            }

            // Never move original objects, clone them
            target[name] = extend(deep, clone, copy)

            // Don't bring in undefined values
          } else if (copy !== Undefined) {
            target[name] = copy
          }
        }
      }
    }
  }

  // Return the modified object
  return target
}

module.exports = {
  isPlainObject,
  extend
}
