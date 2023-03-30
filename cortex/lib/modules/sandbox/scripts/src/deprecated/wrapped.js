
try {
  require('logger').warn('The wrapped module is deprecated.')
} catch (err) {
}

const objects = require('objects'),
      clone = require('clone')

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

module.exports = function Wrapped(pluralName, defaultOptions) {

  if (!(this instanceof Wrapped)) {
    return new Wrapped(pluralName, defaultOptions)
  }

  defaultOptions = clone(defaultOptions || {})

  // public interface.
  Object.defineProperties(this, {

    findOne: {
      value(id, options) {
        return objects.read(pluralName, id, extend({}, defaultOptions, options))
      }
    },

    find: {
      value(options) {
        return objects.list(pluralName, extend({}, defaultOptions, options))
      }
    },

    insertOne: {
      value(doc, options) {
        return objects.create(pluralName, doc, extend({}, defaultOptions, options))
      }
    },

    removeOne: {
      value(_id, options) {
        return objects.delete(pluralName, _id, extend({}, defaultOptions, options))
      }
    },

    count: {
      value(where, options) {
        return objects.count(pluralName, where, extend({}, defaultOptions, options))
      }
    },

    query: {
      value() {
        throw new Error('not implemented') // <-- return query builder instance
      }
    },

    pipeline: {
      value(options) {
        return require('pipeline')(pluralName, extend({}, defaultOptions, options))
      }
    },

    cursor: {
      value(options) {
        return require('cursor')(pluralName, extend({}, defaultOptions, options))
      }
    }

  })

}
