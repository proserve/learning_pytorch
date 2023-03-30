
const classPrivates = require('./privates').createAccessor(),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      { isSet, rString, rInt, roughSizeOfObjectAsync, rBool, profile, isPlainObject } = require('../utils'),
      pathTo = require('./pather').sandbox

/**
 * Memo for user data, with script api.
 */
class Memo {

  constructor({ data = {}, maxSize, errCode, additiveSize = false, initialSize = null, readOnlyApi = false } = {}) {

    Object.assign(classPrivates(this), {
      maxSize: rInt(maxSize, config('transforms.maxMemoSize')),
      errCode: rString(errCode, 'cortex.tooLarge.memo'),
      additiveSize: rBool(additiveSize, false),
      initialSize: rInt(initialSize, null),
      currentSize: rInt(initialSize, null),
      readOnlyApi: rBool(readOnlyApi, false),
      data,
      api: null
    })

  }

  static from(data, options = {}) {

    if (data instanceof Memo) {
      return data
    }
    if (!isSet(data)) {
      data = {}
    }
    return new Memo({ ...options, data })

  }

  static to(memo, defaultValue = {}) {

    if (memo instanceof Memo) {
      return memo.data
    }
    return isSet(memo) ? memo : defaultValue

  }

  static isMemoLike(data) {

    return !!((data instanceof Memo) || isPlainObject(data))
  }

  get data() {
    return classPrivates(this).data
  }

  set data(data) {

    const privates = classPrivates(this)
    privates.data = data
    privates.currentSize = null
    privates.initialSize = null

  }

  async calcSize() {

    const privates = classPrivates(this)
    if (!isSet(privates.initialSize)) {
      privates.currentSize = privates.initialSize = await profile.fn(
        roughSizeOfObjectAsync(
          privates.data,
          privates.additiveSize ? 0 : privates.maxSize,
          privates.errCode
        ),
        'roughSizeOfObjectAsync.memo'
      )
    }

  }

  async getSize() {
    const privates = classPrivates(this)
    await this.calcSize()
    return privates.currentSize
  }

  async getMaxSize() {
    const privates = classPrivates(this)
    await this.calcSize()
    return privates.additiveSize ? privates.initialSize + privates.maxSize : privates.maxSize
  }

  isArray(path) {
    const privates = classPrivates(this)
    if (isSet(path)) {
      path = path.toString().trim()
    }
    return Array.isArray(path ? pathTo(privates.data, path) : privates.data)
  }

  getLength(path) {
    const privates = classPrivates(this)
    if (isSet(path)) {
      path = path.toString().trim()
    }
    return (path ? pathTo(privates.data, path) : privates.data).length
  }

  typeOf(path) {
    const privates = classPrivates(this)
    if (isSet(path)) {
      path = path.toString().trim()
    }
    return typeof (path ? pathTo(privates.data, path) : privates.data)
  }

  get(path) {
    const privates = classPrivates(this)
    if (isSet(path)) {
      path = path.toString().trim()
    }
    return path ? pathTo(privates.data, path) : privates.data
  }

  async set(path, value) {

    const privates = classPrivates(this),
          maxSize = await this.getMaxSize()

    if (isSet(path)) {
      path = path.toString().trim()
    }

    if (path) {

      const currSz = await roughSizeOfObjectAsync(pathTo(privates.data, path)),
            valueSz = await roughSizeOfObjectAsync(value, maxSize, privates.errCode)

      if ((privates.currentSize + (valueSz - currSz)) > maxSize) {
        throw Fault.create(privates.errCode)
      }

      pathTo(privates.data, path, value)
      privates.currentSize += (valueSz - currSz)

    } else {

      if (!isSet(value)) {
        value = {}
      }

      const valueSz = await roughSizeOfObjectAsync(value, maxSize, privates.errCode)

      privates.data = value
      privates.currentSize = valueSz

    }
  }

  getScriptApi() {

    const privates = classPrivates(this),
          instance = this

    if (!privates.api) {

      privates.api = {

        getSize: function(script, message, callback) {
          let err
          instance.getSize()
            .catch(e => { err = e })
            .then(result => callback(err, result))
        },

        isArray: function(script, message, path, callback) {
          callback(null, instance.isArray(path))
        },

        getLength: function(script, message, path, callback) {
          callback(null, instance.getLength(path))
        },

        typeOf: function(script, message, path, callback) {
          callback(null, instance.typeOf(path))
        },

        get: function(script, message, path, callback) {
          callback(null, instance.get(path))
        }

      }

      if (!privates.readOnlyApi) {
        privates.api.set = function(script, message, path, value, callback) {
          let err
          instance.set(path, value)
            .catch(e => { err = e })
            .then(result => callback(err, result))
        }
      }

    }

    let { get, set, getSize, getLength, typeOf, isArray } = privates.api
    return { get, set, getSize, getLength, typeOf, isArray }
  }

  toJSON() {
    return this.data
  }

}

module.exports = Memo
