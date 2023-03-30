'use strict'

// mongoose needs some stuff initialized immediately
;(() => {
  const mongoose = require('mongoose')
  mongoose.Promise = Promise
  mongoose.MultiSchema = require('./multi-schema')
})()

const mongoose = require('mongoose'),
      { isId, resolveOptionsCallback } = require('../../utils'),
      Fault = require('cortex-service/lib/fault'),
      _ = require('underscore'),
      modules = require('../../modules'),
      async = require('async'),
      mongooseUtils = require('mongoose/lib/utils'),
      logger = require('cortex-service/lib/logger'),
      isMongooseObject = mongooseUtils.isMongooseObject,
      flatten = require('mongoose/lib/helpers/common').flatten,
      get = require('mongoose/lib/helpers/get')

let __model, schemaPath, baseModifiedPaths, baseDocInit

// eslint-disable-next-line one-var
const originalCast = mongoose.Schema.Types.String.cast()

// Backwards compatibility fix.
// Introduced by bumping mongoose from 4.5.10 to ^5.13.0
// Frontend used to pass empty array for '' and array of single element as a string value
mongoose.Schema.Types.String.cast(v => {
  if (Array.isArray(v) && v.length <= 1) {
    v = v.length === 0 ? '' : v[0]
  }
  return originalCast(v)
})

// register as a detectable class in id utility.
require('cortex-service/lib/utils/ids').registerIdClass(mongoose.Types.ObjectId)

require('cortex-service/lib/utils/ids').registerIdGetter(function(value) {
  if (value && (value instanceof mongoose.Model)) {
    const id = value._id
    if (isId(id)) {
      return id
    }
  }
  return null
})

// force case-insensitive model names.
__model = mongoose.model
mongoose.model = function(name, schema, collection, skipInit) {
  return __model.call(this, String(name).toLowerCase(), schema, collection, skipInit)
}

// allow set to be an array
mongoose.SchemaType.prototype.set = function(...setters) {
  setters.forEach(fn => {
    if (typeof fn !== 'function') { throw new TypeError('A setter must be a function.') }
    this.setters.push(fn)
  })
  return this
}

// allow set to be an array
mongoose.SchemaType.prototype.get = function(...getters) {
  getters.forEach(fn => {
    if (typeof fn !== 'function') { throw new TypeError('A getter must be a function.') }
    this.getters.push(fn)
  })
  return this
}

mongoose.SchemaType.prototype.propertyNode = function(node) {
  this.node = node
  return this
}

// detects the virtual property and initializes as a virtual mixin.
schemaPath = mongoose['Schema'].prototype.path
mongoose.Schema.prototype.path = function(path, obj) {
  if (obj !== undefined) {
    if (obj.virtual) {
      this.virtual(path, obj)
      return this
    }
  }
  return schemaPath.call(this, path, obj)
}

baseModifiedPaths = mongoose.Document.prototype.modifiedPaths
mongoose.Document.prototype.modifiedPaths = function(cacheable, reset) {
  if (cacheable) {
    if (reset || !this.$__.cachedModifiedPaths) {
      this.$__.cachedModifiedPaths = baseModifiedPaths.call(this)
    }
    return this.$__.cachedModifiedPaths
  }
  return baseModifiedPaths.call(this)
}

mongoose.Document.prototype.resetModifiedPaths = function() {
  delete this.$__.cachedModifiedPaths
}

baseDocInit = mongoose.Document.prototype.init// = function(doc, opts, fn) {
mongoose.Document.prototype.init = function(doc, opts, fn, skipCheckModified) {
  if (typeof opts === 'function') {
    fn = opts
    opts = null
  }
  this.__skipCheckModified = skipCheckModified
  baseDocInit.call(this, doc, opts, fn)
  delete this.__skipCheckModified
  return this
}

mongoose.Document.prototype.isModified = function(paths, cachedModified) {
  if (this.__skipCheckModified) return false
  if (paths) {
    if (!Array.isArray(paths)) {
      paths = paths.split(' ')
    }
    if (!cachedModified) cachedModified = this.modifiedPaths()
    return paths.some(function(path) {
      return !!~cachedModified.indexOf(path)
    })
  }
  return this.$__.activePaths.some('modify')
}

mongoose.Document.prototype.getValue = mongoose.Document.prototype.$__getValue
mongoose.Document.prototype.setValue = mongoose.Document.prototype.$__setValue

