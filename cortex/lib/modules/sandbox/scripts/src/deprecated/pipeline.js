
try {
  require('logger').warn('The pipeline module is deprecated.')
} catch (err) {
}

const clone = require('clone')

function extend(target) {
  target = target || {}
  for (let i = 1; i < arguments.length; i++) {
    const source = arguments[i]
    if (typeof source === 'object') {
      for (const prop in source) {
        if ((typeof source.hasOwnProperty === 'function') && source.hasOwnProperty(prop)) {
          target[prop] = source[prop]
        }
      }
    }
  }
  return target
}

function getPath(obj, path) {
  if (obj == null) return undefined
  if (!path || !(typeof path === 'string')) return undefined
  let p = path.split('.'),
      i,
      j
  for (i = 0, j = p.length; i < j; i++) {
    if (obj != null) {
      obj = obj[p[i]]
    }
  }
  return obj
}

module.exports = function Pipeline(pluralName, defaultOptions) {

  if (!(this instanceof Pipeline)) {
    return new Pipeline(pluralName, defaultOptions)
  }

  let pipeline = [], // <-- stages
      single = false, // <-- single result
      path = null // <-- single path

  defaultOptions = clone(defaultOptions)

  // public interface.
  Object.defineProperties(this, {

    match: { value(v) { pipeline.push({ $match: v }); return this } },
    unwind: { value(v) { pipeline.push({ $unwind: v }); return this } },
    group: { value(v) { pipeline.push({ $group: v }); return this } },
    limit: { value(v) { pipeline.push({ $limit: v }); return this } },
    skip: { value(v) { pipeline.push({ $skip: v }); return this } },
    project: { value(v) { pipeline.push({ $project: v }); return this } },
    sort: { value(v) { pipeline.push({ $sort: v }); return this } },

    single: { value() { single = true; defaultOptions.limit = 1; return this } },
    path: { value(p) { path = String(p); return this.single() } },

    cursor: {
      value(options) {
        if (single || path) {
          throw new Error('single() and path() and incompatible with cursor()')
        }
        return require('cursor')(pluralName, extend({}, defaultOptions, options, { pipeline }))
      }
    },

    exec: {
      value(options) {
        let result = require('objects').list(pluralName, extend({}, defaultOptions, options, { pipeline }))
        if (single) {
          result = result && result.data ? result.data[0] : undefined
          if (path) {
            return getPath(result, path)
          }
        }
        return result
      }
    }

  })

}
