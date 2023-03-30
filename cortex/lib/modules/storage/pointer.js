'use strict'

const Fault = require('cortex-service/lib/fault'),
      async = require('async'),
      consts = require('../../consts'),
      _ = require('underscore'),
      { resolveOptionsCallback, equalIds, createId, getIdOrNull, isInteger, rBool, tryCatch } = require('../../utils'),
      clone = require('clone'),
      mime = require('mime'),
      fileType = require('file-type')

let Undefined

class MediaPointer {

  constructor(node, entry, ac) {

    this.deleteOnDispose = false
    entry = entry || {}
    this.ac = ac
    this.node = node

    this.creator = entry.creator
    this.location = this.getLocationType()
    this.storageId = entry.storageId || consts.storage.availableLocationTypes.medable
    this.ETag = entry.ETag
    this.size = entry.size
    this.mime = entry.mime
    this.filename = entry.filename
    this.private = entry.private
    this.name = entry.name
    this.pid = getIdOrNull(entry.pid)
    this.state = isInteger(entry.state) ? Math.min(consts.media.states.dead, Math.max(consts.media.states.pending, parseInt(entry.state))) : consts.media.states.ready
    this.meta = clone(entry.meta) // only lives in pointer.
    this.fault = entry.fault

  }

  reset() {
    this.ETag = this.size = this.mime = this.name = this.meta = null
    this.state = consts.media.states.ready
    this.pid = createId()
  }

  dispose() {
    if (this.deleteOnDispose) {
      this.delete()
    }
    this.reset()
  }

  delete(callback) {
    setImmediate(function() {
      callback(Fault.create('cortex.error.pureVirtual'))
    })
  }

  isUploadPointer() {
    return false
  }

  /**
   * @param callback -> err, info
   */
  info(callback = null) {

    let out = null
    if (_.isFunction(callback)) {
      const tasks = {
        filename: callback => this.getFileName(callback),
        ETag: callback => this.getETag(callback),
        mime: callback => this.getMime(callback),
        size: callback => this.getSize(callback)
      }

      async.series(tasks, (err, result) => {
        if (!err) {
          result.pid = this.pid
          result.location = this.getLocationType()
          result.storageId = this.storageId
          result.name = this.name
          result.state = this.state
          result.private = this.private
          result.creator = this.creator
          result.meta = clone(this.meta) || []
          if (this.fault) {
            result = this.fault
          }
        }
        callback(err, result)
      })

    } else {
      out = {
        creator: this.creator,
        filename: this.filename,
        ETag: this.ETag,
        mime: this.mime,
        size: this.size,
        pid: this.pid,
        location: this.getLocationType(),
        storageId: this.storageId,
        name: this.name,
        state: this.state,
        private: this.private,
        meta: this.meta || []
      }
      if (this.fault) {
        out.fault = this.fault
      }
    }
    return out

  }

  /**
   * @param options
   * @param callback -> err, readableStream
   */
  stream(options, callback) {
    setImmediate(function() {
      callback(Fault.create('cortex.error.pureVirtual'))
    })
  }

  setFault(err) {
    err = Fault.from(err)
    this.fault = err ? err.toJSON() : null
  }

  generatePropertyFileKey(rootDocument, propertyPath, facetId, contentType, callback) {
    setImmediate(callback, null, this.ac.org._id + '/' + rootDocument.constructor.objectId + '/' + rootDocument._id + '.' + propertyPath + '/' + facetId + '.' + (mime.extension(contentType) || 'dat'))
  }

  /**
   * @param pointer a MediaPointer
   * @param options
   * @param callback => err, this
   */
  write(pointer, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    let err

    if (!(pointer instanceof MediaPointer)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { reason: 'Expected a storage pointer' })
    }
    if (err) {
      if (_.isFunction(callback)) {
        setImmediate(() => {
          callback(err)
        })
      }

    } else {

      this.reset()
      this.creator = this.ac.principalId
      this.meta = clone(pointer.meta)
      this._doWrite(pointer, options, err => {
        callback(err, this)
      })

    }

  }

  _doWrite(pointer, options, callback) {
    setImmediate(() => {
      callback(Fault.create('cortex.error.pureVirtual'))
    })
  }

  url(options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)
    setImmediate(callback, Fault.create('cortex.error.pureVirtual'))

  }

  getMeta(name) {
    if (_.isArray(this.meta)) {
      const entry = _.find(this.meta, function(v) {
        return v.name === name
      })
      if (entry) {
        return entry.value
      }
    }
    return Undefined
  }

  setMeta(name, value, pub) {
    if (!_.isArray(this.meta)) {
      this.meta = []
    }
    let meta = this.meta, len = meta.length, entry
    while (len--) {
      entry = meta[len]
      if (entry && entry.name === name) {
        if (value === Undefined) {
          meta.splice(len, 1)
        } else {
          meta[len].value = value
          if (pub !== Undefined) {
            meta[len].public = !!pub
          }
        }
        return this
      }
    }
    if (value !== Undefined) {
      meta.push({ name: name, value: value, pub: rBool(pub, false) })
    }
    return this
  }

  detectMime(callback) {

    this.range(0, 1024 * 10, function(err, buffer) {

      let result
      if (!err) {
        [err, result] = tryCatch(() => {
          const type = fileType(buffer)
          return type ? type.mime : 'application/octet-stream'
        })
        if (!err) {
          // slough off charset=binary.
          const parts = result.split(';').map(v => v.trim())
          if (parts[1] === 'charset=binary') {
            result = parts[0]
          }
        }
      }
      callback(err, result)

    })
  }

  range(start, end, callback) {
    setImmediate(function() {
      callback(Fault.create('cortex.error.pureVirtual'))
    })
  }

  aclRead(principal, { skipAcl = false } = {}) {

    if (skipAcl || !this.private || equalIds(this.creator, principal._id)) {
      const info = this.info()
      if (_.isArray(info.meta)) {
        info.meta.forEach(function(meta) {
          if (meta && meta.pub) {
            info[meta.name] = meta.value
          }
        })

      }

      delete info.pid
      delete info.meta
      if (!this.private) delete info.private

      // delete anything that's null.
      Object.keys(info).forEach(function(key) {
        if (info[key] == null) {
          delete info[key]
        }
      })

      return info
    }
    return Undefined

  }

  getLocationType() {
    throw Fault.create('cortex.error.pureVirtual')
  }

  getMime(options, callback) {
    setImmediate(function() {
      callback(Fault.create('cortex.error.pureVirtual'))
    })
  }

  getSize(options, callback) {
    setImmediate(function() {
      callback(Fault.create('cortex.error.pureVirtual'))
    })
  }

  getETag(options, callback) {
    setImmediate(function() {
      callback(Fault.create('cortex.error.pureVirtual'))
    })
  }

  getFileName(options, callback) {
    setImmediate(function() {
      callback(Fault.create('cortex.error.pureVirtual'))
    })
  }

}

module.exports = MediaPointer
