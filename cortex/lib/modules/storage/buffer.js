'use strict'

const _ = require('underscore'),
      crypto = require('crypto'),
      stream = require('stream'),
      Fault = require('cortex-service/lib/fault'),
      utils = require('../../utils'),
      MediaPointer = require('./pointer'),
      consts = require('../../consts')

class BufferPointer extends MediaPointer {

  constructor(node, entry, ac) {

    super(node, entry, ac)

    this.deleteOnDispose = false
    this.buffer = utils.path(entry, 'buffer') || this.getMeta('buffer')
  }

  get buffer() {
    return this.getMeta('buffer') || (this.buffer = Buffer.alloc(0))
  }

  set buffer(buf) {

    buf = buf || Buffer.alloc(0)
    if (!Buffer.isBuffer(buf)) {
      if (buf.constructor.name === 'Binary' && buf._bsontype === 'Binary' && Buffer.isBuffer(buf.buffer)) {
        buf = buf.buffer
      } else {
        buf = Buffer.from(buf.toString(), 'base64')
      }
    }
    this.setMeta('buffer', buf)
  }

  delete(callback) {
    this.buffer = Buffer.alloc(0)
    setImmediate(utils.ensureCallback(callback))
  }

  url(options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)
    setImmediate(callback, Fault.create('cortex.notImplemented.pointerUrl'))

  }

  _doWrite(pointer, options, callback) {
    callback = _.once(utils.ensureCallback(callback))
    this.buffer = Buffer.alloc(0)
    pointer.stream(utils.path(options, 'streamOptions') || {}, (err, stream) => {
      if (err) {
        return callback(err)
      }
      stream
        .on('data', (chunk) => {
          this.buffer = Buffer.concat([this.buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)])
        })
        .on('end', () => {
          this.state = consts.media.states.ready
          callback()
        })
        .on('error', (err) => {
          this.state = consts.media.states.error
          callback(err)
        })
    })
  }

  getLocationType() {
    return consts.LocationTypes.Buffer
  }

  getMime(options, callback) {
    if (_.isFunction(options)) {
      callback = options
    }
    if (this.mime) {
      setImmediate(callback, null, this.mime)
    } else {
      this.detectMime((err, mime) => {
        if (!err) {
          this.mime = mime
        }
        callback(err, mime)
      })
    }
  }

  getSize(options, callback) {
    if (_.isFunction(options)) {
      callback = options
    }
    this.size = this.buffer.length
    setImmediate(callback, null, this.size)
  }

  getETag(options, callback) {
    if (_.isFunction(options)) {
      callback = options
    }
    if (!this.ETag) {
      try {
        let shasum = crypto.createHash('md5')
        shasum.update(this.buffer)
        this.ETag = shasum.digest('hex')
      } catch (err) {
        return callback(err)
      }
    }
    setImmediate(callback, null, this.ETag)
  }

  getFileName(options, callback) {
    if (_.isFunction(options)) {
      callback = options
    }
    setImmediate(callback, null, this.filename = '')
  }

  aclRead(principal, options) {

    const info = super.aclRead(principal, options)
    if (info) {
      info.buffer = this.buffer.toString('base64')
    }
    return info
  }

  /**
   *
   * @param start
   * @param end
   * @param options
   *  stream: false. if true, returns a readable stream instead of a buffer
   * @param callback
   */
  range(start, end, options, callback) {
    if (_.isFunction(options)) {
      callback = options; options = null
    } else if (_.isFunction(end)) {
      callback = end; end = null; options = null
    }
    start = utils.rInt(start, 0)
    end = utils.rInt(end, null)

    const buf = this.buffer.slice(start, end)

    if (utils.option(options, 'stream')) {
      const bs = new stream.PassThrough()
      bs.end(buf)
      return callback(null, bs)
    }

    callback(null, buf)
  }

  stream(options, callback) {
    if (_.isFunction(options)) {
      callback = options
    }
    const bs = new stream.PassThrough()
    bs.end(this.buffer)
    callback(null, bs)
  }

}

module.exports = BufferPointer