mongoose.Document.prototype.validateWithAc = function(ac, options, callback) {

  [options, callback] = resolveOptionsCallback(options, callback)

  const [paths, skipSchemaValidators] = _.uniq(_getPathsToValidate(this))

  void skipSchemaValidators

  if (options.resourcePath) {
    ac.pushResource(this.schema.node.getResourcePath(ac, this))
  } else {
    ac.beginResource(this.schema.node.getResourcePath(ac, this))
  }

  async.eachSeries(

    paths,

    (path, callback) => {

      setImmediate(() => {

        const p = this.schema.path(path),
              node = p && p.node

        // If user marked as invalid or there was a cast error, don't validate.
        if (!p || !this.$isValid(path)) {
          return callback()
        }

        let val = (node && node.getValidationValue) ? node.getValidationValue.call(this, ac, node, path) : this.getValue(path)
        p.doAcValidate(ac, val, err => {
          if (err) {
            this.invalidate(path, err, undefined, true)
          }
          callback()
        }, this)

      })

    },

    () => {

      let err
      this.emit('validate', this)

      ac.popResource()

      if (!modules.db.getParentDocument(this)) {
        err = this.$__.validationError
      }

      callback(err)
    }

  )

}

/*!
 * ignore
 */

function _evaluateRequiredFunctions(doc) {
  Object.keys(doc.$__.activePaths.states.require).forEach(path => {
    const p = doc.$__schema.path(path)

    if (p != null && typeof p.originalRequiredValue === 'function') {
      doc.$__.cachedRequired[path] = p.originalRequiredValue.call(doc, doc)
    }
  })
}

/*!
 * ignore
 */

function _getPathsToValidate(doc) {

  _evaluateRequiredFunctions(doc)
  // only validate required fields when necessary
  let paths = new Set(Object.keys(doc.$__.activePaths.states.require).filter(function(path) {
    if (!doc.isSelected(path) && !doc.isModified(path, doc.modifiedPaths(true))) {
      return false
    }
    if (path in doc.$__.cachedRequired) {
      return doc.$__.cachedRequired[path]
    }
    return true
  }))

  Object.keys(doc.$__.activePaths.states.init).forEach(addToPaths)
  Object.keys(doc.$__.activePaths.states.modify).forEach(addToPaths)
  Object.keys(doc.$__.activePaths.states.default).forEach(addToPaths)
  function addToPaths(p) { paths.add(p) }

  const skipSchemaValidators = {},
        subdocs = doc.$getAllSubdocs(),
        modifiedPaths = doc.modifiedPaths(),
        flattenOptions = { skipArrays: true }

  for (const subdoc of subdocs) {
    if (subdoc.$basePath) {
      // Remove child paths for now, because we'll be validating the whole
      // subdoc
      for (const p of paths) {
        if (p === null || p.startsWith(subdoc.$basePath + '.')) {
          paths.delete(p)
        }
      }

      if (doc.isModified(subdoc.$basePath, modifiedPaths) &&
        !doc.isDirectModified(subdoc.$basePath) &&
        !doc.$isDefault(subdoc.$basePath)) {
        paths.add(subdoc.$basePath)

        skipSchemaValidators[subdoc.$basePath] = true
      }
    }
  }

  // from here on we're not removing items from paths

  // gh-661: if a whole array is modified, make sure to run validation on all
  // the children as well
  for (const path of paths) {
    const _pathType = doc.$__schema.path(path)
    if (!_pathType ||
      !_pathType.$isMongooseArray ||
      // To avoid potential performance issues, skip doc arrays whose children
      // are not required. `getPositionalPathType()` may be slow, so avoid
      // it unless we have a case of #6364
      (_pathType.$isMongooseDocumentArray && !get(_pathType, 'schemaOptions.required'))) {
      continue
    }

    _pushNestedArrayPaths(doc.$__getValue(path), paths, path)
  }

  function _pushNestedArrayPaths(val, paths, path) {
    if (val != null) {
      const numElements = val.length
      for (let j = 0; j < numElements; ++j) {
        if (Array.isArray(val[j])) {
          _pushNestedArrayPaths(val[j], paths, path + '.' + j)
        } else {
          paths.add(path + '.' + j)
        }
      }
    }
  }

  for (const pathToCheck of paths) {
    if (doc.$__schema.nested[pathToCheck]) {
      let _v = doc.$__getValue(pathToCheck)
      if (isMongooseObject(_v)) {
        _v = _v.toObject({ transform: false })
      }
      const flat = flatten(_v, pathToCheck, flattenOptions, doc.$__schema)
      Object.keys(flat).forEach(addToPaths)
    }
  }

  for (const path of paths) {
    // Single nested paths (paths embedded under single nested subdocs) will
    // be validated on their own when we call `validate()` on the subdoc itself.
    // Re: gh-8468
    if (doc.$__schema.singleNestedPaths.hasOwnProperty(path)) {
      paths.delete(path)
      continue
    }

    const _pathType = doc.$__schema.path(path)
    if (!_pathType || !_pathType.$isSchemaMap) {
      continue
    } else {
      const val = doc.$__getValue(path)
      if (val == null) {
        continue
      }
      for (const key of val.keys()) {
        paths.add(path + '.' + key)
      }
    }

  }

  paths = Array.from(paths)
  return [paths, skipSchemaValidators]
}

// --------------------------------------------------

/**
 * registers multiple named validators from an array
 *
 * eg: ['required', ['printableString', {min:1, max:100}]]
 *
 */
mongoose.SchemaType.prototype.acValidation = function(...validators) {
  modules.validation.createValidators(this, validators).forEach(validator => {
    if (!this.acValidators) this.acValidators = []
    this.acValidators.push(validator)
  })
  return this
}

mongoose.SchemaType.prototype.validate = function() {
  throw new Error('stock mongoose "validate" not supported. use "validation" instead')
}

/**
 * overwrites in order to allow custom errors and faults from validators
 *
 * @param ac
 * @param value
 * @param callback
 * @param document
 * @returns {*}
 */
mongoose.SchemaType.prototype.doAcValidate = function(ac, value, callback, document) {

  // @todo only validate modified paths? could be dangerous. better to have each validator check.
  // and here's why.. if we edit a property, another property might have a validator that would fail.
  // @todo add path dirtying to dependencies when a property is updated to correct the above.

  if (!document.isNew && !document.isModified(this.path, document.modifiedPaths(true))) {
    return callback()
  }
  if (!this.acValidators) {
    return callback()
  }
  if (value === undefined && this.node && this.node.removable && !this.node.alwaysValidate && !document.isNew) { // in order for checkRequired to work on new docs, we won't skip validation
    return callback()
  }

  ac.pushResource(this.node.docpath)
  async.eachSeries(
    this.acValidators,
    (validator, callback) => {
      validator.validate(ac, document, value, callback)
    },
    err => {
      ac.popResource()
      callback(err)
    })

}

function runValidators(node, ac, document, array, validators, post, callback) {
  if (!_.isArray(validators)) {
    callback()
    return
  }
  ac.pushResource(`${node.docpath}[]`)
  async.eachSeries(
    validators,
    (validator, callback) => {
      if ((!!post) !== (!!validator.post)) {
        callback()
      } else if (array === undefined) {
        callback() // pass undefined values and allow required validator to check it.
      } else if (!_.isArray(array)) {
        callback(Fault.create('cortex.invalidArgument.unspecified', 'array expected'))
      } else {

        if (validator.asArray) {
          validator.validate(ac, document, array, callback)
        } else {
          async.eachSeries(array, (value, callback) => {
            ac.setResource(node.getResourcePath(ac, value))
            validator.validate(ac, document, value, callback)
          }, callback)
        }
      }
    },
    err => {
      ac.popResource()
      callback(err)
    })
}

mongoose.SchemaTypes.Array.prototype.doAcValidate = function(ac, array, callback, document) {

  if (!document.isNew && !document.isModified(this.path, document.modifiedPaths(true))) {
    return callback()
  }

  runValidators(this.node, ac, document, array, this.acValidators, false, callback)

}

mongoose.SchemaTypes.DocumentArray.prototype.doAcValidate = function(ac, array, callback, document) {

  if (!document.isNew && !document.isModified(this.path, document.modifiedPaths(true))) {
    return callback()
  }

  const post = err => {
          if (err) {
            return callback(err)
          }
          runValidators(this.node, ac, document, array, this.acValidators, true, callback)
        },
        props = err => {
          if (err || !_.isArray(array) || array.length === 0) {
            post(err)
            return
          }

          async.eachSeries(array, (doc, callback) => {
            if (!doc) {
              callback()
            } else {
              doc.validateWithAc(ac, { resourcePath: ac.getResource() }, callback)
            }
          }, post)
        }

  if (!_.isArray(array)) {
    logger.silly(this.node.fullpath + ' is not an array, validating single document...')
    if (!array) {
      callback()
    } else {
      array.validateWithAc(ac, { resourcePath: ac.getResource() }, callback)
    }
    return
  }

  runValidators(this.node, ac, document, array, this.acValidators, false, props)

}

module.exports = mongoose
